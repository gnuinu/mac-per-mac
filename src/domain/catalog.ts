import { normalize, toChosung, isChosungOnly } from './hangul';
import { bigMacPriceKRW, minimumWageKRW } from './market';
import type { Category, CatalogItem, Market, PriceData } from './types';

export const PRICES_URL = '/data/prices.json';

/** 빈 상태에서 칩으로 노출할 인기 항목. 스케일 구간을 골고루 밟도록 골랐다. */
export const POPULAR_IDS = [
  'americano',
  'mac-mini',
  'iphone-17-pro',
  'grandeur',
  'seoul-apartment',
  'lotto',
] as const;

const CATEGORIES: readonly Category[] = [
  '전자기기',
  '탈것',
  '부동산/생활',
  '밈/스케일',
  '소소한 것',
];

export class PriceDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriceDataError';
  }
}

function requirePositiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PriceDataError(`${path}는 0보다 큰 수여야 합니다: ${String(value)}`);
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new PriceDataError(`${path}는 비어 있지 않은 문자열이어야 합니다`);
  }
  return value;
}

function parseCatalogItem(raw: unknown, index: number): CatalogItem {
  const path = `catalog[${index}]`;
  if (typeof raw !== 'object' || raw === null) {
    throw new PriceDataError(`${path}가 객체가 아닙니다`);
  }
  const o = raw as Record<string, unknown>;

  const category = requireString(o.category, `${path}.category`);
  if (!CATEGORIES.includes(category as Category)) {
    throw new PriceDataError(`${path}.category가 알 수 없는 값입니다: ${category}`);
  }

  return {
    id: requireString(o.id, `${path}.id`),
    name: requireString(o.name, `${path}.name`),
    priceKRW: requirePositiveNumber(o.priceKRW, `${path}.priceKRW`),
    category: category as Category,
    emoji: requireString(o.emoji, `${path}.emoji`),
    priceNote: requireString(o.priceNote, `${path}.priceNote`),
    ...(o.uncertain === true ? { uncertain: true } : {}),
  };
}

function parseMarket(raw: unknown, index: number): Market {
  const path = `markets[${index}]`;
  if (typeof raw !== 'object' || raw === null) {
    throw new PriceDataError(`${path}가 객체가 아닙니다`);
  }
  const o = raw as Record<string, unknown>;

  const decimals = o.decimals;
  if (
    typeof decimals !== 'number' ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 4
  ) {
    throw new PriceDataError(`${path}.decimals는 0~4의 정수여야 합니다`);
  }

  return {
    id: requireString(o.id, `${path}.id`),
    name: requireString(o.name, `${path}.name`),
    currency: requireString(o.currency, `${path}.currency`),
    symbol: requireString(o.symbol, `${path}.symbol`),
    decimals,
    bigMacPrice: requirePositiveNumber(o.bigMacPrice, `${path}.bigMacPrice`),
    fxToKRW: requirePositiveNumber(o.fxToKRW, `${path}.fxToKRW`),
    minimumWage: requirePositiveNumber(o.minimumWage, `${path}.minimumWage`),
    updatedAt: requireString(o.updatedAt, `${path}.updatedAt`),
    source: requireString(o.source, `${path}.source`),
    ...(o.symbolAfter === true ? { symbolAfter: true } : {}),
    ...(typeof o.era === 'number' && Number.isInteger(o.era) ? { era: o.era } : {}),
    ...(o.uncertain === true ? { uncertain: true } : {}),
    ...(typeof o.note === 'string' && o.note ? { note: o.note } : {}),
  };
}

/**
 * 원격에서 받은 값을 검증해 PriceData로 만든다.
 * 잘못된 데이터로 앱 전체가 이상해지느니 여기서 던지고 fallback을 쓴다.
 */
