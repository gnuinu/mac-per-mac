import type { CSSProperties } from 'react';
import styles from './MetricRow.module.css';

interface Props {
  label: string;
  value: string;
  /** 값 아래 작게 붙는 보조 문구. 비유나 기준 설명. */
  sub?: string;
  /** 순차 등장용 지연. */
  delayMs?: number;
}

/** 라벨 … 점선 … 우측 정렬 값. 영수증 한 줄. */
export function MetricRow({ label, value, sub, delayMs = 0 }: Props) {
  return (
    <div
      className={styles.row}
      style={{ '--delay': `${delayMs}ms` } as CSSProperties}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.leader} aria-hidden="true" />
      <span className={`${styles.value} tnum`}>
        {value}
        {sub ? <span className={styles.sub}>{sub}</span> : null}
      </span>
    </div>
  );
}
