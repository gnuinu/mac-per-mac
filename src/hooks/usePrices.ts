import { useEffect, useState } from 'react';
import { loadPrices, type PriceOrigin } from '../domain/catalog';
import { FALLBACK_PRICE_DATA } from '../domain/fallback';
import type { PriceData } from '../domain/types';

export interface PricesState {
  data: PriceData;
  origin: PriceOrigin;
  loading: boolean;
}

/**
 * prices.json을 불러온다. 실패하면 번들에 든 fallback으로 조용히 떨어지므로
 * 이 훅은 에러 상태를 노출하지 않는다 — 언제나 쓸 수 있는 데이터가 있다.
 */
export function usePrices(): PricesState {
  const [state, setState] = useState<PricesState>({
    data: FALLBACK_PRICE_DATA,
    origin: 'fallback',
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    // base 해석은 UI 레이어에서 한다. 도메인에 import.meta.env를 들이면
    // "도메인은 순수 TS" 제약이 깨진다. BASE_URL은 항상 '/'로 끝난다.
    loadPrices({
      url: `${import.meta.env.BASE_URL}data/prices.json`,
      signal: controller.signal,
      fallback: FALLBACK_PRICE_DATA,
    }).then(
      (result) => {
        if (!alive) return;
        setState({ data: result.data, origin: result.origin, loading: false });
      },
    );

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  return state;
}
