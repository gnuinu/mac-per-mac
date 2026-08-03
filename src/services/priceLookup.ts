import { searchCatalog } from '../domain/catalog';
import { FALLBACK_PRICE_DATA } from '../domain/fallback';
import type { CatalogItem } from '../domain/types';

export type PriceSource = 'catalog' | 'shopping' | 'estimate';
export type PriceConfidence = 'exact' | 'market' | 'estimated';

export type PriceLookupResult = {
  priceKRW: number;
  label: string;
  source: PriceSource;
  confidence: PriceConfidence;
  /** "쇼핑몰 최저가 중앙값" 같은 설명. */
  note?: string;
  sourceUrl?: string;
};

/** UI가 "카탈로그 확인 중" 같은 문구를 띄우기 위해 구독하는 단계. */
export type LookupStage = 'catalog' | 'shopping' | 'estimate';

export const STAGE_LABELS: Record<LookupStage, string> = {
  catalog: '카탈로그 확인 중',
  shopping: '쇼핑몰 검색 중',
  estimate: '추정 중',
};

/**
 * 단계별 타임아웃(ms).
 *
 * 요청하신 값은 세 단계 모두 3초였는데, 3단계는 Claude가 웹 검색까지 돌고
 * 오므로 3초 안에 끝나는 일이 사실상 없습니다. 그대로 두면 폴백 체인의
 * 마지막 칸이 항상 죽은 코드가 되므로, 앞의 두 단계는 3초를 지키고
 * estimate만 25초로 잡았습니다. 되돌리려면 이 숫자만 3000으로 바꾸면 됩니다.
 */
export const STAGE_TIMEOUT_MS: Record<LookupStage, number> = {
  catalog: 3_000,
  shopping: 3_000,
  estimate: 25_000,
};

/** 카탈로그 퍼지 매칭 통과 기준. bigram Dice 계수. */
export const CATALOG_MATCH_THRESHOLD = 0.45;

export type PriceLookupFailure = 'unpriceable' | 'not_found';

export class PriceLookupError extends Error {
  constructor(
    readonly reason: PriceLookupFailure,
    message: string,
  ) {
    super(message);
    this.name = 'PriceLookupError';
  }
}

export interface LookupDeps {
  catalog?: readonly CatalogItem[];
  fetcher?: typeof fetch;
  onStage?: (stage: LookupStage) => void;
  signal?: AbortSignal;
  /**
   * 조회 API가 있는 곳.
   *   ''                    같은 출처 (`/api/…`). Cloudflare Pages·Vercel 기본.
   *   'https://api.example' 다른 출처. 정적 호스팅 + 외부 함수 조합.
   *   null                  원격 단계(2·3)를 아예 건너뛴다. GitHub Pages 단독.
   */
  apiBaseUrl?: string | null;
  /** 테스트에서 단계를 직접 갈아끼우기 위한 훅. */
  stages?: Partial<LookupStages>;
}

/** 원격 단계가 호출할 엔드포인트. 원격이 꺼져 있으면 null. */
function endpoint(deps: LookupDeps, path: string, query: string): string | null {
  if (deps.apiBaseUrl === null) return null;
  return `${deps.apiBaseUrl ?? ''}/api/${path}?q=${encodeURIComponent(query)}`;
}

export interface LookupStages {
  fromCatalog(query: string, deps: LookupDeps): Promise<PriceLookupResult | null>;
  fromShopping(query: string, deps: LookupDeps): Promise<PriceLookupResult | null>;
  fromEstimate(query: string, deps: LookupDeps): Promise<PriceLookupResult | null>;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-_/]+/g, '');
}

function bigrams(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length - 1; i += 1) out.push(text.slice(i, i + 2));
  return out;
}

/** Dice 계수. 1에 가까울수록 비슷하다. */
export function similarity(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  if (left.length === 0 || right.length === 0) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 1;

  const leftGrams = bigrams(left);
  const rightGrams = bigrams(right);
  if (leftGrams.length === 0 || rightGrams.length === 0) return 0;

  const pool = [...rightGrams];
  let hits = 0;
  for (const gram of leftGrams) {
    const index = pool.indexOf(gram);
    if (index >= 0) {
      pool.splice(index, 1);
      hits += 1;
    }
  }
  return (2 * hits) / (leftGrams.length + rightGrams.length);
}

