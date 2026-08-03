import { describe, expect, it } from 'vitest';
import {
  formatCalories,
  formatCount,
  formatHeight,
  formatKoreanNumber,
  formatWon,
  formatWorkTime,
} from '../format';

describe('formatKoreanNumber', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [999, '999'],
    [5_700, '5,700'],
    [9_999, '9,999'],
    [10_000, '1만'],
    [12_345, '1만 2,345'],
    [100_000, '10만'],
    [1_000_000, '100만'],
    [99_999_999, '9,999만 9,999'],
    [100_000_000, '1억'],
    [320_000_000, '3억 2,000만'],
    [1_270_000_000, '12억 7,000만'],
    [1_234_567_890_000, '1조 2,345억'],
    [500_000_000_000_000, '500조'],
  ])('%d → %s', (input, expected) => {
    expect(formatKoreanNumber(input)).toBe(expected);
  });

  it('세 번째 이하 그룹은 잘라낸다', () => {
    // 1억 2,345만 6,789 → 위에서 두 그룹만
    expect(formatKoreanNumber(123_456_789)).toBe('1억 2,345만');
  });

  it('중간 그룹이 0이면 "1억 0만" 대신 생략한다', () => {
    expect(formatKoreanNumber(100_002_345)).toBe('1억');
  });

  it('소수는 반올림한다', () => {
    expect(formatKoreanNumber(2.4)).toBe('2');
    expect(formatKoreanNumber(2.6)).toBe('3');
  });

  it('음수는 부호를 붙인다', () => {
    expect(formatKoreanNumber(-12_345)).toBe('-1만 2,345');
  });

  it('유한하지 않은 값은 0으로 돌린다', () => {
    expect(formatKoreanNumber(Number.NaN)).toBe('0');
    expect(formatKoreanNumber(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('단위 접미사', () => {
  it('개수·금액·열량', () => {
    expect(formatCount(12_345)).toBe('1만 2,345개');
    expect(formatWon(5_700)).toBe('5,700원');
    expect(formatCalories(1_234_567)).toBe('123만 4,567kcal');
  });
});

describe('formatHeight', () => {
  it('100cm 미만은 cm로', () => {
    expect(formatHeight(8.5).value).toBe('8.5cm');
    expect(formatHeight(85).value).toBe('85cm');
  });

  it('1km 미만은 m로', () => {
    expect(formatHeight(2_120).value).toBe('21.2m');
    expect(formatHeight(100).value).toBe('1m');
  });

  it('1km 이상은 km로', () => {
    expect(formatHeight(250_000).value).toBe('2.5km');
    expect(formatHeight(884_800).value).toBe('8.8km');
  });

  it('아주 큰 높이는 km에 한국식 단위를 쓴다', () => {
    expect(formatHeight(1_000_000_000).value).toBe('1만km');
  });

  it('비율이 1 이상이면 "N개 높이"', () => {
    // 63빌딩 249m × 2 = 498m — 아직 롯데월드타워(555m)에 못 미친다.
    expect(formatHeight(49_800).analogy).toBe('63빌딩 2개 높이');
  });

  it('비율이 1 이상인 랜드마크 중 가장 큰 것을 고른다', () => {
    // 597.6m는 롯데월드타워를 넘겼으므로 63빌딩이 아니라 롯데월드타워로 잰다.
    expect(formatHeight(59_760).analogy).toBe('롯데월드타워 1.1개 높이');
  });

  it('가장 작은 랜드마크보다 낮으면 "~의 N배"', () => {
    expect(formatHeight(4.25).analogy).toBe('빅맥의 0.5배');
  });

  it('사다리 위쪽 랜드마크도 고른다', () => {
    // 에베레스트 8848m
    expect(formatHeight(884_800 * 3).analogy).toBe('에베레스트 3개 높이');
  });

  it('0이면 빈 상태 문구를 준다', () => {
    expect(formatHeight(0).value).toBe('0cm');
    expect(formatHeight(0).analogy).toBe('아직 아무것도 안 쌓았어요');
  });
});

describe('formatWorkTime', () => {
  it('1시간 미만은 분으로', () => {
    expect(formatWorkTime(0.5)).toEqual({ text: '30분', note: '' });
  });

  it('0 이하는 0분', () => {
    expect(formatWorkTime(0)).toEqual({ text: '0분', note: '' });
    expect(formatWorkTime(-5)).toEqual({ text: '0분', note: '' });
  });

  it('하루 근무시간 미만은 시간+분', () => {
    expect(formatWorkTime(3.2)).toEqual({ text: '3시간 12분', note: '' });
    expect(formatWorkTime(3)).toEqual({ text: '3시간', note: '' });
  });

  it('8시간을 넘으면 근무일 기준으로 환산하고 기준을 밝힌다', () => {
    const result = formatWorkTime(132);
    expect(result.text).toBe('16일 4시간');
    expect(result.note).toBe('하루 8시간 근무 기준');
  });

  it('근무일 250일을 넘으면 년/개월로', () => {
    const result = formatWorkTime(8 * 250 * 2.25);
    expect(result.text).toBe('2년 3개월');
    expect(result.note).toBe('주5일 하루 8시간 근무 기준');
  });

  it('개월 반올림이 12가 되면 해를 올린다', () => {
    const result = formatWorkTime(8 * 250 * 2.999);
    expect(result.text).toBe('3년');
  });
});
