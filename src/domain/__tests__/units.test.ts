import { describe, expect, it } from 'vitest';
import rawPrices from '../../../public/data/prices.json';
import { parsePriceData } from '../catalog';
import { ALT_UNITS, ALT_UNIT_LIMIT, altUnitCounts } from '../units';
import type { CatalogItem } from '../types';

const data = parsePriceData(rawPrices);

const items: CatalogItem[] = [
  { id: 'americano', name: '아메리카노', priceKRW: 4500, category: '소소한 것', emoji: '☕', priceNote: 'x' },
  { id: 'subway-fare', name: '지하철', priceKRW: 1550, category: '소소한 것', emoji: '🚇', priceNote: 'x' },
  { id: 'gimbap', name: '김밥', priceKRW: 4000, category: '소소한 것', emoji: '🍙', priceNote: 'x' },
];

describe('ALT_UNITS', () => {
  it('전부 실제 카탈로그에 있는 id다', () => {
    for (const spec of ALT_UNITS) {
      expect(data.catalog.find((i) => i.id === spec.id), spec.id).toBeDefined();
    }
  });

  it('id가 겹치지 않는다', () => {
    expect(new Set(ALT_UNITS.map((s) => s.id)).size).toBe(ALT_UNITS.length);
  });

  // 목록이 줄어들 수 있으니(제외·0개) 한도보다 넉넉히 갖고 있어야 한다.
  it('한도보다 여유 있게 준비돼 있다', () => {
    expect(ALT_UNITS.length).toBeGreaterThan(ALT_UNIT_LIMIT);
  });
});

describe('altUnitCounts', () => {
  it('금액을 각 단위로 나눠 내림한다', () => {
    const out = altUnitCounts(items, 10_000);
    expect(out.map((u) => [u.item.id, u.count])).toEqual([
      ['americano', 2],
      ['subway-fare', 6],
      ['gimbap', 2],
    ]);
  });

  // 아메리카노를 보고 있는데 "아메리카노 1잔"을 또 보여줄 이유가 없다.
  it('보고 있는 항목은 뺀다', () => {
    const out = altUnitCounts(items, 10_000, 'americano');
    expect(out.map((u) => u.item.id)).toEqual(['subway-fare', 'gimbap']);
  });

  // "0잔"은 아무 말도 하지 않으면서 자리만 차지한다.
  it('한 개도 못 사는 단위는 뺀다', () => {
    const out = altUnitCounts(items, 2_000);
    expect(out.map((u) => u.item.id)).toEqual(['subway-fare']);
  });

  it('한도를 넘지 않는다', () => {
    expect(altUnitCounts(items, 1_000_000, null, 2)).toHaveLength(2);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '금액이 %s면 빈 목록',
    (bad) => {
      expect(altUnitCounts(items, bad)).toEqual([]);
    },
  );

  it('카탈로그에 없는 id는 조용히 건너뛴다', () => {
    expect(altUnitCounts([], 10_000)).toEqual([]);
  });

  it('실제 데이터로 한도만큼 채워진다', () => {
    expect(altUnitCounts(data.catalog, 890_000)).toHaveLength(ALT_UNIT_LIMIT);
  });
});