/** 타임아웃을 걸고, 시간을 넘기면 거부한다. */
function withTimeout<T>(promise: Promise<T>, ms: number, stage: LookupStage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${stage} 단계가 ${ms}ms 안에 끝나지 않았습니다`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// ── 1단계: 로컬 카탈로그 ────────────────────────────────────────────────

async function fromCatalog(
  query: string,
  deps: LookupDeps,
): Promise<PriceLookupResult | null> {
  const catalog = deps.catalog ?? FALLBACK_PRICE_DATA.catalog;
  const candidates = searchCatalog(catalog, query);
  const best = candidates[0];
  if (!best) return null;
  if (similarity(best.name, query) < CATALOG_MATCH_THRESHOLD) return null;

  return {
    priceKRW: best.priceKRW,
    label: best.name,
    source: 'catalog',
    confidence: best.uncertain ? 'estimated' : 'exact',
    note: best.priceNote,
  };
}

// ── 2단계: 네이버 쇼핑 (Vercel 프록시 경유) ─────────────────────────────

interface ShoppingResponse {
  priceKRW: number;
  label: string;
  note: string;
  sourceUrl?: string;
}

async function fromShopping(
  query: string,
  deps: LookupDeps,
): Promise<PriceLookupResult | null> {
  const url = endpoint(deps, 'shopping', query);
  const fetcher = deps.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (!url || !fetcher) return null;

  const response = await fetcher(
    url,
    deps.signal ? { signal: deps.signal } : undefined,
  );
  // 404는 "쓸 만한 결과가 없다"는 정상적인 신호다. 조용히 다음 단계로.
  if (!response.ok) return null;

  const body = (await response.json()) as ShoppingResponse;
  if (!Number.isFinite(body.priceKRW) || body.priceKRW <= 0) return null;

  return {
    priceKRW: body.priceKRW,
    label: body.label || query,
    source: 'shopping',
    confidence: 'market',
    note: body.note,
    ...(body.sourceUrl ? { sourceUrl: body.sourceUrl } : {}),
  };
}

// ── 3단계: Claude 추정 ──────────────────────────────────────────────────

interface EstimateResponse {
  priceKRW: number | null;
  label: string;
  reasoning: string;
  confidence: string;
  sourceUrl?: string | null;
}

async function fromEstimate(
  query: string,
  deps: LookupDeps,
): Promise<PriceLookupResult | null> {
  const url = endpoint(deps, 'estimate', query);
  const fetcher = deps.fetcher ?? globalThis.fetch?.bind(globalThis);
  if (!url || !fetcher) return null;

  const response = await fetcher(
    url,
    deps.signal ? { signal: deps.signal } : undefined,
  );
  if (!response.ok) return null;

  const body = (await response.json()) as EstimateResponse;

  // 값을 매길 수 없다고 판단한 경우. 다음 단계가 없으므로 여기서 확정한다.
  if (body.priceKRW === null) {
    throw new PriceLookupError('unpriceable', body.reasoning || '값을 매기기 어려운 항목');
  }
  if (!Number.isFinite(body.priceKRW) || body.priceKRW <= 0) return null;

  return {
    priceKRW: body.priceKRW,
    label: body.label || query,
    source: 'estimate',
    confidence: 'estimated',
    note: body.reasoning,
    ...(body.sourceUrl ? { sourceUrl: body.sourceUrl } : {}),
  };
}

export const DEFAULT_STAGES: LookupStages = { fromCatalog, fromShopping, fromEstimate };

const PIPELINE: {
  stage: LookupStage;
  key: keyof LookupStages;
  /** 서버 함수를 필요로 하는 단계인지. */
  remote: boolean;
}[] = [
  { stage: 'catalog', key: 'fromCatalog', remote: false },
  { stage: 'shopping', key: 'fromShopping', remote: true },
  { stage: 'estimate', key: 'fromEstimate', remote: true },
];

/**
 * 카탈로그 → 쇼핑몰 → 추정 순으로 가격을 찾는다.
 *
 * 각 단계는 타임아웃이 걸려 있고, 실패하면 조용히 다음 단계로 넘어간다.
 * 세 단계가 모두 빈손이면 PriceLookupError('not_found')를 던진다.
 * 추정 단계가 "값을 매길 수 없다"고 답하면 PriceLookupError('unpriceable').
 */
export async function lookupPrice(
  query: string,
  deps: LookupDeps = {},
): Promise<PriceLookupResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new PriceLookupError('not_found', '검색어가 비어 있습니다');
  }

  const stages = { ...DEFAULT_STAGES, ...deps.stages };
  // 정적 호스팅에는 서버 함수가 없다. 있지도 않은 단계를 진행 중이라고
  // 표시했다가 실패하는 것보다, 아예 건너뛰는 편이 정직하다.
  const skipRemote = deps.apiBaseUrl === null && deps.stages === undefined;

  for (const { stage, key, remote } of PIPELINE) {
    if (remote && skipRemote) continue;
    deps.onStage?.(stage);
    try {
      const result = await withTimeout(
        stages[key](trimmed, deps),
        STAGE_TIMEOUT_MS[stage],
        stage,
      );
      if (result) return result;
    } catch (error) {
      // "값을 매길 수 없다"는 판정은 실패가 아니라 결론이므로 흘려보내지 않는다.
      if (error instanceof PriceLookupError) throw error;
      // 그 외(타임아웃·네트워크·파싱)는 조용히 다음 단계로.
    }
  }

  throw new PriceLookupError('not_found', `"${trimmed}"의 가격을 찾지 못했습니다`);
}
