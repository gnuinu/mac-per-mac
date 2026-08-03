import type { Market } from './types';

/**
 * 비교 대상 나라를 다루는 순수 함수들.
 *
 * 핵심은 이 파일이 bigmac.ts를 전혀 건드리지 않는다는 것이다. `toBigMacs`는
 * "원화 금액 ÷ 원화 빅맥 가격"만 알면 되고, 나라를 바꾸는 일은 그 두 번째 인자를
 * 바꿔 넣는 일에 지나지 않는다. 최저시급도 마찬가지로 옵션 인자로 들어간다.
 */

/** 나라를 못 찾았을 때. 잘못된 ?m= 값이 조용히 다른 나라로 둔갑하지 않게 한다. */
export class UnknownMarketError extends Error {
  constructor(id: string) {
    super(`알 수 없는 나라입니다: ${id}`);
    this.name = 'UnknownMarketError';
  }
}

export function findMarket(
  markets: readonly Market[],
  id: string,
): Market | undefined {
  return markets.find((m) => m.id === id);
}

/**
 * id로 나라를 고르되, 없으면 기본 나라로 떨어진다.
 * 공유 링크의 ?m=이 오타거나 목록에서 빠진 나라를 가리켜도 앱은 계속 돌아야 한다.
 */
export function resolveMarket(
  markets: readonly Market[],
  id: string | null,
  fallbackId: string,
): Market {
  const picked = id === null ? undefined : findMarket(markets, id);
  if (picked) return picked;

  const fallback = findMarket(markets, fallbackId);
  if (!fallback) throw new UnknownMarketError(fallbackId);
  return fallback;
}

/** 그 나라 빅맥 한 개의 원화 가격. */
export function bigMacPriceKRW(market: Market): number {
  return market.bigMacPrice * market.fxToKRW;
}

/** 그 나라 최저시급의 원화 환산. toBigMacs의 minimumWageKRW 옵션으로 넘어간다. */
export function minimumWageKRW(market: Market): number {
  return market.minimumWage * market.fxToKRW;
}

/**
 * 현지 통화 표기. `Intl.NumberFormat`을 쓰지 않는 이유는 결과가 ICU 버전에 따라
 * "$5.69"와 "US$5.69"를 오가서, 같은 코드가 환경에 따라 다른 문자열을 내놓기
 * 때문이다. 표기 규칙이 나라 데이터에 있으면 테스트가 결정적으로 된다.
 */
export function formatMarketPrice(market: Market): string {
  const n = market.bigMacPrice.toFixed(market.decimals);
  // 소수부는 자릿수 구분을 하지 않는다.
  const [whole = '', fraction] = n.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const amount = fraction ? `${grouped}.${fraction}` : grouped;
  return market.symbolAfter ? `${amount}${market.symbol}` : `${market.symbol}${amount}`;
}

/**
 * 빅맥 지수. 기준 나라 통화가 상대 나라 통화 대비 얼마나 저/고평가돼 있는지를
 * 빅맥 가격만으로 추정한다.
 *
 * 빅맥으로 환산한 구매력비(implied)와 실제 환율(market)을 견주는 것인데,
 * 같은 돈으로 살 수 있는 개수의 비율과 정확히 같은 값이다. 그래서 화면에 이미
 * 떠 있는 두 개수에서 그대로 떨어진다.
 *
 * 음수면 기준 통화가 저평가(같은 돈으로 상대 나라에서 빅맥을 덜 산다).
 */
export function valuationGap(base: Market, other: Market): number {
  const impliedRate = base.bigMacPrice / other.bigMacPrice;
  const marketRate = other.fxToKRW / base.fxToKRW;
  return impliedRate / marketRate - 1;
}

/** "28% 저평가" / "12% 고평가". 0에 가까우면 null (굳이 말할 게 없다). */
export function formatValuation(gap: number): string | null {
  const pct = Math.round(Math.abs(gap) * 100);
  if (pct < 1) return null;
  return `${pct}% ${gap < 0 ? '저평가' : '고평가'}`;
}
