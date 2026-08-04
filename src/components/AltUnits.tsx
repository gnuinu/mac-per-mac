import { formatKoreanNumber } from '../domain/format';
import type { AltUnitCount } from '../domain/units';
import styles from './AltUnits.module.css';

interface Props {
  units: AltUnitCount[];
  /** 같은 금액을 다른 항목으로 바꿔 볼 수 있게 한다. */
  onPick: (id: string) => void;
}

/**
 * 같은 돈을 빅맥 말고 다른 단위로도 세어 보여준다.
 *
 * 여기 있던 버거 아이콘 격자를 대신한다. 격자는 개수를 그림으로 한 번 더 말할
 * 뿐이었는데, 그 일은 위의 높이 비교 그림이 이미 더 잘 하고 있었다.
 */
export function AltUnits({ units, onPick }: Props) {
  if (units.length === 0) return null;

  return (
    <section className={styles.wrap} aria-label="같은 금액을 다른 단위로">
      <p className={styles.label}>이 돈이면 또</p>
      <ul className={styles.list}>
        {units.map(({ item, counter, count }) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.row}
              onClick={() => onPick(item.id)}
              title={`${item.name} 기준으로 보기`}
            >
              <span className={styles.name}>
                <span aria-hidden="true">{item.emoji}</span> {item.name}
              </span>
              <span className={styles.dots} aria-hidden="true" />
              <span className={`${styles.count} tnum`}>
                {formatKoreanNumber(count)}
                {counter}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
