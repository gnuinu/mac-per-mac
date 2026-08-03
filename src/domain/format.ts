/**
 * 숫자 포맷팅. 표시용 문자열만 만들고, 계산은 하지 않는다.
 */

/**
 * 비유에 쓰는 대상. UI가 그림을 그릴 수 있도록 문자열이 아니라 구조로 돌려준다.
 * 도메인은 어떤 그림을 쓸지 모른다 — id만 주고, 스프라이트 선택은 UI 몫이다.
 */
export type LandmarkId =
  | 'bigmac'
  | 'person'
  | 'giraffe'
  | 'apartment'
  | 'building63'
  | 'lotteTower'
  | 'hallasan'
  | 'everest'
  | 'stratosphere'
  | 'karman'
  | 'iss'
  | 'moon';

export interface Landmark {
  id: LandmarkId;
  name: string;
  cm: number;
  /** 개수를 셀 때 붙는 단위. "개" / "명" / "마리" */
  counter: string;
}

export interface HeightComparison {
  landmark: Landmark;
  /** 쌓은 높이 ÷ 랜드마크 높이. */
  ratio: number;
}

export interface FormattedHeight {
  /** 상황에 맞는 단위로 변환한 값. 예: "21.2m" */
  value: string;
  /** 비유 문자열. 예: "63빌딩 2.4개 높이" */
  analogy: string;
  /** 같은 비유를 그림으로 그리기 위한 재료. */
  comparison: HeightComparison;
}

/** 사람 키. 비교 그림에서 눈대중 기준으로 늘 함께 그린다. */
export const PERSON_HEIGHT_CM = 173;

export interface FormattedDuration {
  /** 예: "16일 4시간" */
  text: string;
  /** 기준 설명. 없으면 빈 문자열. 예: "하루 8시간 근무 기준" */
  note: string;
}

const KOREAN_UNITS = [
  { value: 1e16, suffix: '경' },
  { value: 1e12, suffix: '조' },
  { value: 1e8, suffix: '억' },
  { value: 1e4, suffix: '만' },
  { value: 1, suffix: '' },
] as const;

/** 위에서부터 최대 몇 개 그룹까지 표기할지. 2를 넘으면 읽기 어려워진다. */
const MAX_GROUPS = 2;

function withCommas(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * 한국식 단위로 표기한다. 4자리씩 경/조/억/만 그룹으로 쪼갠 뒤, 위에서부터
 * 최대 두 그룹만 남긴다.
 *
 *   12345         → "1만 2,345"
 *   320_000_000   → "3억 2,000만"
 *   1_234_567_890_000 → "1조 2,345억"
 */
export function formatKoreanNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';

  const sign = n < 0 ? '-' : '';
  const rounded = Math.round(Math.abs(n));
  if (rounded === 0) return '0';
  if (rounded < KOREAN_UNITS[3].value) return sign + withCommas(rounded);

  let rest = rounded;
  const groups: { q: number; suffix: string }[] = [];
  for (const unit of KOREAN_UNITS) {
    const q = Math.floor(rest / unit.value);
    rest -= q * unit.value;
    groups.push({ q, suffix: unit.suffix });
  }

  const firstIndex = groups.findIndex((g) => g.q > 0);
  const parts = groups
    .slice(firstIndex, firstIndex + MAX_GROUPS)
    // 창 안에 0인 그룹이 섞이면 "1억 0만"이 되므로 버린다.
    .filter((g) => g.q > 0)
    .map((g) => `${withCommas(g.q)}${g.suffix}`);

  return sign + parts.join(' ');
}

/** 예: "1만 2,345개" */
export function formatCount(n: number): string {
  return `${formatKoreanNumber(n)}개`;
}

/** 예: "5,700원" */
export function formatWon(n: number): string {
  return `${formatKoreanNumber(n)}원`;
}

/** 예: "123만 4,567kcal" */
export function formatCalories(kcal: number): string {
  return `${formatKoreanNumber(kcal)}kcal`;
}

/** 소수 1자리까지 보여주되, 정수면 소수점을 떼어낸다. */
function trim1(n: number): string {
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? withCommas(Number(fixed)) : fixed;
}

/**
 * 비유 사다리. cm 오름차순으로 정렬되어 있어야 한다.
 *
 * 이웃한 랜드마크가 너무 가까우면 비유가 늘 "1.1개"로만 나와 재미가 없다.
 * 남산(262m)·백두산(2744m)처럼 바로 아래 항목과 1.5배도 차이 나지 않는 것은
 * 일부러 뺐다.
 */
