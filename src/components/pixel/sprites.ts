import type { LandmarkId } from '../../domain/format';

/**
 * 픽셀 스프라이트. 문자 격자로 적어두고 렌더링할 때 SVG 사각형으로 편다.
 *
 * 이미지 파일을 두지 않는 이유는 앱의 나머지와 같다 — 오프라인 동작, 번들 크기,
 * 그리고 강조색 하나만 바꾸면 전부 따라오게 하기 위해서다.
 *
 *   '#' 진한 톤 (currentColor)
 *   '+' 옅은 톤 (창문·눈·크레이터)
 *   '.' 빈 칸
 *
 * 각 배열의 모든 행은 길이가 같아야 한다. parseSprite가 검사한다.
 */

export type SpriteGrid = readonly string[];

/** 비교 그림에서 늘 함께 서는 눈대중 기준. */
export const PERSON: SpriteGrid = [
  '.###.',
  '.###.',
  '.###.',
  '#####',
  '.###.',
  '.###.',
  '.#.#.',
  '.#.#.',
  '##.##',
];

/** 빅맥 한 층. 세로로 반복해서 쌓아 올린다. */
export const BURGER_TILE: SpriteGrid = ['.#######.', '##+++++##', '.#######.'];

const GIRAFFE: SpriteGrid = [
  '.........#.#',
  '.........###',
  '........####',
  '........####',
  '.........##.',
  '.........##.',
  '.........##.',
  '.........##.',
  '.........##.',
  '..##########',
  '.###########',
  '.###########',
  '.###########',
  '.##.##.##.##',
  '.##.##.##.##',
  '.##.##.##.##',
];

const APARTMENT: SpriteGrid = [
  '###########',
  '#+#+#+#+#+#',
  '###########',
  '#+#+#+#+#+#',
  '###########',
  '#+#+#+#+#+#',
  '###########',
  '#+#+#+#+#+#',
  '###########',
  '#+#+#+#+#+#',
  '###########',
  '####+++####',
];

const BUILDING_63: SpriteGrid = [
  '...#####...',
  '...#+#+#...',
  '...#####...',
  '..#######..',
  '..#+#+#+#..',
  '..#######..',
  '..#######..',
  '.#########.',
  '.#+#+#+#+#.',
  '.#########.',
  '.#########.',
  '.#########.',
  '###########',
  '###########',
  '###########',
  '###########',
];

const LOTTE_TOWER: SpriteGrid = [
  '.....#.....',
  '.....#.....',
  '....###....',
  '....###....',
  '....###....',
  '....###....',
  '...#####...',
  '...#+#+#...',
  '...#####...',
  '...#####...',
  '...#####...',
  '..#######..',
  '..#+#+#+#..',
  '..#######..',
  '..#######..',
  '..#######..',
  '.#########.',
  '.#+#+#+#+#.',
  '.#########.',
  '.#########.',
  '###########',
  '###########',
  '###########',
  '###########',
];

const HALLASAN: SpriteGrid = [
  '......#...#......',
  '.....##...##.....',
  '....####.####....',
  '....#########....',
  '...###########...',
  '..#############..',
  '.###############.',
  '#################',
  '#################',
];

const EVEREST: SpriteGrid = [
  '........#........',
  '.......#+#.......',
  '......##+##......',
  '.....##+++##.....',
  '....###+++###....',
  '...#####.#####...',
  '..#############..',
  '.###############.',
  '#################',
  '#################',
];

const STRATOSPHERE: SpriteGrid = [
  '......####.......',
  '....########.....',
  '..#############..',
  '.###############.',
  '..#############..',
];

/** 고도 경계선. 굵은 점선 하나와 그 위의 별 둘로 "여기부터 우주"를 말한다. */
const KARMAN: SpriteGrid = [
  '....+.......+....',
  '.................',
  '#####.#####.#####',
];

const ISS: SpriteGrid = [
  '++...###...++',
  '++...###...++',
  '+++++###+++++',
  '++...###...++',
  '++...###...++',
];

const MOON: SpriteGrid = [
  '...#######...',
  '..#########..',
  '.###+++#####.',
  '.###+++#####.',
  '#############',
  '####+++######',
  '#############',
  '#########+++#',
  '#############',
  '.#####+++###.',
  '.###########.',
  '..#########..',
  '...#######...',
];

export const LANDMARK_SPRITES: Record<LandmarkId, SpriteGrid> = {
  bigmac: BURGER_TILE,
  person: PERSON,
  giraffe: GIRAFFE,
  apartment: APARTMENT,
  building63: BUILDING_63,
  lotteTower: LOTTE_TOWER,
  hallasan: HALLASAN,
  everest: EVEREST,
  stratosphere: STRATOSPHERE,
  karman: KARMAN,
  iss: ISS,
  moon: MOON,
};

export interface SpriteRun {
  x: number;
  y: number;
  /** 가로로 이어진 칸 수. 사각형 개수를 줄이려고 미리 합쳐둔다. */
  w: number;
  faint: boolean;
}

export interface ParsedSprite {
  cols: number;
  rows: number;
  runs: SpriteRun[];
}

/** 문자 격자를 가로 런으로 압축한다. 같은 격자는 늘 같은 결과를 낸다. */
export function parseSprite(grid: SpriteGrid): ParsedSprite {
  const cols = grid[0]?.length ?? 0;
  const runs: SpriteRun[] = [];

  grid.forEach((row, y) => {
    if (row.length !== cols) {
      throw new Error(`스프라이트 행 길이가 다릅니다: ${row.length} ≠ ${cols}`);
    }

    let start = -1;
    let faint = false;
    const flush = (end: number) => {
      if (start >= 0) runs.push({ x: start, y, w: end - start, faint });
      start = -1;
    };

    for (let x = 0; x < cols; x += 1) {
      const cell = row[x]!;
      const filled = cell === '#' || cell === '+';
      const isFaint = cell === '+';
      if (!filled) {
        flush(x);
      } else if (start < 0) {
        start = x;
        faint = isFaint;
      } else if (isFaint !== faint) {
        // 톤이 바뀌면 런을 끊는다.
        flush(x);
        start = x;
        faint = isFaint;
      }
    }
    flush(cols);
  });

  return { cols, rows: grid.length, runs };
}
