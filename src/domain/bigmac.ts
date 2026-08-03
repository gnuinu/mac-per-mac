import type { BigMacResult, Scale } from './types';

/**
 * 열량·높이·최저시급 기본값.
 * UI는 prices.json에서 읽은 값을 3번째 인자로 넘기고, 테스트는 인자 없이 호출한다.
 */
export const DEFAULT_OPTIONS = {
  caloriesPerUnit: 583,
  heightCm: 8.5,
  minimumWageKRW: 10320,
} as const;

export type BigMacOptions = {
  -readonly [K in keyof typeof DEFAULT_OPTIONS]: number;
};

/** 개수 구간별 등급 경계. 각 값은 해당 등급이 시작되는 개수(이상). */
export const SCALE_THRESHOLDS = {
  snack: 1,
  meal: 10,
  feast: 100,
  absurd: 10_000,
} as const;

export const SCALE_LABELS: Record<Scale, string> = {
  trivial: '한 개도 안 되는 금액',
  snack: '가볍게 한 끼',
  meal: '여럿이 나눠 먹을 양',
  feast: '잔치를 열 수 있는 양',
  absurd: '현실감이 사라지는 양',
};

export function scaleOf(count: number): Scale {
  if (!Number.isFinite(count) || count < SCALE_THRESHOLDS.snack) return 'trivial';
  if (count < SCALE_THRESHOLDS.meal) return 'snack';
  if (count < SCALE_THRESHOLDS.feast) return 'meal';
  if (count < SCALE_THRESHOLDS.absurd) return 'feast';
  return 'absurd';
}

/**
 * 금액을 빅맥 개수로 환산한다.
 *
 * 열량·높이는 `wholeCount`가 아니라 정확한 `count`로 계산한다. 금액을 조금
 * 올렸는데 지표가 안 움직이는 계단 현상을 피하기 위해서다. 반올림은 표시할 때만.
 *
 * @throws {RangeError} bigMacPriceKRW가 양수가 아닐 때. 설정 오류이므로 조용히
 *   삼키지 않는다. 정상 경로에서는 `parsePriceData`가 먼저 걸러낸다.
 */
export function toBigMacs(
  priceKRW: number,
  bigMacPriceKRW: number,
  options?: Partial<BigMacOptions>,
): BigMacResult {
  if (!Number.isFinite(bigMacPriceKRW) || bigMacPriceKRW <= 0) {
    throw new RangeError(
      `빅맥 가격은 0보다 큰 유한한 수여야 합니다: ${bigMacPriceKRW}`,
    );
  }

  const { caloriesPerUnit, heightCm, minimumWageKRW } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // 음수·NaN 입력은 0으로 클램프한다. 빈 입력창이나 잘못된 URL 파라미터가
  // 예외로 번지지 않게 하기 위해서다.
  const price = Number.isFinite(priceKRW) && priceKRW > 0 ? priceKRW : 0;

  const count = price / bigMacPriceKRW;
  const wholeCount = Math.floor(count);
  const remainderKRW = Math.round(price - wholeCount * bigMacPriceKRW);

  const workHours =
    Number.isFinite(minimumWageKRW) && minimumWageKRW > 0
      ? price / minimumWageKRW
      : 0;

  return {
    count,
    wholeCount,
    remainderKRW,
    calories: Math.round(count * caloriesPerUnit),
    stackHeightCm: count * heightCm,
    workHours,
    scale: scaleOf(count),
  };
}
