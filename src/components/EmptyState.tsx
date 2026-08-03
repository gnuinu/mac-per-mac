import { STAGE_LABELS, type LookupStage } from '../services/priceLookup';
import { BurgerIcon } from './icons/BurgerIcon';
import styles from './EmptyState.module.css';

interface Props {
  /** 조회 중이면 현재 단계. 아니면 null. */
  stage: LookupStage | null;
  /** 조회 실패 사유. 없으면 null. */
  failure: 'not_found' | 'unpriceable' | null;
}

export function EmptyState({ stage, failure }: Props) {
  if (stage) {
    return (
      <div className={styles.wrap}>
        <BurgerIcon className={styles.icon} />
        <p className={`${styles.stage} ${styles.dots}`} aria-live="polite">
          {STAGE_LABELS[stage]}
        </p>
      </div>
    );
  }

  if (failure) {
    return (
      <div className={`${styles.wrap} ${styles.error}`} role="status">
        <BurgerIcon className={styles.icon} />
        <p className={styles.title}>
          {failure === 'unpriceable'
            ? '이건 값을 매기기 어렵네요'
            : '가격을 못 찾았어요'}
        </p>
        <p className={styles.hint}>직접 금액을 입력해보세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <BurgerIcon className={styles.icon} />
      <p className={styles.title}>뭘 살지 정해볼까요</p>
      <p className={styles.hint}>
        금액을 넣거나 아래 항목을 눌러보세요. 카탈로그에 없는 것도 이름으로
        찾아봅니다.
      </p>
    </div>
  );
}
