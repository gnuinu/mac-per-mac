import { describe, expect, it } from 'vitest';
import rawPrices from '../../../public/data/prices.json';
import { toBigMacs } from '../bigmac';
import { parsePriceData } from '../catalog';
import {
  UnknownMarketError,
  bigMacPriceKRW,
  findMarket,
  formatMarketPrice,
  formatValuation,
  groupMarkets,
  minimumWageKRW,
  resolveMarket,
  valuationGap,
} from '../market';
import type { Market } from '../types';

const KR: Market = {
  id: 'KR', name: '한국', currency: 'KRW', symbol: '원', symbolAfter: true,
  decimals: 0, bigMacPrice: 5700, fxToKRW: 1, minimumWage: 10320,
  updatedAt: '2026-02-20', source: 'x',
};

const US: Market = {
  id: 'US', name: '미국', currency: 'USD', symbol: '$',
  decimals: 2, bigMacPrice: 5.79, fxToKRW: 1385, minimumWage: 7.25,
  updatedAt: '2026-02-20', source: 'x',
};

const MARKETS = [KR, US];

describe('resolveMarket', () => {
  it('id로 찾는다', () => {
    expect(resolveMarket(MARKETS, 'US', 'KR').id).toBe('US');
  });

  it('id가 null이면 기본 나라로 떨어진다', () => {
    expect(resolveMarket(MARKETS, null, 'KR').id).toBe('KR');
  });

  // 공유 링크의 ?m=이 오타여도 앱은 돌아야 한다. 조용히 다른 나라가 되면 안 되고,
  // 그렇다고 빈 화면을 보여줄 일도 아니다.
  it('모르는 id면 기본 나라로 떨어진다', () => {
    expect(resolveMarket(MARKETS, 'ZZ', 'KR').id).toBe('KR');
  });

  it('기본 나라마저 없으면 던진다', () => {
    expect(() => resolveMarket(MARKETS, 'ZZ', 'QQ')).toThrow(UnknownMarketError);
  });

  it('findMarket은 없으면 undefined', () => {
    expect(findMarket(MARKETS, 'ZZ')).toBeUndefined();
  });
});

describe('원화 환산', () => {
  it('한국은 환율이 1이라 현지값 그대로다', () => {
    expect(bigMacPriceKRW(KR)).toBe(5700);
    expect(minimumWageKRW(KR)).toBe(10320);
  });

  it('현지가 × 환율', () => {
    expect(bigMacPriceKRW(US)).toBeCloseTo(8019.15, 2);
    expect(minimumWageKRW(US)).toBeCloseTo(10041.25, 2);
  });
});

describe('formatMarketPrice', () => {
  it.each([
    [KR, '5,700원'],
    [US, '$5.79'],
    [{ ...US, symbol: '¥', decimals: 0, bigMacPrice: 480 }, '¥480'],
    [{ ...US, symbol: '₫', decimals: 0, bigMacPrice: 79000 }, '₫79,000'],
    [{ ...US, symbol: 'CHF ', decimals: 2, bigMacPrice: 7.1 }, 'CHF 7.10'],
  ])('%#: %s', (market, expected) => {
    expect(formatMarketPrice(market as Market)).toBe(expected);
  });

  // 소수부에 자릿수 구분이 새어들어가면 "5.790,00" 같은 게 나온다.
  it('소수부는 자릿수 구분을 하지 않는다', () => {
    expect(formatMarketPrice({ ...US, bigMacPrice: 1234.5 })).toBe('$1,234.50');
  });
});

