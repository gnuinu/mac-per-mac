import { useCallback, useEffect, useRef } from 'react';

export interface UrlState {
  /** 항목 이름. ?q= */
  query: string;
  /** 금액. ?p= */
  priceKRW: number | null;
  /** 비교 기준 나라. ?m= 기본 나라면 null이라 링크에 안 붙는다. */
  marketId: string | null;
}

const EMPTY: UrlState = { query: '', priceKRW: null, marketId: null };

export function readUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const query = params.get('q')?.trim() ?? '';
  const rawPrice = params.get('p');
  const parsed = rawPrice === null ? Number.NaN : Number(rawPrice.replace(/[,\s]/g, ''));
  const marketId = params.get('m')?.trim().toUpperCase() || null;
  return {
    query,
    priceKRW: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
    marketId,
  };
}

export function buildUrlSearch(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.priceKRW !== null && state.priceKRW > 0) {
    params.set('p', String(Math.round(state.priceKRW)));
  }
  if (state.marketId) params.set('m', state.marketId);
  const search = params.toString();
  return search ? `?${search}` : '';
}

/**
 * 앱 상태를 쿼리스트링에 반영하고, 첫 로드 시 복원한다.
 * 히스토리를 오염시키지 않도록 replaceState를 쓴다.
 */
export function useUrlState(state: UrlState): { initial: UrlState } {
  const initial = useRef<UrlState>(
    typeof window === 'undefined' ? EMPTY : readUrlState(window.location.search),
  );

  useEffect(() => {
    const search = buildUrlSearch(state);
    const next = `${window.location.pathname}${search}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, '', next);
  }, [state.query, state.priceKRW, state.marketId]);

  return { initial: initial.current };
}

/** 공유용 절대 URL. */
export function shareUrl(state: UrlState): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}${buildUrlSearch(state)}`;
}

/** 클립보드 복사. 성공 여부를 돌려준다. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function useCallbackRef<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args) => ref.current(...args)) as T, []);
}
