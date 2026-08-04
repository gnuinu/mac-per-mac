import { useMemo } from 'react';
import type { CatalogItem } from '../../domain/types';
import { glyphFor } from './glyphs';
import { parseSprite, type SpriteGrid } from './sprites';

interface Props {
  /** 항목을 주면 알맞은 그림을 고른다. */
  item?: CatalogItem;
  /** 직접 격자를 넘기고 싶을 때. */
  grid?: SpriteGrid;
  /** 한 변의 px. 8의 배수를 권한다 — 8×8 격자가 정수배로 확대돼야 안 흐려진다. */
  size?: number;
  className?: string | undefined;
}

/**
 * 8×8 픽토그램 한 개. 색은 `currentColor`를 따르므로 놓는 자리의 색을 받는다.
 * 비교 그림과 같은 렌더러(parseSprite)를 쓴다.
 */
export function Glyph({ item, grid, size = 16, className }: Props) {
  const sprite = useMemo(
    () => parseSprite(grid ?? (item ? glyphFor(item) : [])),
    [grid, item],
  );
  if (sprite.rows === 0) return null;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${sprite.cols} ${sprite.rows}`}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {sprite.runs.map((run, index) => (
        <rect
          key={index}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          opacity={run.faint ? 0.4 : 1}
        />
      ))}
    </svg>
  );
}
