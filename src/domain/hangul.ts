/**
 * 초성 검색 유틸. 순수 문자열 연산만 한다.
 */

const HANGUL_BASE = 0xac00; // '가'
const HANGUL_LAST = 0xd7a3; // '힣'
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const CHOSEONG_SET = new Set<string>(CHOSEONG);

/** 문자열이 전부 초성 자모로만 이루어졌는지. 공백은 무시한다. */
export function isChosungOnly(text: string): boolean {
  const stripped = text.replace(/\s+/g, '');
  if (stripped.length === 0) return false;
  return [...stripped].every((ch) => CHOSEONG_SET.has(ch));
}

/**
 * 초성을 뽑는다. 완성형 한글은 초성으로, 나머지 문자는 그대로 남긴다.
 *
 *   "맥북 프로" → "ㅁㅂㅍㄹ"
 *   "PS5"      → "PS5"
 */
export function toChosung(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      const index = Math.floor(
        (code - HANGUL_BASE) / (JUNGSEONG_COUNT * JONGSEONG_COUNT),
      );
      out += CHOSEONG[index]!;
    } else if (!/\s/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/**
 * 검색어가 대상 문자열에 매칭되는지. 부분 일치와 초성 일치를 모두 본다.
 * 검색어가 초성으로만 이루어졌을 때에만 초성 매칭을 시도한다 — 그러지 않으면
 * "프로"가 "ㅍㄹ"로 변환돼 엉뚱한 항목까지 걸린다.
 */
export function matchesQuery(text: string, query: string): boolean {
  const q = normalize(query);
  if (q.length === 0) return true;
  if (normalize(text).includes(q)) return true;
  if (isChosungOnly(q)) return toChosung(text).toLowerCase().includes(q);
  return false;
}
