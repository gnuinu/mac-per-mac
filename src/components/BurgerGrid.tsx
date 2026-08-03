import { useMemo } from 'react';
import { formatCount } from '../domain/format';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { BurgerIcon } from './icons/BurgerIcon';
import styles from './BurgerGrid.module.css';

interface Props {
  count: number;
}

/** 이 개수까지만 실제로 그리고, 넘으면 축약한다. */
export const MAX_DRAWN = 100;

/** stagger 간격(ms)과 전체 지연 상한. 100개가 순차로 나타나도 2초를 넘지 않게. */
const STEP_MS = 18;
const MAX_DELAY_MS = 900;

/**
 * 개수를 격자로 시각화한다.
 * 100개 이하면 실제 개수만큼, 그 이상이면 100개까지만 그리고 "…외 N개"로 줄인다.
 */
export function BurgerGrid({ count }: Props) {
  const reducedMotion = useReducedMotion();

  const whole = Math.max(0, Math.floor(count));
  const drawn = Math.min(whole, MAX_DRAWN);
  const hidden = whole - drawn;

  // key가 안정적이어야 다시 그릴 때 애니메이션이 처음부터 돌지 않는다.
  const indices = useMemo(
    () => Array.from({ length: drawn }, (_, index) => index),
    [drawn],
  );

  if (whole === 0) return null;

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.grid} ${reducedMotion ? '' : styles.animated}`}
        role="img"
        aria-label={`빅맥 ${formatCount(whole)}`}
      >
        {indices.map((index) => (
          <BurgerIcon
            key={index}
            className={styles.icon}
            {...(reducedMotion
              ? {}
              : {
                  // CSS 변수로 지연을 넘긴다. 상한을 둬서 뒤쪽이 하염없이 밀리지 않게.
                  style: {
                    '--delay': `${Math.min(index * STEP_MS, MAX_DELAY_MS)}ms`,
                  } as React.CSSProperties,
                })}
          />
        ))}
      </div>

      {hidden > 0 ? (
        <p className={`${styles.more} tnum`}>…외 {formatCount(hidden)}</p>
      ) : null}
    </div>
  );
}
