/**
 * 도메인 전역 타입. 이 파일을 포함한 src/domain/** 은 DOM·React를 import하지 않는다.
 */

/** 환산 결과의 규모 등급. 개수 구간으로 결정된다. */
export type Scale = 'trivial' | 'snack' | 'meal' | 'feast' | 'absurd';

export type Category =
  | '전자기기'
  | '탈것'
  | '부동산/생활'
  | '밈/스케일'
  | '소소한 것';

/** 빅맥 자체의 스펙. prices.json의 `bigMac` 필드. */
export interface BigMacSpec {
  priceKRW: number;
  updatedAt: string;
  source: string;
  caloriesPerUnit: number;
  heightCm: number;
}

/**
 * 비교 대상 나라. 빅맥 가격과 최저시급을 그 나라 통화로 들고 있고,
 * `fxToKRW`로 원화 환산한다.
 *
 * 열량·높이는 여기 없다. 빅맥은 어느 나라에서나 같은 물건이라
 * `bigMac.caloriesPerUnit`/`heightCm`이 전역으로 남는다.
 */
export interface Market {
  /** ISO 3166-1 alpha-2. URL의 ?m= 값으로도 쓴다. */
  id: string;
  name: string;
  currency: string;
  /** 통화 기호. Intl 대신 명시하는 이유는 market.ts 주석 참고. */
  symbol: string;
  /** 기호를 숫자 뒤에 붙이면 true (원, 엔은 앞이 관례라 false). */
  symbolAfter?: boolean;
  /** 소수 자릿수. 원·엔은 0, 달러·유로는 2. */
  decimals: number;
  /** 현지 통화 기준 빅맥 가격. */
  bigMacPrice: number;
  /** 현지 통화 1단위당 원. 한국은 1. */
  fxToKRW: number;
  /** 현지 통화 기준 시간당 최저임금. */
  minimumWage: number;
  updatedAt: string;
  source: string;
  /** 값이 확실치 않으면 true. UI에서 "추정"으로 노출된다. */
  uncertain?: boolean;
  /** 기준이나 예외를 적어두는 한 줄. 인도의 마하라자 맥 같은 것. */
  note?: string;
  /**
   * 지난 시절이면 그 연도. 없으면 지금 기준이다.
   *
   * 옛날 한국은 구조적으로 다른 나라와 똑같다 — 빅맥 값이 다르고 최저시급이
   * 다를 뿐이다. 그래서 따로 타입을 만들지 않고 Market을 그대로 쓴다.
   * 목록에서 "나라"와 "시절"로 갈라 보여주는 것만 UI가 한다.
   */
  era?: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  priceKRW: number;
  category: Category;
  emoji: string;
  /** "2026년 2월 기준" 같은 출처/시점 메모. */
  priceNote: string;
  /** 값이 확실치 않은 추정치면 true. UI에서 "추정" 배지로 노출된다. */
  uncertain?: boolean;
}

export interface PriceData {
  /**
   * 기본 나라(defaultMarket)에서 파생된 값. markets가 진실이고 이건 편의용이라,
   * 나라를 고르지 않은 소비자는 예전과 똑같이 동작한다.
   */
  bigMac: BigMacSpec;
  minimumWageKRW: number;
  catalog: CatalogItem[];
  markets: Market[];
  defaultMarketId: string;
}

export interface BigMacResult {
  /** 정확한 개수 (소수점 포함). */
  count: number;
  /** 정수 개수. */
  wholeCount: number;
  /** 정수 개수만큼 사고 남는 돈 (원 단위 반올림). */
  remainderKRW: number;
  /** 총 열량 (kcal, 반올림). */
  calories: number;
  /** 쌓았을 때 높이 (cm). */
  stackHeightCm: number;
  /** 최저시급 기준 필요 노동시간. */
  workHours: number;
  scale: Scale;
}
