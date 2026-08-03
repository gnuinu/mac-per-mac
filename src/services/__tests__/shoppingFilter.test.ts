import { describe, expect, it } from 'vitest';
import {
  ShoppingRefineError,
  cleanTitle,
  isRelevant,
  median,
  refineShoppingResults,
  trimmedMedian,
  type RawShoppingItem,
} from '../shoppingFilter';

function item(title: string, lprice: number): RawShoppingItem {
  return { title, lprice: String(lprice), link: 'https://x.test', mallName: '몰' };
}

describe('cleanTitle', () => {
  it('HTML 태그를 걷어낸다', () => {
    expect(cleanTitle('애플 <b>맥 미니</b> M4')).toBe('애플 맥 미니 M4');
  });

  it('HTML 엔티티를 되돌린다', () => {
    expect(cleanTitle('AT&amp;T 16&quot; 노트북')).toBe('AT&T 16" 노트북');
  });

  it('연속 공백을 하나로 줄인다', () => {
    expect(cleanTitle('  맥   미니  ')).toBe('맥 미니');
  });
});

describe('isRelevant', () => {
  it.each(['중고 맥 미니', '맥 미니 케이스', '맥북 액정 필름', '노트북 렌탈'])(
    '제외 키워드가 있으면 탈락: %s',
    (title) => {
      expect(isRelevant(title, '맥 미니')).toBe(false);
    },
  );

  it('검색어 토큰이 하나도 없으면 탈락', () => {
    expect(isRelevant('갤럭시 버즈', '맥 미니')).toBe(false);
  });

  it('토큰이 하나라도 걸리면 통과', () => {
    expect(isRelevant('애플 맥미니 M4 16GB', '맥 미니')).toBe(true);
  });

  it('한 글자 토큰은 매칭에 쓰지 않는다', () => {
    // "이"가 "고양이"에 들어 있다고 아이폰 검색에 걸리면 안 된다.
    expect(isRelevant('고양이 사료', '이 아이폰')).toBe(false);
  });

  it('쓸 만한 토큰이 하나도 없으면 필터를 건너뛴다', () => {
    // 전부 한 글자면 걸러낼 근거가 없으므로 통과시키고 뒤쪽 절사에 맡긴다.
    expect(isRelevant('갤럭시 버즈', '이 폰')).toBe(true);
  });
});

describe('median', () => {
  it('홀수 개는 가운데 값', () => {
    expect(median([1, 2, 3])).toBe(2);
  });

  it('짝수 개는 가운데 두 값의 평균', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('빈 배열은 NaN', () => {
    expect(median([])).toBeNaN();
  });
});

describe('trimmedMedian', () => {
  it('상하위 20%를 잘라낸다', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(trimmedMedian(values).kept).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it('극단적인 이상치에 끌려가지 않는다', () => {
    const values = [90, 95, 100, 100, 105, 110, 100, 100, 1, 999_999];
    const { value } = trimmedMedian(values);
    expect(value).toBeGreaterThan(90);
    expect(value).toBeLessThan(115);
  });

  it('표본이 적으면 절사를 건너뛴다', () => {
    expect(trimmedMedian([10, 20, 30]).kept).toEqual([10, 20, 30]);
  });
});

describe('refineShoppingResults', () => {
  const many = [
    item('애플 맥 미니 M4 16GB 256GB', 890_000),
    item('애플 맥미니 M4 기본형', 869_000),
    item('맥 미니 M4 정품', 899_000),
    item('맥미니 M4 24GB', 1_190_000),
    item('맥 미니 M4 512GB', 1_090_000),
    item('중고 맥 미니 M4', 620_000),
    item('맥 미니 전용 케이스', 12_000),
    item('갤럭시 버즈3', 189_000),
  ];

  it('관련 없는 항목과 제외 키워드를 걸러낸다', () => {
    const result = refineShoppingResults(many, '맥 미니');
    expect(result.matchedSize).toBe(5); // 중고·케이스·갤럭시 제외
  });

  it('대표가는 절사 후 중앙값이다', () => {
    const result = refineShoppingResults(many, '맥 미니');
    // 정렬: 869k 890k 899k 1090k 1190k → 20% 절사(1개씩) → 890k 899k 1090k → 899k
    expect(result.priceKRW).toBe(899_000);
    expect(result.sampleSize).toBe(3);
  });

  it('대표 상품은 대표가에 가장 가까운 항목', () => {
    const result = refineShoppingResults(many, '맥 미니');
    expect(result.representative.title).toBe('맥 미니 M4 정품');
  });

  it('결과가 3개 미만이면 던진다', () => {
    const few = [item('맥 미니 M4', 890_000), item('맥미니 M4', 869_000)];
    expect(() => refineShoppingResults(few, '맥 미니')).toThrow(ShoppingRefineError);
  });

  it('가격이 숫자가 아닌 항목은 버린다', () => {
    const dirty: RawShoppingItem[] = [
      ...many,
      { title: '맥 미니 M4 특가', lprice: '가격문의' },
      { title: '맥 미니 M4 이벤트', lprice: '0' },
    ];
    expect(refineShoppingResults(dirty, '맥 미니').matchedSize).toBe(5);
  });
});
