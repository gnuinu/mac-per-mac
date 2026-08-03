import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, scaleOf, toBigMacs } from '../bigmac';

const BIG_MAC = 5700;

describe('toBigMacs', () => {
  it('정확한 개수와 정수 개수, 남는 돈을 함께 준다', () => {
    const result = toBigMacs(20000, BIG_MAC);
    expect(result.count).toBeCloseTo(20000 / 5700, 10);
    expect(result.wholeCount).toBe(3);
    expect(result.remainderKRW).toBe(20000 - 3 * 5700); // 2900
  });

  it('딱 나누어떨어지면 남는 돈이 0이다', () => {
    const result = toBigMacs(BIG_MAC * 4, BIG_MAC);
    expect(result.count).toBe(4);
    expect(result.wholeCount).toBe(4);
    expect(result.remainderKRW).toBe(0);
  });

  it('빅맥 값보다 적으면 정수 개수는 0, 남는 돈은 전액이다', () => {
    const result = toBigMacs(4500, BIG_MAC);
    expect(result.wholeCount).toBe(0);
    expect(result.remainderKRW).toBe(4500);
    expect(result.scale).toBe('trivial');
  });

  it('열량과 높이는 정수 개수가 아니라 정확한 개수로 계산한다', () => {
    // 계단 현상 방지: 금액을 조금 올리면 지표도 조금 움직여야 한다.
    const a = toBigMacs(BIG_MAC, BIG_MAC);
    const b = toBigMacs(BIG_MAC * 1.5, BIG_MAC);
    expect(b.wholeCount).toBe(a.wholeCount); // 둘 다 1개
    expect(b.calories).toBeGreaterThan(a.calories);
    expect(b.stackHeightCm).toBeGreaterThan(a.stackHeightCm);
    expect(b.stackHeightCm).toBeCloseTo(1.5 * DEFAULT_OPTIONS.heightCm, 10);
  });

  it('기본 상수(583kcal / 8.5cm / 10320원)를 인자 없이 쓴다', () => {
    const result = toBigMacs(BIG_MAC, BIG_MAC);
    expect(result.calories).toBe(583);
    expect(result.stackHeightCm).toBe(8.5);
    expect(result.workHours).toBeCloseTo(5700 / 10320, 10);
  });

  it('옵션으로 상수를 덮어쓸 수 있다', () => {
    const result = toBigMacs(10000, 5000, {
      caloriesPerUnit: 100,
      heightCm: 10,
      minimumWageKRW: 1000,
    });
    expect(result.calories).toBe(200);
    expect(result.stackHeightCm).toBe(20);
    expect(result.workHours).toBe(10);
  });

  it('일부 옵션만 넘기면 나머지는 기본값을 쓴다', () => {
    const result = toBigMacs(BIG_MAC, BIG_MAC, { caloriesPerUnit: 1 });
    expect(result.calories).toBe(1);
    expect(result.stackHeightCm).toBe(DEFAULT_OPTIONS.heightCm);
  });

  it('음수·NaN 금액은 0으로 클램프한다', () => {
    for (const bad of [-1000, Number.NaN]) {
      const result = toBigMacs(bad, BIG_MAC);
      expect(result.count).toBe(0);
      expect(result.wholeCount).toBe(0);
      expect(result.remainderKRW).toBe(0);
      expect(result.calories).toBe(0);
      expect(result.workHours).toBe(0);
      expect(result.scale).toBe('trivial');
    }
  });

  it('빅맥 가격이 0 이하이거나 유한하지 않으면 던진다', () => {
    for (const bad of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => toBigMacs(10000, bad)).toThrow(RangeError);
    }
  });
});

describe('scaleOf', () => {
  it.each([
    [0, 'trivial'],
    [0.99, 'trivial'],
    [1, 'snack'],
    [9.99, 'snack'],
    [10, 'meal'],
    [99.99, 'meal'],
    [100, 'feast'],
    [9_999.99, 'feast'],
    [10_000, 'absurd'],
    [1e12, 'absurd'],
  ] as const)('%s개 → %s', (count, expected) => {
    expect(scaleOf(count)).toBe(expected);
  });

  it('NaN은 trivial로 떨어진다', () => {
    expect(scaleOf(Number.NaN)).toBe('trivial');
  });
});
