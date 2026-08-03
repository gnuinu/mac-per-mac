/**
 * 네이버 쇼핑 응답을 대표가 하나로 정제하는 순수 로직.
 *
 * api/shopping.ts가 이 모듈을 호출한다. HTTP·시크릿·캐시에서 떼어놨기 때문에
 * 단위 테스트로 직접 검증할 수 있다.
 */

export interface RawShoppingItem {
  title: string;
  lprice: string | number;
  link?: string;
  mallName?: string;
  productType?: string;
}

export interface CleanShoppingItem {
  title: string;
  priceKRW: number;
  link: string;
  mallName: string;
}

export interface RefinedShopping {
  priceKRW: number;
  /** 대표가 계산에 실제로 쓰인 표본 수. */
  sampleSize: number;
  /** 필터를 통과한 전체 개수 (절사 전). */
  matchedSize: number;
  low: number;
  high: number;
  representative: CleanShoppingItem;
}

/** 제목에 이 단어가 있으면 본품이 아닐 가능성이 높아 제외한다. */
export const EXCLUDE_KEYWORDS = [
  '중고',
  '리퍼',
  '케이스',
  '커버',
  '필름',
  '보호',
  '부품',
  '렌탈',
  '대여',
  '스티커',
  '파우치',
  '거치대',
  '충전기',
  '어댑터',
  '젠더',
  '액정',
  '수리',
  '호환',
  '리뷰',
] as const;

/** 상하위 몇 %를 잘라낼지. 이상치에 끌려가지 않게 하기 위한 값. */
export const TRIM_RATIO = 0.2;

/** 이보다 적게 남으면 신뢰할 수 없다고 보고 실패 처리한다. */
export const MIN_SAMPLE_SIZE = 3;

/** 네이버 응답의 title은 <b> 태그와 HTML 엔티티를 포함한다. */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\-_/]+/g, '');
}

/** 검색어를 의미 있는 토큰으로 쪼갠다. 한 글자 토큰은 노이즈라 버린다. */
export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s\-_/,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

/**
 * 검색어와의 관련성 판정. 제외 키워드가 있으면 탈락하고, 검색어 토큰 중
 * 하나도 제목에 없으면 탈락한다.
 */
export function isRelevant(title: string, query: string): boolean {
  const lower = title.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((keyword) => lower.includes(keyword))) return false;

  const tokens = queryTokens(query);
  if (tokens.length === 0) return true;

  const normalizedTitle = normalize(title);
  return tokens.some((token) => normalizedTitle.includes(normalize(token)));
}

/** 짝수 개면 가운데 두 값의 평균. */
export function median(sorted: readonly number[]): number {
  if (sorted.length === 0) return Number.NaN;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * 상하위 TRIM_RATIO만큼 잘라낸 뒤 중앙값을 낸다.
 * 평균이 아니라 중앙값을 쓰는 이유는 묶음판매·오타 가격 같은 이상치 때문이다.
 * 절사 후 아무것도 안 남을 만큼 표본이 적으면 절사를 건너뛴다.
 */
export function trimmedMedian(values: readonly number[]): {
  value: number;
  kept: number[];
} {
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * TRIM_RATIO);
  const kept = sorted.length - cut * 2 >= 1 ? sorted.slice(cut, sorted.length - cut) : sorted;
  return { value: median(kept), kept };
}

export class ShoppingRefineError extends Error {
  constructor(
    message: string,
    readonly matchedSize: number,
  ) {
    super(message);
    this.name = 'ShoppingRefineError';
  }
}

/**
 * 원본 응답에서 대표가를 뽑는다.
 * @throws {ShoppingRefineError} 필터를 통과한 결과가 MIN_SAMPLE_SIZE 미만일 때.
 */
export function refineShoppingResults(
  items: readonly RawShoppingItem[],
  query: string,
): RefinedShopping {
  const cleaned: CleanShoppingItem[] = [];
  for (const item of items) {
    const title = cleanTitle(String(item.title ?? ''));
    const priceKRW = Number(item.lprice);
    if (!Number.isFinite(priceKRW) || priceKRW <= 0) continue;
    if (!isRelevant(title, query)) continue;
    cleaned.push({
      title,
      priceKRW,
      link: typeof item.link === 'string' ? item.link : '',
      mallName: typeof item.mallName === 'string' ? item.mallName : '',
    });
  }

  if (cleaned.length < MIN_SAMPLE_SIZE) {
    throw new ShoppingRefineError(
      `관련 있는 결과가 ${cleaned.length}개뿐입니다`,
      cleaned.length,
    );
  }

  const { value, kept } = trimmedMedian(cleaned.map((item) => item.priceKRW));

  // 대표 상품은 대표가에 가장 가까운 항목으로 고른다.
  const representative = cleaned.reduce((best, item) =>
    Math.abs(item.priceKRW - value) < Math.abs(best.priceKRW - value) ? item : best,
  );

  return {
    priceKRW: Math.round(value),
    sampleSize: kept.length,
    matchedSize: cleaned.length,
    low: kept[0]!,
    high: kept[kept.length - 1]!,
    representative,
  };
}