export const LANDMARKS: readonly Landmark[] = [
  { id: 'bigmac', name: '빅맥', cm: 8.5, counter: '개' },
  { id: 'person', name: '성인 키', cm: PERSON_HEIGHT_CM, counter: '명' },
  { id: 'giraffe', name: '기린', cm: 550, counter: '마리' },
  { id: 'apartment', name: '아파트 5층', cm: 1_500, counter: '채' },
  { id: 'building63', name: '63빌딩', cm: 24_900, counter: '개' },
  { id: 'lotteTower', name: '롯데월드타워', cm: 55_500, counter: '개' },
  { id: 'hallasan', name: '한라산', cm: 194_700, counter: '개' },
  { id: 'everest', name: '에베레스트', cm: 884_800, counter: '개' },
  { id: 'stratosphere', name: '성층권', cm: 5_000_000, counter: '개' },
  { id: 'karman', name: '카르만 선', cm: 10_000_000, counter: '개' },
  { id: 'iss', name: 'ISS 궤도', cm: 40_800_000, counter: '개' },
  { id: 'moon', name: '달까지 거리', cm: 38_440_000_000, counter: '개' },
];

/**
 * 비율이 1 이상인 가장 큰 랜드마크를 고른다. 그보다 낮으면 가장 작은 것.
 */
export function pickLandmark(cm: number): HeightComparison {
  const first = LANDMARKS[0]!;
  if (!Number.isFinite(cm) || cm <= 0) return { landmark: first, ratio: 0 };

  let picked = first;
  for (const landmark of LANDMARKS) {
    if (cm / landmark.cm >= 1) picked = landmark;
    else break;
  }
  return { landmark: picked, ratio: cm / picked.cm };
}

function heightAnalogy({ landmark, ratio }: HeightComparison): string {
  if (ratio <= 0) return '아직 아무것도 안 쌓았어요';
  if (ratio < 1) return `${landmark.name}의 ${trim1(ratio)}배`;
  return `${landmark.name} ${trim1(ratio)}${landmark.counter} 높이`;
}

const CM_PER_M = 100;
const CM_PER_KM = 100_000;

/**
 * 높이를 상황에 맞는 단위(cm → m → km)로 바꾸고, 비유 문자열을 함께 반환한다.
 */
export function formatHeight(cm: number): FormattedHeight {
  const comparison = pickLandmark(cm);
  const analogy = heightAnalogy(comparison);

  if (!Number.isFinite(cm) || cm <= 0) return { value: '0cm', analogy, comparison };
  if (cm < CM_PER_M) return { value: `${trim1(cm)}cm`, analogy, comparison };
  if (cm < CM_PER_KM) {
    return { value: `${trim1(cm / CM_PER_M)}m`, analogy, comparison };
  }

  const km = cm / CM_PER_KM;
  // km 단위에서 소수점은 큰 수에서 의미가 없어진다.
  const value = km >= 1000 ? formatKoreanNumber(km) : trim1(km);
  return { value: `${value}km`, analogy, comparison };
}

const WORK_HOURS_PER_DAY = 8;
const WORK_DAYS_PER_YEAR = 250; // 주5일 기준

/**
 * 노동시간을 사람이 읽는 단위로 바꾼다. 하루를 넘어가면 근무일 기준으로 환산하고,
 * 그 기준을 `note`에 담아 함께 돌려준다.
 */
export function formatWorkTime(hours: number): FormattedDuration {
  if (!Number.isFinite(hours) || hours <= 0) return { text: '0분', note: '' };

  if (hours < 1) {
    return { text: `${Math.max(1, Math.round(hours * 60))}분`, note: '' };
  }

  if (hours < WORK_HOURS_PER_DAY) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return { text: m > 0 ? `${h}시간 ${m}분` : `${h}시간`, note: '' };
  }

  const days = hours / WORK_HOURS_PER_DAY;
  if (days < WORK_DAYS_PER_YEAR) {
    const d = Math.floor(days);
    const h = Math.round((days - d) * WORK_HOURS_PER_DAY);
    return {
      text: h > 0 ? `${d}일 ${h}시간` : `${d}일`,
      note: '하루 8시간 근무 기준',
    };
  }

  const years = days / WORK_DAYS_PER_YEAR;
  const y = Math.floor(years);
  const months = Math.round((years - y) * 12);
  // 반올림이 12개월을 만들면 해를 올린다.
  const [yy, mm] = months >= 12 ? [y + 1, 0] : [y, months];
  return {
    text: mm > 0 ? `${formatKoreanNumber(yy)}년 ${mm}개월` : `${formatKoreanNumber(yy)}년`,
    note: '주5일 하루 8시간 근무 기준',
  };
}
