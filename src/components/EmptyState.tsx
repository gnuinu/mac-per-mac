import {
  formatCalories,
  formatHeight,
  formatKoreanNumber,
  formatWon,
  formatWorkTime,
} from '../domain/format';
import type { BigMacResult, CatalogItem } from '../domain/types';
import { STAGE_LABELS, type LookupStage } from '../services/priceLookup';
import { BurgerIcon } from './icons/BurgerIcon';
import styles from './EmptyState.module.css';

/** 아직 아무것도 안 골랐을 때 대신 보여줄 계산 예시. */
export interface Example {
  item: CatalogItem;
  result: BigMacResult;
}

interface Props {
  /** 조회 중이면 현재 단계. 아니면 null. */
  stage: LookupStage | null;
  /** 조회 실패 사유. 없으면 null. */
  failure: 'not_found' | 'unpriceable' | null;
  /** 없으면 예시 없이 안내 문구만 나온다. */
  example: Example | null;
  onPickExample: (item: CatalogItem) => void;
}

const STAGE_ORDER: LookupStage[] = ['catalog', 'shopping', 'estimate'];

export function EmptyState({ stage, failure, example, onPickExample }: Props) {
  if (stage) {
    const reached = STAGE_ORDER.indexOf(stage);
    return (
      <div className={`${styles.wrap} ${styles.busy}`}>
        <BurgerIcon className={styles.icon} />
        <p className={`${styles.stage} ${styles.dots}`} aria-live="polite">
          {STAGE_LABELS[stage]}
        </p>
        <div className={styles.track} aria-hidden="true">
          {STAGE_ORDER.map((name, index) => (
            <span
              key={name}
              className={`${styles.tick} ${index <= reached ? styles.tickOn : ''}`}
            />
          ))}
        </div>
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

  if (!example) {
    return (
      <div className={styles.wrap}>
        <BurgerIcon className={styles.icon} />
        <p className={styles.title}>뭘 살지 정해볼까요</p>
        <p className={styles.hint}>
          금액을 넣거나 항목을 눌러보세요. 카탈로그에 없는 것도 이름으로 찾아봅니다.
        </p>
      </div>
    );
  }

  /*
   * 무엇을 해주는 앱인지 말로 설명하는 대신 실제로 계산된 예시를 보여준다.
   * 숫자는 전부 진짜 데이터에서 나오므로 가격이 바뀌면 예시도 따라 바뀌고,
   * 고른 나라·시절도 그대로 반영된다. 설명이 본문과 어긋날 일이 없다.
   */
  const { item, result } = example;
  const height = formatHeight(result.stackHeightCm);
  const work = formatWorkTime(result.workHours);

  return (
    <div className={styles.wrap}>
      <p className={styles.caption}>이런 걸 해 드립니다</p>

      <button
        type="button"
        className={styles.demo}
        onClick={() => onPickExample(item)}
      >
        <span className={styles.from}>
          <span className={styles.fromName}>
            <span aria-hidden="true">{item.emoji}</span> {item.name}
          </span>
          <span className={`${styles.fromPrice} tnum`}>
            {formatWon(item.priceKRW)}
          </span>
        </span>

        <svg className={styles.arrow} viewBox="0 0 12 16" aria-hidden="true">
          <path
            d="M6 1v12M2 9.5l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <span className={styles.to}>
          <span className={styles.toLabel}>빅맥</span>
          <span className={`${styles.toCount} tnum`}>
            {formatKoreanNumber(result.wholeCount)}
          </span>
          <span className={styles.toUnit}>개</span>
        </span>

        <span className={styles.metrics}>
          {formatCalories(result.calories)} · {height.value} · {work.text}
        </span>
      </button>

      <p className={styles.hint}>
        금액을 넣거나 항목을 눌러보세요. 카탈로그에 없는 것도 이름으로 찾아봅니다.
      </p>
    </div>
  );
}
