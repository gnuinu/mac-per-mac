import { describe, expect, it } from 'vitest';
import { LANDMARKS, type LandmarkId } from '../../domain/format';
import { BURGER_TILE, LANDMARK_SPRITES, PERSON, parseSprite } from './sprites';

/**
 * 스프라이트는 문자 격자라서 오타가 나기 쉽다. 모양은 눈으로 봐야 하지만
 * 격자가 성립하는지, 사다리의 모든 항목에 그림이 있는지는 여기서 잡는다.
 */

const ALL: [string, readonly string[]][] = [
  ['person', PERSON],
  ['burgerTile', BURGER_TILE],
  ...Object.entries(LANDMARK_SPRITES),
];

describe('스프라이트 격자', () => {
  it.each(ALL)('%s: 모든 행의 길이가 같다', (_name, grid) => {
    const width = grid[0]!.length;
    for (const row of grid) expect(row).toHaveLength(width);
  });

  it.each(ALL)('%s: 허용된 문자만 쓴다', (_name, grid) => {
    for (const row of grid) expect(row).toMatch(/^[.#+]+$/);
  });

  it.each(ALL)('%s: 빈 그림이 아니다', (_name, grid) => {
    expect(parseSprite(grid).runs.length).toBeGreaterThan(0);
  });
});

describe('사다리와의 연결', () => {
  it('모든 랜드마크에 그림이 있다', () => {
    for (const landmark of LANDMARKS) {
      expect(LANDMARK_SPRITES[landmark.id]).toBeDefined();
    }
  });

  it('쓰이지 않는 그림이 남아 있지 않다', () => {
    const used = new Set<LandmarkId>(LANDMARKS.map((l) => l.id));
    for (const id of Object.keys(LANDMARK_SPRITES) as LandmarkId[]) {
      expect(used.has(id)).toBe(true);
    }
  });
});

describe('parseSprite', () => {
  it('가로로 이어진 칸을 하나의 런으로 합친다', () => {
    const { runs, cols, rows } = parseSprite(['.###.']);
    expect(cols).toBe(5);
    expect(rows).toBe(1);
    expect(runs).toEqual([{ x: 1, y: 0, w: 3, faint: false }]);
  });

  it('빈 칸에서 런을 끊는다', () => {
    expect(parseSprite(['#.#'])).toMatchObject({
      runs: [
        { x: 0, y: 0, w: 1, faint: false },
        { x: 2, y: 0, w: 1, faint: false },
      ],
    });
  });

  it('톤이 바뀌면 런을 끊는다', () => {
    expect(parseSprite(['##++'])).toMatchObject({
      runs: [
        { x: 0, y: 0, w: 2, faint: false },
        { x: 2, y: 0, w: 2, faint: true },
      ],
    });
  });

  it('행 길이가 어긋나면 던진다', () => {
    expect(() => parseSprite(['###', '##'])).toThrow(/행 길이/);
  });
});
