import type { CatalogItem } from './types';

/**
 * 같은 돈을 빅맥 말고 다른 일상 단위로도 세어 본다.
 *
 * 빅맥 개수만으로는 "많다"는 느낌만 남는데, 아메리카노 몇 잔이고 지하철 몇 번인지
 * 나란히 놓으면 그 돈의 크기가 여러 방향에서 잡힌다. 앱이 하는 일("돈을 단위로
 * 바꾼다")을 그대로 한 번 더 하는 것이라 새 개념이 늘지 않는다.
 *
 * 세는 말은 카탈로그에 없어서 여기 둔다. 전체 48개에 다 붙이는 대신, 셈이
 * 자연스러운 것만 골랐다.
 */
export interface AltUnitSpec {
  id: string;
  counter: string;
}

export const ALT_UNITS: readonly AltUnitSpec[] = [
  { id: 'americano', counter: '잔' },
  { id: 'subway-fare', counter: '번' },
  { id: 'gimbap', counter: '줄' },
  { id: 'cup-ramen', counter: '개' },
  { id: 'movie-ticket', counter: '번' },
  { id: 'netflix', counter: '달' },
  { id: 'taxi-base', counter: '번' },
  { id: 'haircut', counter: '번' },
];

export interface AltUnitCount {
  item: CatalogItem;
  counter: string;
  /** 정수 개수. 한 개도 못 사는 단위는 애초에 걸러진다. */
  count: number;
}

/** 한 화면에 놓을 줄 수. 넘으면 지루해지고 모자라면 심심하다. */
export const ALT_UNIT_LIMIT = 4;

/**
 * 금액을 다른 단위들로 환산한다.
 *
 * 지금 보고 있는 항목 자신은 뺀다 — 아메리카노를 골라놓고 "아메리카노 1잔"을
 * 다시 보여줄 이유가 없다. 한 개도 못 사는 단위도 뺀다. "0잔"은 아무 말도
 * 하지 않으면서 자리만 차지한다.
 */
export function altUnitCounts(
  catalog: readonly CatalogItem[],
  priceKRW: number,
  excludeId: string | null = null,
  limit: number = ALT_UNIT_LIMIT,
): AltUnitCount[] {
  if (!Number.isFinite(priceKRW) || priceKRW <= 0) return [];

  const out: AltUnitCount[] = [];
  for (const spec of ALT_UNITS) {
    if (out.length >= limit) break;
    if (spec.id === excludeId) continue;

    const item = catalog.find((entry) => entry.id === spec.id);
    if (!item || item.priceKRW <= 0) continue;

    const count = Math.floor(priceKRW / item.priceKRW);
    if (count < 1) continue;

    out.push({ item, counter: spec.counter, count });
  }
  return out;
}
