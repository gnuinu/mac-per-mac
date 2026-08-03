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
  bigMac: BigMacSpec;
  minimumWageKRW: number;
  catalog: CatalogItem[];
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
