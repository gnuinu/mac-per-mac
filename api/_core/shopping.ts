import {
  ShoppingRefineError,
  refineShoppingResults,
  type RawShoppingItem,
} from '../../src/services/shoppingFilter';
import { MemoryCache, RateLimiter } from './guards';
import type { ApiResult, RequestContext } from './types';

/**
 * 네이버 쇼핑 검색 → 대표가 하나.
 *
 * 가격 정제(태그 제거·관련성 필터·상하위 20% 절사·중앙값)는
 * src/services/shoppingFilter.ts의 순수 함수가 맡는다. HTTP·시크릿과 섞이면
 * 단위 테스트가 불가능해지기 때문이고, 파이프라인상 위치는 그대로 이 단계다.
 */

const NAVER_ENDPOINT = 'https://openapi.naver.com/v1/search/shop.json';
const DISPLAY = 20;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT = 20; // IP당 분당
const RATE_WINDOW_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 5_000;

export interface ShoppingPayload {
  priceKRW: number;
  label: string;
  note: string;
  sourceUrl: string;
  sampleSize: number;
  low: number;
  high: number;
}

// 인스턴스(isolate) 단위 메모리. 콜드 스타트마다 초기화된다.
const cache = new MemoryCache<ShoppingPayload>(CACHE_TTL_MS);
const limiter = new RateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

export async function handleShopping({
  query,
  clientIp,
  env,
}: RequestContext): Promise<ApiResult> {
  if (!query) return { status: 400, body: { error: 'q 파라미터가 필요합니다' } };

  if (!limiter.take(clientIp)) {
    return {
      status: 429,
      body: { error: '요청이 너무 잦습니다. 잠시 뒤 다시 시도해주세요.' },
      headers: { 'Retry-After': '60' },
    };
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return { status: 200, body: cached, headers: { 'X-Cache': 'HIT' } };

  const { NAVER_CLIENT_ID, NAVER_CLIENT_SECRET } = env;
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return { status: 503, body: { error: '네이버 API 자격 증명이 설정되지 않았습니다' } };
  }

  let items: RawShoppingItem[];
  try {
    const url = `${NAVER_ENDPOINT}?query=${encodeURIComponent(query)}&display=${DISPLAY}&sort=sim`;
    const upstream = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return { status: 502, body: { error: `네이버 응답이 ${upstream.status}입니다` } };
    }

    const body = (await upstream.json()) as { items?: RawShoppingItem[] };
    items = Array.isArray(body.items) ? body.items : [];
  } catch {
    return { status: 502, body: { error: '네이버 쇼핑에 연결하지 못했습니다' } };
  }

  try {
    const refined = refineShoppingResults(items, query);
    const payload: ShoppingPayload = {
      priceKRW: refined.priceKRW,
      label: refined.representative.title,
      note: `쇼핑몰 최저가 중앙값 (${refined.sampleSize}개 기준)`,
      sourceUrl: refined.representative.link,
      sampleSize: refined.sampleSize,
      low: refined.low,
      high: refined.high,
    };

    cache.set(cacheKey, payload);
    return { status: 200, body: payload, headers: { 'X-Cache': 'MISS' } };
  } catch (error) {
    if (error instanceof ShoppingRefineError) {
      // 결과가 너무 적으면 실패로 보고, 호출자가 다음 단계로 넘어가게 한다.
      return {
        status: 404,
        body: { error: error.message, matchedSize: error.matchedSize },
      };
    }
    return { status: 500, body: { error: '가격을 정제하지 못했습니다' } };
  }
}
