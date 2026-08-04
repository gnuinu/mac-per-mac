import { useLayoutEffect, useRef, type ChangeEvent } from 'react';
import styles from './AmountInput.module.css';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** 입력 중에는 부모가 입력 영역을 접지 않도록 알린다. */
  onFocusChange?: ((focused: boolean) => void) | undefined;
}

const MAX_DIGITS = 18;

function digitsOnly(text: string): string {
  return text.replace(/\D/g, '').slice(0, MAX_DIGITS);
}

function withCommas(digits: string): string {
  if (digits.length === 0) return '';
  return Number(digits).toLocaleString('en-US');
}

/** 커서 앞에 숫자가 몇 개 있는지. 콤마가 끼어들어도 위치를 잃지 않게 하는 기준값. */
function digitsBefore(text: string, caret: number): number {
  return digitsOnly(text.slice(0, caret)).length;
}

/** 숫자를 n개 지난 지점의 문자 인덱스. */
function caretAfterDigits(text: string, count: number): number {
  if (count === 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i]!)) {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
}

/**
 * 천 단위 콤마를 자동으로 넣는 금액 입력.
 * 콤마가 삽입/삭제돼도 커서가 튀지 않도록 "커서 앞 숫자 개수"를 기준으로 복원한다.
 */
export function AmountInput({ value, onChange, onFocusChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const display = value === null ? '' : withCommas(String(Math.round(value)));

  // 억 단위를 넘어가면 기본 크기로는 "원"을 밀어내고 잘린다. 길이에 맞춰 줄인다.
  const scale =
    display.length > 13 ? 0.55 : display.length > 10 ? 0.7 : display.length > 8 ? 0.85 : 1;

  useLayoutEffect(() => {
    const input = ref.current;
    const caret = pendingCaret.current;
    if (input && caret !== null) {
      input.setSelectionRange(caret, caret);
      pendingCaret.current = null;
    }
  });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const digits = digitsOnly(raw);

    pendingCaret.current = caretAfterDigits(
      withCommas(digits),
      digitsBefore(raw, caret),
    );

    onChange(digits.length === 0 ? null : Number(digits));
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>직접 입력</span>
      <input
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        ref={ref}
        className={`${styles.input} tnum`}
        style={{ fontSize: `calc(var(--amount-size) * ${scale})` }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        aria-label="금액 (원)"
        placeholder="0"
        value={display}
        onChange={handleChange}
      />
      <span className={styles.unit}>원</span>
    </div>
  );
}
