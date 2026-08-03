import { useEffect, useMemo, useReducer, useRef } from 'react';
import { toBigMacs } from './domain/bigmac';
import { popularItems } from './domain/catalog';
import { formatWon } from './domain/format';
import type { CatalogItem } from './domain/types';
import { usePrices } from './hooks/usePrices';
import { shareUrl as buildShareUrl, useUrlState } from './hooks/useUrlState';
import {
  PriceLookupError,
  lookupPrice,
  type LookupStage,
  type PriceLookupResult,
} from './services/priceLookup';
import { AmountInput } from './components/AmountInput';
import { BurgerGrid } from './components/BurgerGrid';
import { CatalogSearch } from './components/CatalogSearch';
import { EmptyState } from './components/EmptyState';
import { PresetChips } from './components/PresetChips';
import { ResultPanel } from './components/ResultPanel';
import { ShareBar } from './components/ShareBar';
import { BurgerIcon } from './components/icons/BurgerIcon';
import styles from './App.module.css';

interface State {
  /** 무엇의 가격인지. 직접 입력이면 빈 문자열. */
  subject: string;
  priceKRW: number | null;
  /** 어디서 온 가격인지. 직접 입력이면 null. */
  lookup: PriceLookupResult | null;
  /** 카탈로그에서 고른 항목 id. 칩 활성 표시에 쓴다. */
  pickedId: string | null;
  stage: LookupStage | null;
  failure: 'not_found' | 'unpriceable' | null;
}

type Action =
  | { type: 'amount'; priceKRW: number | null }
  | { type: 'pick'; item: CatalogItem }
  | { type: 'restore'; subject: string; priceKRW: number }
  | { type: 'lookupStart' }
  | { type: 'lookupStage'; stage: LookupStage }
  | { type: 'lookupDone'; result: PriceLookupResult }
  | { type: 'lookupFail'; failure: 'not_found' | 'unpriceable' };

/**
 * 'none'이면 원격 조회 단계를 끈다. 미설정이면 같은 출처(`/api/…`).
 * 빌드 시점에 박히므로 런타임 분기는 없다.
 */
const API_BASE_URL: string | null =
  import.meta.env.VITE_API_BASE_URL === 'none'
    ? null
    : (import.meta.env.VITE_API_BASE_URL ?? '');

const INITIAL: State = {
  subject: '',
  priceKRW: null,
  lookup: null,
  pickedId: null,
  stage: null,
  failure: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'amount':
      return {
        ...INITIAL,
        subject: '입력한 금액',
        priceKRW: action.priceKRW,
      };

    case 'pick':
      return {
        ...INITIAL,
        subject: action.item.name,
        priceKRW: action.item.priceKRW,
        pickedId: action.item.id,
        lookup: {
          priceKRW: action.item.priceKRW,
          label: action.item.name,
          source: 'catalog',
          confidence: action.item.uncertain ? 'estimated' : 'exact',
          note: action.item.priceNote,
        },
      };

    case 'restore':
      return {
        ...INITIAL,
        subject: action.subject || '입력한 금액',
        priceKRW: action.priceKRW,
      };

    case 'lookupStart':
      return { ...state, stage: 'catalog', failure: null };

    case 'lookupStage':
      return { ...state, stage: action.stage };

    case 'lookupDone':
      return {
        subject: action.result.label,
        priceKRW: action.result.priceKRW,
        lookup: action.result,
        pickedId: null,
        stage: null,
        failure: null,
      };

    case 'lookupFail':
      return { ...state, stage: null, failure: action.failure };
  }
}

export default function App() {
  const { data, origin } = usePrices();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const restored = useRef(false);

  const { initial } = useUrlState({ query: state.subject, priceKRW: state.priceKRW });

  // ?q=&p= 로 들어온 상태를 한 번만 복원한다.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    if (initial.priceKRW !== null) {
      dispatch({
        type: 'restore',
        subject: initial.query,
        priceKRW: initial.priceKRW,
      });
      return;
    }
    if (initial.query) {
      const item = data.catalog.find((entry) => entry.name === initial.query);
      if (item) dispatch({ type: 'pick', item });
    }
  }, [data.catalog, initial]);

  const chips = useMemo(() => popularItems(data.catalog), [data.catalog]);

  const result = useMemo(() => {
    if (state.priceKRW === null) return null;
    return toBigMacs(state.priceKRW, data.bigMac.priceKRW, {
      caloriesPerUnit: data.bigMac.caloriesPerUnit,
      heightCm: data.bigMac.heightCm,
      minimumWageKRW: data.minimumWageKRW,
    });
  }, [state.priceKRW, data]);

  async function runLookup(query: string) {
    dispatch({ type: 'lookupStart' });
    try {
      const found = await lookupPrice(query, {
        catalog: data.catalog,
        apiBaseUrl: API_BASE_URL,
        onStage: (stage) => dispatch({ type: 'lookupStage', stage }),
      });
      dispatch({ type: 'lookupDone', result: found });
    } catch (error) {
      dispatch({
        type: 'lookupFail',
        failure: error instanceof PriceLookupError ? error.reason : 'not_found',
      });
    }
  }

  const badge =
    state.lookup?.source === 'estimate'
      ? '추정치'
      : state.lookup?.source === 'shopping'
        ? '쇼핑몰 최저가 기준'
        : undefined;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.brand}>
          <BurgerIcon className={styles.brandMark} />
          빅맥계산기
        </h1>
        <p className={styles.meta}>
          <span>빅맥 {formatWon(data.bigMac.priceKRW)}</span>
          <span className={styles.metaDate}>{data.bigMac.updatedAt}</span>
          {origin === 'fallback' ? (
            <span className={styles.offline}>오프라인</span>
          ) : null}
        </p>
      </header>

      <div className={styles.body}>
        <div className={styles.input}>
          <AmountInput
            value={state.priceKRW}
            onChange={(priceKRW) => dispatch({ type: 'amount', priceKRW })}
          />
          <CatalogSearch
            catalog={data.catalog}
            busy={state.stage !== null}
            onPick={(item) => dispatch({ type: 'pick', item })}
            onLookup={runLookup}
          />
          <div className={styles.chipsGroup}>
            <p className={styles.sectionLabel}>바로 눌러보기</p>
            <PresetChips
              items={chips}
              activeId={state.pickedId}
              onPick={(item) => dispatch({ type: 'pick', item })}
            />
          </div>
        </div>

        <div className={styles.panel}>
          {result && state.priceKRW !== null && state.stage === null ? (
            <>
              <ResultPanel
                subject={state.subject}
                priceKRW={state.priceKRW}
                bigMacPriceKRW={data.bigMac.priceKRW}
                result={result}
                lookup={state.lookup}
              />
              <BurgerGrid count={result.count} />
              <ShareBar
                subject={state.subject}
                priceKRW={state.priceKRW}
                bigMacPriceKRW={data.bigMac.priceKRW}
                result={result}
                {...(badge ? { badge } : {})}
                shareUrl={buildShareUrl({
                  query: state.subject,
                  priceKRW: state.priceKRW,
                })}
              />
            </>
          ) : (
            <EmptyState stage={state.stage} failure={state.failure} />
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <span>출처: {data.bigMac.source}</span>
        <span>최저시급 {formatWon(data.minimumWageKRW)} 기준</span>
      </footer>
    </div>
  );
}
