import { formatWon } from '../domain/format';
import type { CatalogItem } from '../domain/types';
import { Glyph } from './pixel/Glyph';
import styles from './InputSummary.module.css';

interface Props {
  subject: string;
  priceKRW: number;
  /** 카탈로그에서 고른 항목. 직접 입력이면 없다. */
  item?: CatalogItem | undefined;
  onExpand: () => void;
}

/**
 * 결과가 떴을 때 입력 세 카드를 대신하는 한 줄.
 *
 * 휴대폰에서 입력 영역은 본문 세로의 39%를 먹는데, 한 번 고르고 나면 그만큼
 * 중요하지 않다. 무엇을 계산했는지만 남기고 접으면 그 자리가 주인공(큰 숫자와
 * 비교 그림)에게 돌아간다. 데스크톱은 좌측 열에 자리가 남으므로 접지 않는다.
 */
export function InputSummary({ subject, priceKRW, item, onExpand }: Props) {
  return (
    <div className={styles.bar}>
      {item ? <Glyph item={item} size={20} className={styles.glyph} /> : null}
      <span className={styles.subject}>{subject}</span>
      <span className={`${styles.price} tnum`}>{formatWon(priceKRW)}</span>
      <button type="button" className={styles.change} onClick={onExpand}>
        바꾸기
      </button>
    </div>
  );
}
