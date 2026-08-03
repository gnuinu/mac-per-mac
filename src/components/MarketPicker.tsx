import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toBigMacs } from '../domain/bigmac';
import { formatCount, formatWon } from '../domain/format';
import {
  bigMacPriceKRW,
  formatMarketPrice,
  formatValuation,
  valuationGap,
} from '../domain/market';
import type { Market } from '../domain/types';
import styles from './MarketPicker.module.css';

interface Props {
  markets: readonly Market[];
  selected: Market;
  base: Market;
  /** 현재 금액. 나라마다 몇 개인지 미리 계산해 보여주는 데 쓴다. */
  priceKRW: number | null;
  onSelect: (market: Market) => void;
}

/**
 * 헤더의 빅맥 가격 알약을 눌러 여는 나라 목록.
 *
 * 고르는 화면이 곧 비교 화면이다. 각 줄에 현재 금액 기준 개수를 함께 적어두면
 * 목록을 훑는 동안 비교가 끝나므로, 본 화면에 비교표를 위한 세로 공간을
 * 따로 낼 필요가 없다. 이 앱에서 세로는 늘 모자란 자원이다.
 */
export function MarketPicker({ markets, selected, base, priceKRW, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const rows = useMemo(() => {
    return markets.map((market) => {
      const unit = bigMacPriceKRW(market);
      const count = priceKRW === null ? null : toBigMacs(priceKRW, unit).wholeCount;
      return { market, count, price: formatMarketPrice(market) };
    });
  }, [markets, priceKRW]);

  // 바깥 클릭과 Escape로 닫는다. 외부 UI 라이브러리를 쓰지 않기로 해서 직접 짰다.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const gap = selected.id === base.id ? null : formatValuation(valuationGap(base, selected));

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`빅맥 가격 기준 나라. 현재 ${selected.name}. 눌러서 바꾸기`}
      >
        <span className={styles.flagless}>{selected.name}</span>
        <span className={`${styles.price} tnum`}>{formatMarketPrice(selected)}</span>
        <svg className={styles.caret} viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open ? (
        <div className={styles.sheet} id={listId} role="listbox" aria-label="나라 고르기">
          <p className={styles.caption}>빅맥 한 개 값으로 견주기</p>

          <ul className={styles.list}>
            {rows.map(({ market, count, price }) => {
              const active = market.id === selected.id;
              return (
                <li key={market.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${styles.row} ${active ? styles.active : ''}`}
                    onClick={() => {
                      onSelect(market);
                      setOpen(false);
                    }}
                  >
                    <span className={styles.name}>
                      {market.name}
                      {market.uncertain ? (
                        <em className={styles.badge}>추정</em>
                      ) : null}
                    </span>
                    <span className={`${styles.rowPrice} tnum`}>{price}</span>
                    <span className={styles.dots} aria-hidden="true" />
                    <span className={`${styles.count} tnum`}>
                      {count === null ? '—' : formatCount(count)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected.note ? <p className={styles.note}>{selected.note}</p> : null}

          {gap ? (
            <p className={styles.note}>
              빅맥 가격만 놓고 보면 원화는 {selected.name} 통화 대비 {gap}입니다.
            </p>
          ) : null}

          <p className={styles.note}>
            {selected.name} 최저시급 {formatWon(Math.round(selected.minimumWage * selected.fxToKRW))}
            {' 기준 · '}
            환율은 {selected.updatedAt} 기준입니다.
          </p>
        </div>
      ) : null}
    </div>
  );
}