describe('valuationGap', () => {
  it('빅맥 개수 비율과 같은 값을 낸다', () => {
    const amount = 890_000;
    const here = toBigMacs(amount, bigMacPriceKRW(KR)).count;
    const there = toBigMacs(amount, bigMacPriceKRW(US)).count;
    // 화면에 이미 떠 있는 두 개수에서 그대로 떨어지는 값이어야 한다.
    expect(valuationGap(KR, US) + 1).toBeCloseTo(there / here, 10);
  });

  it('원화가 달러 대비 저평가면 음수다', () => {
    expect(valuationGap(KR, US)).toBeLessThan(0);
  });

  it('자기 자신과는 차이가 없다', () => {
    expect(valuationGap(KR, KR)).toBeCloseTo(0, 12);
  });

  it.each([
    [-0.277, '28% 저평가'],
    [0.123, '12% 고평가'],
  ])('%s → %s', (gap, expected) => {
    expect(formatValuation(gap)).toBe(expected);
  });

  it('1% 미만이면 굳이 말하지 않는다', () => {
    expect(formatValuation(0.004)).toBeNull();
  });
});

describe('실제 데이터', () => {
  const data = parsePriceData(rawPrices);

  it('기본 나라의 환율은 1이다', () => {
    const base = data.markets.find((m) => m.id === data.defaultMarketId)!;
    expect(base.fxToKRW).toBe(1);
  });

  it('모든 나라가 양수 개수를 낸다', () => {
    for (const market of data.markets) {
      const result = toBigMacs(890_000, bigMacPriceKRW(market), {
        minimumWageKRW: minimumWageKRW(market),
      });
      expect(result.count).toBeGreaterThan(0);
      expect(result.workHours).toBeGreaterThan(0);
    }
  });

  it('통화 표기가 전부 렌더링된다', () => {
    for (const market of data.markets) {
      expect(formatMarketPrice(market)).toMatch(/\d/);
    }
  });
});

describe('groupMarkets', () => {
  const era = (id: string, year: number): Market => ({
    ...KR,
    id,
    name: `${year}년 한국`,
    era: year,
  });

  it('나라와 시절을 가른다', () => {
    const { places, eras } = groupMarkets([KR, era('KR-2010', 2010), US]);
    expect(places.map((m) => m.id)).toEqual(['KR', 'US']);
    expect(eras.map((m) => m.id)).toEqual(['KR-2010']);
  });

  // 2000년보다 2023년이 먼저 궁금하다.
  it('시절은 최근이 위로 온다', () => {
    const { eras } = groupMarkets([
      era('a', 2000),
      era('b', 2023),
      era('c', 2010),
    ]);
    expect(eras.map((m) => m.era)).toEqual([2023, 2010, 2000]);
  });

  it('시절이 없으면 빈 배열', () => {
    expect(groupMarkets([KR, US]).eras).toEqual([]);
  });
});

describe('시절 데이터', () => {
  const data = parsePriceData(rawPrices);
  const { eras } = groupMarkets(data.markets);

  it('연도별 기준이 실려 있다', () => {
    expect(eras.length).toBeGreaterThanOrEqual(3);
  });

  it('시절은 전부 원화 기준이라 환율이 1이다', () => {
    for (const m of eras) expect(m.fxToKRW).toBe(1);
  });

  // 물가가 올랐다는 것이 이 기능의 요점이다. 과거일수록 빅맥이 싸야 한다.
  it('옛날일수록 빅맥이 싸다', () => {
    const base = data.markets.find((m) => m.id === data.defaultMarketId)!;
    const ordered = [...eras].sort((a, b) => a.era! - b.era!);
    const prices = [...ordered.map((m) => m.bigMacPrice), base.bigMacPrice];
    for (let i = 1; i < prices.length; i += 1) {
      expect(prices[i]!).toBeGreaterThan(prices[i - 1]!);
    }
  });

  it('같은 돈이면 옛날에 더 많이 산다', () => {
    const oldest = [...eras].sort((a, b) => a.era! - b.era!)[0]!;
    const now = toBigMacs(890_000, bigMacPriceKRW(KR)).count;
    const then = toBigMacs(890_000, bigMacPriceKRW(oldest)).count;
    expect(then).toBeGreaterThan(now);
  });
});
