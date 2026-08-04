import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  formatCalories,
  formatCaloriesAnalogy,
  formatCount,
  formatHeight,
  formatKoreanNumber,
  formatWon,
  formatWorkTime,
  LANDMARKS,
  pickActivity,
  pickLandmark,
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

describe('pickLandmark', () => {
  it.each([
    [4.25, 'bigmac'],
    [8.5, 'bigmac'],
    [173, 'person'],
    [600, 'giraffe'],
    [2_000, 'apartment'],
    [49_800, 'building63'],
    [100_000, 'lotteTower'],
    [500_000, 'hallasan'],
    [2_000_000, 'everest'],
    [8_000_000, 'stratosphere'],
    [20_000_000, 'karman'],
    [100_000_000, 'iss'],
    [50_000_000_000, 'moon'],
  ])('%dcm → %s', (cm, expected) => {
    expect(pickLandmark(cm).landmark.id).toBe(expected);
  });

  it('사다리보다 낮으면 가장 작은 랜드마크와 1 미만의 비율을 준다', () => {
    const { landmark, ratio } = pickLandmark(4.25);
    expect(landmark.id).toBe('bigmac');
    expect(ratio).toBeCloseTo(0.5, 10);
  });

  it('비율은 실제 높이 나누기 랜드마크 높이다', () => {
    expect(pickLandmark(49_800).ratio).toBeCloseTo(2, 10);
  });

  it('0 이하는 비율 0으로 떨어진다', () => {
    expect(pickLandmark(0).ratio).toBe(0);
    expect(pickLandmark(Number.NaN).ratio).toBe(0);
  });

  it('사다리는 cm 오름차순이어야 한다 (탐색이 그 전제를 쓴다)', () => {
    const heights = LANDMARKS.map((l) => l.cm);
    expect([...heights].sort((a, b) => a - b)).toEqual(heights);
  });

  it('id가 중복되지 않는다', () => {
    const ids = LANDMARKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('formatHeight가 같은 비교 결과를 함께 돌려준다', () => {
    const result = formatHeight(49_800);
    expect(result.comparison.landmark.id).toBe('building63');
    expect(result.analogy).toBe('63빌딩 2개 높이');
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

describe('열량 비유', () => {
  it('사다리는 kcal 오름차순이다', () => {
    for (let i = 1; i < ACTIVITIES.length; i += 1) {
      expect(ACTIVITIES[i]!.kcal).toBeGreaterThan(ACTIVITIES[i - 1]!.kcal);
    }
  });

  // 촘촘하면 무엇을 넣든 "1.1번"만 나와서 사다리가 있으나 마나 해진다.
  it('이웃끼리 최소 3배는 벌어져 있다', () => {
    for (let i = 1; i < ACTIVITIES.length; i += 1) {
      expect(ACTIVITIES[i]!.kcal / ACTIVITIES[i - 1]!.kcal).toBeGreaterThanOrEqual(3);
    }
  });

  it('id가 겹치지 않는다', () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
  });

  it('비율이 1 이상인 것 중 가장 큰 활동을 고른다', () => {
    expect(pickActivity(2_900).activity.id).toBe('marathon');
    expect(pickActivity(2_799).activity.id).toBe('namsan');
  });

  it.each([
    [0, '아직 아무것도 안 먹었어요'],
    [-5, '아직 아무것도 안 먹었어요'],
    [2, '계단 한 층 오르기의 0.4배'],
    [5, '계단 한 층 오르기 1번'],
    [460, '남산 오르기 1.5번'],
    [91_030, '서울에서 부산까지 걷기 4.6번'],
  ])('%s kcal → %s', (kcal, expected) => {
    expect(formatCaloriesAnalogy(kcal)).toBe(expected);
  });

  it('사다리 꼭대기를 넘어도 무너지지 않는다', () => {
    expect(formatCaloriesAnalogy(1e12)).toContain('지구 한 바퀴');
  });

  it('NaN이면 빈 상태 문구', () => {
    expect(formatCaloriesAnalogy(Number.NaN)).toBe('아직 아무것도 안 먹었어요');
  });
});
