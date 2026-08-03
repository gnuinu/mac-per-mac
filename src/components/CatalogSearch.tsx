import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { searchCatalog } from '../domain/catalog';
import { formatWon } from '../domain/format';
import type { CatalogItem } from '../domain/types';
import styles from './CatalogSearch.module.css';

interface Props {
  catalog: readonly CatalogItem[];
  onPick: (item: CatalogItem) => void;
  /** 카탈로그에 없는 것을 실시간 조회로 넘길 때. */
  onLookup: (query: string) => void;
  busy: boolean;
}

const MAX_OPTIONS = 8;

/**
 * 카탈로그 검색. 부분 일치와 초성 검색을 모두 지원하고(도메인의 searchCatalog),
 * ↑↓/Enter/Esc로 키보드 조작할 수 있다.
 */
export function CatalogSearch({ catalog, onPick, onLookup, busy }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(
    () => (query.trim() ? searchCatalog(catalog, query).slice(0, MAX_OPTIONS) : []),
    [catalog, query],
  );

  const trimmed = query.trim();
  const showList = open && trimmed.length > 0;

  function commit(item: CatalogItem) {
    onPick(item);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function lookup() {
    if (!trimmed || busy) return;
    onLookup(trimmed);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length === 0) return;
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const picked = showList ? options[active] : undefined;
      if (picked) commit(picked);
      else lookup();
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.field}>
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          role="combobox"
          autoComplete="off"
          enterKeyHint="search"
          aria-label="항목 검색"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && options[active] ? `${listId}-${active}` : undefined
          }
          placeholder="이름으로 찾기 (초성도 됩니다)"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={styles.action}
          disabled={!trimmed || busy}
          onMouseDown={(event) => event.preventDefault()}
          onClick={lookup}
        >
          {busy ? '찾는 중' : '찾기'}
        </button>
      </div>

      {showList ? (
        <ul className={styles.list} id={listId} role="listbox" aria-label="검색 결과">
          {options.length === 0 ? (
            <li className={styles.empty}>
              카탈로그에 없어요. <strong>찾기</strong>를 누르면 검색해볼게요.
            </li>
          ) : (
            options.map((item, index) => (
              <li key={item.id} role="none">
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={styles.option}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(item)}
                >
                  <span className={styles.emoji} aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className={styles.name}>{item.name}</span>
                  <span className={`${styles.price} tnum`}>
                    {formatWon(item.priceKRW)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
