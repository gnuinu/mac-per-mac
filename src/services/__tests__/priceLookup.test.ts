import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PriceLookupError,
  STAGE_TIMEOUT_MS,
  lookupPrice,
  similarity,
  type LookupStages,
  type PriceLookupResult,
} from '../priceLookup';
import type { CatalogItem } from '../../domain/types';

const catalog: CatalogItem[] = [
  {
    id: 'mac-mini',
    name: '맥 미니 M4',
    priceKRW: 890000,
    category: '전자기기',
    emoji: '🖥️',
    priceNote: '2026년 2월 기준',
  },
  {
    id: 'americano',
    name: '아메리카노',
    priceKRW: 4500,
    category: '소소한 것',
    emoji: '☕',
    priceNote: '프랜차이즈 기준',
  },
];

const CATALOG_HIT: PriceLookupResult = {
  priceKRW: 1,
  label: 'catalog',
  source: 'catalog',
  confidence: 'exact',
};
const SHOPPING_HIT: PriceLookupResult = {
  priceKRW: 2,
  label: 'shopping',
  source: 'shopping',
  confidence: 'market',
};
const ESTIMATE_HIT: PriceLookupResult = {
  priceKRW: 3,
  label: 'estimate',
  source: 'estimate',
  confidence: 'estimated',
};

/** 각 단계를 성공/빈손/예외/무한대기 중 하나로 모킹한다. */
function stubStages(
  plan: Record<
    keyof LookupStages,
    PriceLookupResult | null | Error | 'hang'
  >,
): { stages: LookupStages; calls: string[] } {
  const calls: string[] = [];
  const make =
    (key: keyof LookupStages) =>
    async (): Promise<PriceLookupResult | null> => {
      calls.push(key);
      const outcome = plan[key];
      if (outcome === 'hang') return new Promise(() => {});
      if (outcome instanceof Error) throw outcome;
      return outcome;
    };

  return {
    calls,
    stages: {
      fromCatalog: make('fromCatalog'),
      fromShopping: make('fromShopping'),
      fromEstimate: make('fromEstimate'),
    },
  };
}

describe('lookupPrice 폴백 순서', () => {
  it('1번이 성공하면 즉시 반환하고 2·3번은 부르지 않는다', async () => {
    const { stages, calls } = stubStages({
      fromCatalog: CATALOG_HIT,
      fromShopping: SHOPPING_HIT,
      fromEstimate: ESTIMATE_HIT,
    });

    const result = await lookupPrice('맥 미니', { stages });

    expect(result.source).toBe('catalog');
    expect(calls).toEqual(['fromCatalog']);
  });

  it('1번 실패 → 2번 성공', async () => {
    const { stages, calls } = stubStages({
      fromCatalog: null,
      fromShopping: SHOPPING_HIT,
      fromEstimate: ESTIMATE_HIT,
    });

    const result = await lookupPrice('무선 이어폰', { stages });

    expect(result.source).toBe('shopping');
    expect(calls).toEqual(['fromCatalog', 'fromShopping']);
  });

  it('1·2번 실패 → 3번 성공', async () => {
    const { stages, calls } = stubStages({
      fromCatalog: null,
      fromShopping: null,
      fromEstimate: ESTIMATE_HIT,
    });

    const result = await lookupPrice('에펠탑', { stages });

    expect(result.source).toBe('estimate');
    expect(calls).toEqual(['fromCatalog', 'fromShopping', 'fromEstimate']);
  });

  it('예외를 던진 단계도 조용히 넘어간다', async () => {
    const { stages, calls } = stubStages({
      fromCatalog: new Error('boom'),
      fromShopping: new Error('네트워크 오류'),
      fromEstimate: ESTIMATE_HIT,
    });

    const result = await lookupPrice('국회의원 연봉', { stages });

    expect(result.source).toBe('estimate');
    expect(calls).toHaveLength(3);
  });

  it('세 단계가 모두 빈손이면 not_found로 던진다', async () => {
    const { stages } = stubStages({
      fromCatalog: null,
      fromShopping: null,
      fromEstimate: null,
    });

    await expect(lookupPrice('알 수 없는 무언가', { stages })).rejects.toMatchObject({
      name: 'PriceLookupError',
      reason: 'not_found',
    });
  });

  it('빈 검색어는 단계를 돌지 않고 바로 던진다', async () => {
    const { stages, calls } = stubStages({
      fromCatalog: CATALOG_HIT,
      fromShopping: null,
      fromEstimate: null,
    });

    await expect(lookupPrice('   ', { stages })).rejects.toThrow(PriceLookupError);
    expect(calls).toEqual([]);
  });

  it('단계 진행을 onStage로 알린다', async () => {
    const seen: string[] = [];
    const { stages } = stubStages({
      fromCatalog: null,
      fromShopping: null,
      fromEstimate: ESTIMATE_HIT,
    });

    await lookupPrice('누리호', { stages, onStage: (stage) => seen.push(stage) });

    expect(seen).toEqual(['catalog', 'shopping', 'estimate']);
  });

  it('"값을 매길 수 없음"은 폴백하지 않고 그대로 올라온다', async () => {
    const { stages } = stubStages({
      fromCatalog: null,
      fromShopping: null,
      fromEstimate: new PriceLookupError('unpriceable', '값을 매기기 어려움'),
    });

    await expect(lookupPrice('행복', { stages })).rejects.toMatchObject({
      reason: 'unpriceable',
    });
  });
});

