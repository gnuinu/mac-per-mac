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

    loadPrices({ signal: controller.signal, fallback: FALLBACK_PRICE_DATA }).then(
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
