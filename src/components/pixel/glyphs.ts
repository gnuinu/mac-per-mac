import type { Category, CatalogItem } from '../../domain/types';
import type { SpriteGrid } from './sprites';

/**
 * 카탈로그 항목을 나타내는 8×8 픽토그램.
 *
 * 이모지를 대신한다. 이모지는 이 앱에서 유일한 총천연색 요소라 "강조색 하나,
 * 나머지 무채색"과 정면으로 부딪혔다. 그레이스케일 필터는 답이 아니다 —
 * 플랫폼마다 다르게 뭉개지고 격자에도 안 맞는다.
 *
 * 대신 비교 그림이 쓰는 스프라이트 렌더러를 그대로 재사용한다. 같은 문자 격자
 * 형식이고 `currentColor`를 타므로, 무채색 원칙과 강조색 교체가 공짜로 따라온다.
 * 픽셀 아트가 UI에서 겉돌던 문제도 같은 처방으로 풀린다.
 *
 * 8×8인 이유는 12·16·20·24·32px이 전부 정수배라서다. `shapeRendering=crispEdges`
 * 에서 흐려지지 않는다.
 */

const COFFEE: SpriteGrid = [
  '........',
  '.######.',
  '.#++++#.',
  '.#++++##',
  '.#++++##',
  '.#++++#.',
  '..####..',
  '.######.',
];

const MONITOR: SpriteGrid = [
  '########',
  '#++++++#',
  '#++++++#',
  '#++++++#',
  '########',
  '...##...',
  '..####..',
  '........',
];

const PHONE: SpriteGrid = [
  '.######.',
  '.#++++#.',
  '.#++++#.',
  '.#++++#.',
  '.#++++#.',
  '.#++++#.',
  '.#.##.#.',
  '.######.',
];

const CAR: SpriteGrid = [
  '........',
  '..#####.',
  '.#+++++#',
  '########',
  '########',
  '.##..##.',
  '.##..##.',
  '........',
];

const BUILDING: SpriteGrid = [
  '........',
  '.######.',
  '.#.##.#.',
  '.######.',
  '.#.##.#.',
  '.######.',
  '.#.##.#.',
  '.######.',
];

const TICKET: SpriteGrid = [
  '........',
  '.######.',
  '.#++++#.',
  '.#+##+#.',
  '.#++++#.',
  '.#++++#.',
  '.######.',
  '........',
];

const SUBWAY: SpriteGrid = [
  '..####..',
  '.######.',
  '.#++++#.',
  '.#++++#.',
  '.######.',
  '.#.##.#.',
  '.######.',
  '..#..#..',
];

const ROLL: SpriteGrid = [
  '........',
  '..####..',
  '.#++++#.',
  '.#+##+#.',
  '.#+##+#.',
  '.#++++#.',
  '..####..',
  '........',
];

const CUP: SpriteGrid = [
  '........',
  '########',
  '.#++++#.',
  '.#++++#.',
  '..#++#..',
  '..#++#..',
  '..####..',
  '........',
];

const FILM: SpriteGrid = [
  '........',
  '########',
  '#.####.#',
  '#.####.#',
  '#.####.#',
  '#.####.#',
  '########',
  '........',
];

const CALENDAR: SpriteGrid = [
  '........',
  '.##..##.',
  '########',
  '#++++++#',
  '#+#+#+##',
  '#++++++#',
  '########',
  '........',
];

const SCISSORS: SpriteGrid = [
  '........',
  '.#....#.',
  '..#..#..',
  '...##...',
  '...##...',
  '..#..#..',
  '.##..##.',
  '........',
];

/** 무엇인지 특정할 수 없을 때. 장바구니는 "산다"는 뜻이 바로 읽힌다. */
const TAG: SpriteGrid = [
  '........',
  '..#..#..',
  '.######.',
  '.#++++#.',
  '.#++++#.',
  '.#++++#.',
  '.######.',
  '........',
];

/** 항목별 그림. 자주 보이는 것부터 채웠다. */
const BY_ID: Record<string, SpriteGrid> = {
  americano: COFFEE,
  'mac-mini': MONITOR,
  'iphone-17-pro': PHONE,
  grandeur: CAR,
  'seoul-apartment': BUILDING,
  lotto: TICKET,
  'subway-fare': SUBWAY,
  gimbap: ROLL,
  'cup-ramen': CUP,
  'movie-ticket': FILM,
  netflix: CALENDAR,
  'taxi-base': CAR,
  haircut: SCISSORS,
};

/** 항목별 그림이 없으면 카테고리로 떨어진다. 48개를 전부 그릴 필요는 없다. */
const BY_CATEGORY: Record<Category, SpriteGrid> = {
  전자기기: MONITOR,
  탈것: CAR,
  '부동산/생활': BUILDING,
  '밈/스케일': TICKET,
  '소소한 것': TAG,
};

export function glyphFor(item: CatalogItem): SpriteGrid {
  return BY_ID[item.id] ?? BY_CATEGORY[item.category] ?? TAG;
}