describe('lookupPrice 타임아웃', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('멈춰 있는 단계는 타임아웃 뒤 다음 단계로 넘어간다', async () => {
    const { stages, calls } = stubStages({
      fromCatalog: 'hang',
      fromShopping: SHOPPING_HIT,
      fromEstimate: ESTIMATE_HIT,
    });

    const pending = lookupPrice('맥북', { stages });
    await vi.advanceTimersByTimeAsync(STAGE_TIMEOUT_MS.catalog + 1);

    await expect(pending).resolves.toMatchObject({ source: 'shopping' });
    expect(calls).toEqual(['fromCatalog', 'fromShopping']);
  });

  it('모든 단계가 멈춰 있으면 결국 not_found', async () => {
    const { stages } = stubStages({
      fromCatalog: 'hang',
      fromShopping: 'hang',
      fromEstimate: 'hang',
    });

    const pending = lookupPrice('무한대기', { stages });
    const assertion = expect(pending).rejects.toMatchObject({ reason: 'not_found' });

    await vi.advanceTimersByTimeAsync(
      STAGE_TIMEOUT_MS.catalog + STAGE_TIMEOUT_MS.shopping + STAGE_TIMEOUT_MS.estimate + 3,
    );
    await assertion;
  });
});

describe('1단계 카탈로그 매칭 (실제 구현)', () => {
  it('이름이 충분히 비슷하면 카탈로그에서 바로 답한다', async () => {
    const result = await lookupPrice('맥 미니 M4', { catalog });
    expect(result).toMatchObject({
      priceKRW: 890000,
      source: 'catalog',
      confidence: 'exact',
      label: '맥 미니 M4',
    });
  });

  it('초성으로도 카탈로그를 맞힌다', async () => {
    const result = await lookupPrice('아메리카노', { catalog });
    expect(result.source).toBe('catalog');
  });

  it('카탈로그에 없으면 다음 단계로 넘어간다', async () => {
    // 쇼핑·추정 단계는 fetcher가 없으므로 null을 돌려주고, 결국 not_found.
    await expect(
      lookupPrice('한 번도 본 적 없는 물건', { catalog, fetcher: undefined }),
    ).rejects.toMatchObject({ reason: 'not_found' });
  });

  it('uncertain 항목은 confidence를 estimated로 낮춘다', async () => {
    const result = await lookupPrice('맥 미니 M4', {
      catalog: [{ ...catalog[0]!, uncertain: true }],
    });
    expect(result.confidence).toBe('estimated');
  });
});

describe('similarity', () => {
  it('완전히 같으면 1', () => {
    expect(similarity('맥 미니', '맥미니')).toBe(1);
  });

  it('부분 문자열도 1로 본다', () => {
    expect(similarity('맥 미니 M4', '맥 미니')).toBe(1);
  });

  it('전혀 다르면 0에 가깝다', () => {
    expect(similarity('아메리카노', '헬리콥터')).toBeLessThan(0.2);
  });
});
