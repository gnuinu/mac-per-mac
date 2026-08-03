import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ShoppingRefineError,
  refineShoppingResults,
  type RawShoppingItem,
} from '../src/services/shoppingFilter';
import { MemoryCache, RateLimiter, clientIp, readQuery } from './_lib/guards';

/**
 * 네이버 쇼핑 검색 프록시.
 *
 * 클라이언트에서 직접 부를 수 없어서(CORS + 시크릿 노출) 여기서 중계한다.
 * 가격 정제(태그 제거·관련성 필터·상하위 20% 절사·중앙값)는
 * src/services/shoppingFilter.ts에 순수 함수로 떼어놨다. HTTP·시크릿과 섞이면
 * 단위 테스트가 불가능해지기 때문이고, 파이프라인상 위치는 그대로 이 엔드포인트다.
 *
 * GET /api/shopping?q=맥미니
 *   200 { priceKRW, label, note, sourceUrl, sampleSize, low, high }
 *   404 쓸 만한 결과가 3개 미만
 *   429 레이트 리밋 초과
 *   503 환경변수 미설정
 */

const NAVER_ENDPOINT = 'https://openapi.naver.com/v1/search/shop.json';
const DISPLAY = 20;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT = 20; // IP당 분당
const RATE_WINDOW_MS = 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 5_000;

interface ShoppingPayload {
  priceKRW: number;
  label: string;
  note: string;
  sourceUrl: string;
  sampleSize: number;
  low: number;
  high: number;
}

const cache = new MemoryCache<ShoppingPayload>(CACHE_TTL_MS);
const limiter = new RateLimiter(RATE_LIMIT, RATE_WINDOW_MS);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET만 지원합니다' });
    return;
  }

  const query = readQuery(req.query.q);
  if (!query) {
    res.status(400).json({ error: 'q 파라미터가 필요합니다' });
    return;
  }

  if (!limiter.take(clientIp(req.headers))) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 뒤 다시 시도해주세요.' });
    return;
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.status(200).json(cached);
    return;
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: '네이버 API 자격 증명이 설정되지 않았습니다' });
    return;
  }

  let items: RawShoppingItem[];
  try {
    const url = `${NAVER_ENDPOINT}?query=${encodeURIComponent(query)}&display=${DISPLAY}&sort=sim`;
    const upstream = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `네이버 응답이 ${upstream.status}입니다` });
      return;
    }

    const body = (await upstream.json()) as { items?: RawShoppingItem[] };
    items = Array.isArray(body.items) ? body.items : [];
  } catch {
    res.status(502).json({ error: '네이버 쇼핑에 연결하지 못했습니다' });
    return;
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
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(payload);
  } catch (error) {
    if (error instanceof ShoppingRefineError) {
      // 결과가 너무 적으면 실패로 보고, 호출자가 다음 단계로 넘어가게 한다.
      res.status(404).json({ error: error.message, matchedSize: error.matchedSize });
      return;
    }
    res.status(500).json({ error: '가격을 정제하지 못했습니다' });
  }
}