export function parsePriceData(raw: unknown): PriceData {
  if (typeof raw !== 'object' || raw === null) {
    throw new PriceDataError('가격 데이터가 객체가 아닙니다');
  }
  const o = raw as Record<string, unknown>;

  const bigMacRaw = o.bigMac;
  if (typeof bigMacRaw !== 'object' || bigMacRaw === null) {
    throw new PriceDataError('bigMac 필드가 없습니다');
  }
  const b = bigMacRaw as Record<string, unknown>;

  if (!Array.isArray(o.catalog)) {
    throw new PriceDataError('catalog가 배열이 아닙니다');
  }

  const catalog = o.catalog.map(parseCatalogItem);
  const seen = new Set<string>();
  for (const item of catalog) {
    if (seen.has(item.id)) {
      throw new PriceDataError(`catalog에 중복된 id가 있습니다: ${item.id}`);
    }
    seen.add(item.id);
  }

  if (!Array.isArray(o.markets) || o.markets.length === 0) {
    throw new PriceDataError('markets가 비어 있지 않은 배열이 아닙니다');
  }
  const markets = o.markets.map(parseMarket);
  const marketIds = new Set<string>();
  for (const market of markets) {
    if (marketIds.has(market.id)) {
      throw new PriceDataError(`markets에 중복된 id가 있습니다: ${market.id}`);
    }
    marketIds.add(market.id);
  }

  const defaultMarketId = requireString(o.defaultMarket, 'defaultMarket');
  const base = markets.find((m) => m.id === defaultMarketId);
  if (!base) {
    throw new PriceDataError(
      `defaultMarket이 markets에 없습니다: ${defaultMarketId}`,
    );
  }

  return {
    /*
     * bigMac·minimumWageKRW는 기본 나라에서 파생시킨다. JSON의 진실은 markets
     * 한 벌뿐이라 두 값이 조용히 어긋날 수 없고, 나라를 모르는 기존 소비자는
     * 예전 필드를 그대로 읽으면 된다.
     */
    bigMac: {
      priceKRW: bigMacPriceKRW(base),
      updatedAt: base.updatedAt,
      source: base.source,
      caloriesPerUnit: requirePositiveNumber(
        b.caloriesPerUnit,
        'bigMac.caloriesPerUnit',
      ),
      heightCm: requirePositiveNumber(b.heightCm, 'bigMac.heightCm'),
    },
    minimumWageKRW: minimumWageKRW(base),
    catalog,
    markets,
    defaultMarketId,
  };
}

export type PriceOrigin = 'remote' | 'fallback';

export interface LoadPricesResult {
  data: PriceData;
  origin: PriceOrigin;
  /** 원격 로드가 실패했을 때의 사유. 성공 시 null. */
  error: Error | null;
}

export interface LoadPricesOptions {
  url?: string;
  /** 주입 가능. 도메인이 전역 fetch에 직접 묶이지 않게 하고 테스트를 쉽게 한다. */
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  /** 원격 실패 시 쓸 데이터. */
  fallback: PriceData;
}

/**
 * 가격 데이터를 불러온다. 실패하면 조용히 fallback으로 떨어진다.
 *
 * 2단계에서 외부 가격 API를 붙일 지점이 바로 여기다. `url`을 바꾸거나
 * `fetcher`를 갈아끼우면 UI 수정 없이 전환된다.
 */
export async function loadPrices(
  options: LoadPricesOptions,
): Promise<LoadPricesResult> {
  const {
    url = PRICES_URL,
    fetcher = globalThis.fetch?.bind(globalThis),
    signal,
    fallback,
  } = options;

  try {
    if (!fetcher) throw new Error('fetch를 쓸 수 없는 환경입니다');
    const response = await fetcher(url, signal ? { signal } : undefined);
    if (!response.ok) {
      throw new Error(`가격 데이터 응답이 ${response.status}입니다`);
    }
    return { data: parsePriceData(await response.json()), origin: 'remote', error: null };
  } catch (error) {
    return {
      data: fallback,
      origin: 'fallback',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

export function findById(
  items: readonly CatalogItem[],
  id: string,
): CatalogItem | undefined {
  return items.find((item) => item.id === id);
}

export function popularItems(items: readonly CatalogItem[]): CatalogItem[] {
  return POPULAR_IDS.map((id) => findById(items, id)).filter(
    (item): item is CatalogItem => item !== undefined,
  );
}

/** 낮을수록 먼저. 정확 > 접두 > 부분 > 초성 > 카테고리 순. */
function rank(item: CatalogItem, query: string): number {
  const name = normalize(item.name);
  const q = normalize(query);

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 2;
  if (isChosungOnly(q)) {
    const chosung = toChosung(item.name).toLowerCase();
    if (chosung.startsWith(q)) return 3;
    if (chosung.includes(q)) return 4;
  }
  if (normalize(item.category).includes(q)) return 5;
  return Number.POSITIVE_INFINITY;
}

/**
 * 카탈로그를 검색한다. 부분 일치·초성 일치·카테고리 일치를 모두 보고,
 * 관련도 순으로 정렬한다. 동점이면 원래 순서를 유지한다.
 */
export function searchCatalog(
  items: readonly CatalogItem[],
  query: string,
): CatalogItem[] {
  const q = query.trim();
  if (q.length === 0) return [...items];

  return items
    .map((item, index) => ({ item, index, rank: rank(item, q) }))
    .filter((entry) => Number.isFinite(entry.rank))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}
