import { describe, expect, it } from 'vitest';
import { isChosungOnly, matchesQuery, toChosung } from '../hangul';

describe('toChosung', () => {
  it('완성형 한글에서 초성을 뽑는다', () => {
    expect(toChosung('맥북')).toBe('ㅁㅂ');
    expect(toChosung('맥북 프로')).toBe('ㅁㅂㅍㄹ');
    expect(toChosung('빅맥계산기')).toBe('ㅂㅁㄱㅅㄱ');
  });

  it('받침 있는 글자도 초성만 남긴다', () => {
    expect(toChosung('삼성전자')).toBe('ㅅㅅㅈㅈ');
  });

  it('쌍자음 초성을 구분한다', () => {
    expect(toChosung('따릉이')).toBe('ㄸㄹㅇ');
  });

  it('한글이 아닌 문자는 그대로 남긴다', () => {
    expect(toChosung('PS5 프로')).toBe('PS5ㅍㄹ');
    expect(toChosung('OLED TV')).toBe('OLEDTV');
  });
});

describe('isChosungOnly', () => {
  it.each([
    ['ㅁㅂ', true],
    ['ㅁ ㅂ', true],
    ['맥북', false],
    ['ㅁ북', false],
    ['ps', false],
    ['', false],
    ['  ', false],
  ])('%s → %s', (input, expected) => {
    expect(isChosungOnly(input)).toBe(expected);
  });
});

describe('matchesQuery', () => {
  it('부분 일치', () => {
    expect(matchesQuery('맥북 에어 M4 13인치', '에어')).toBe(true);
    expect(matchesQuery('맥북 에어', '아이폰')).toBe(false);
  });

  it('공백과 대소문자를 무시한다', () => {
    expect(matchesQuery('OLED TV 65인치', 'oledtv')).toBe(true);
    expect(matchesQuery('맥북 에어', '맥북에어')).toBe(true);
  });

  it('초성 검색', () => {
    expect(matchesQuery('맥북 프로 16인치', 'ㅁㅂ')).toBe(true);
    expect(matchesQuery('맥북 프로 16인치', 'ㅁㅂㅍㄹ')).toBe(true);
    expect(matchesQuery('아이폰 17 Pro', 'ㅁㅂ')).toBe(false);
  });

  it('초성이 아닌 검색어는 초성 변환을 시도하지 않는다', () => {
    // "프로"를 초성으로 바꿔 매칭하면 "포르쉐" 같은 엉뚱한 항목까지 걸린다.
    expect(matchesQuery('포르쉐 911 카레라', '프로')).toBe(false);
  });

  it('빈 검색어는 모두 통과', () => {
    expect(matchesQuery('아무거나', '')).toBe(true);
  });
});
