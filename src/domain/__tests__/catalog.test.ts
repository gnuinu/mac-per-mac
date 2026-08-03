import { describe, expect, it, vi } from 'vitest';
import rawPrices from '../../../public/data/prices.json';
import {
  PriceDataError,
  findById,
  loadPrices,
  parsePriceData,
  popularItems,
  searchCatalog,
} from '../catalog';
import { FALLBACK_PRICE_DATA } from '../fallback';
import type { CatalogItem } from '../types';

const items: CatalogItem[] = [
  { id: 'a', name: '맥 미니 M4', priceKRW: 890000, category: '전자기기', emoji: '🖥️', priceNote: 'x' },
  { id: 'b', name: '맥북 프로 16인치', priceKRW: 3690000, category: '전자기기', emoji: '💻', priceNote: 'x' },
  { id: 'c', name: '아메리카노', priceKRW: 4500, category: '소소한 것', emoji: '☕', priceNote: 'x' },
  { id: 'd', name: '그랜저', priceKRW: 38000000, category: '탈것', emoji: '🚘', priceNote: 'x' },
];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('parsePriceData', () => {
  it('실제 public/data/prices.json을 통과시킨다', () => {
    const data = parsePriceData(rawPrices);
    expect(data.bigMac.priceKRW).toBeGreaterThan(0);
    expect(data.catalog.length).toBeGreaterThanOrEqual(40);
    expect(data.catalog.length).toBeLessThanOrEqual(60);
  });

  it('다섯 카테고리를 모두 담고 있다', () => {
    const data = parsePriceData(rawPrices);
    const categories = new Set(data.catalog.map((item) => item.category));
    expect(categories).toEqual(
      new Set(['전자기기', '탈것', '부동산/생활', '밈/스케일', '소소한 것']),
    );
  });

  it('fallback 상수는 원본 JSON과 같은 내용이다', () => {
    expect(FALLBACK_PRICE_DATA).toEqual(parsePriceData(rawPrices));
  });

  it.each([
    ['객체가 아님', 'nope'],
    ['bigMac 없음', { minimumWageKRW: 1, catalog: [] }],
    ['catalog가 배열이 아님', { bigMac: {}, minimumWageKRW: 1, catalog: {} }],
  ])('%s이면 던진다', (_label, bad) => {
    expect(() => parsePriceData(bad)).toThrow(PriceDataError);
  });

  it('빅맥 가격이 0이면 던진다', () => {
    const bad = { ...rawPrices, bigMac: { ...rawPrices.bigMac, priceKRW: 0 } };
    expect(() => parsePriceData(bad)).toThrow(PriceDataError);
  });

  it('알 수 없는 카테고리는 던진다', () => {
    const bad = {
      ...rawPrices,
      catalog: [{ ...rawPrices.catalog[0], category: '우주' }],
    };
    expect(() => parsePriceData(bad)).toThrow(PriceDataError);
  });

  it('중복 id는 던진다', () => {
    const first = rawPrices.catalog[0];
    expect(() => parsePriceData({ ...rawPrices, catalog: [first, first] })).toThrow(
      /중복된 id/,
    );
  });
});

describe('loadPrices', () => {
  it('성공하면 remote로 표시한다', async () => {
    const fetcher = vi.fn(async () => jsonResponse(rawPrices));
    const result = await loadPrices({
      fetcher: fetcher as unknown as typeof fetch,
      fallback: FALLBACK_PRICE_DATA,
    });
    expect(result.origin).toBe('remote');
    expect(result.error).toBeNull();
    expect(fetcher).toHaveBeenCalledWith('/data/prices.json', undefined);
  });

  it('네트워크 오류면 fallback으로 떨어진다', async () => {
    const result = await loadPrices({
      fetcher: (async () => {
        throw new Error('offline');
      }) as unknown as typeof fetch,
      fallback: FALLBACK_PRICE_DATA,
    });
    expect(result.origin).toBe('fallback');
    expect(result.data).toBe(FALLBACK_PRICE_DATA);
    expect(result.error?.message).toBe('offline');
  });

  it('HTTP 오류면 fallback으로 떨어진다', async () => {
    const result = await loadPrices({
      fetcher: (async () => jsonResponse(null, false, 404)) as unknown as typeof fetch,
      fallback: FALLBACK_PRICE_DATA,
    });
    expect(result.origin).toBe('fallback');
    expect(result.error?.message).toContain('404');
  });

  it('스키마가 깨진 응답이면 fallback으로 떨어진다', async () => {
    const result = await loadPrices({
      fetcher: (async () => jsonResponse({ hello: 'world' })) as unknown as typeof fetch,
      fallback: FALLBACK_PRICE_DATA,
    });
    expect(result.origin).toBe('fallback');
    expect(result.error).toBeInstanceOf(PriceDataError);
  });

  it('url을 바꿔 다른 소스를 가리킬 수 있다', async () => {
    const fetcher = vi.fn(async () => jsonResponse(rawPrices));
    await loadPrices({
      url: 'https://example.test/prices.json',
      fetcher: fetcher as unknown as typeof fetch,
      fallback: FALLBACK_PRICE_DATA,
    });
    expect(fetcher).toHaveBeenCalledWith('https://example.test/prices.json', undefined);
  });
});

describe('searchCatalog', () => {
  it('빈 검색어는 전체를 돌려준다', () => {
    expect(searchCatalog(items, '  ')).toHaveLength(items.length);
  });

  it('부분 일치로 거른다', () => {
    expect(searchCatalog(items, '맥').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('접두 일치가 부분 일치보다 앞선다', () => {
    const extra = [...items, { ...items[0]!, id: 'e', name: '애플 맥 미니' }];
    expect(searchCatalog(extra, '맥 미니')[0]!.id).toBe('a');
  });

  it('정확 일치가 최우선', () => {
    expect(searchCatalog(items, '그랜저')[0]!.id).toBe('d');
  });

  it('초성으로 찾는다', () => {
    expect(searchCatalog(items, 'ㅁㅂ').map((i) => i.id)).toEqual(['b']);
    expect(searchCatalog(items, 'ㅇㅁㄹㅋㄴ').map((i) => i.id)).toEqual(['c']);
  });

  it('카테고리로도 찾는다', () => {
    expect(searchCatalog(items, '전자기기').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('안 맞으면 빈 배열', () => {
    expect(searchCatalog(items, 'zzzz')).toEqual([]);
  });
});

describe('findById / popularItems', () => {
  it('id로 찾는다', () => {
    expect(findById(items, 'c')?.name).toBe('아메리카노');
    expect(findById(items, 'nope')).toBeUndefined();
  });

  it('인기 항목이 실제 카탈로그에 모두 존재한다', () => {
    expect(popularItems(FALLBACK_PRICE_DATA.catalog)).toHaveLength(6);
  });
});
