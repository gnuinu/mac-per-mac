import { useEffect, useMemo, useReducer, useRef } from 'react';
import { toBigMacs } from './domain/bigmac';
import { popularItems } from './domain/catalog';
import { formatWon } from './domain/format';
import { bigMacPriceKRW, minimumWageKRW, resolveMarket } from './domain/market';
import type { CatalogItem, Market } from './domain/types';
import { altUnitCounts } from './domain/units';
import { usePrices } from './hooks/usePrices';
import { shareUrl as buildShareUrl, useUrlState } from './hooks/useUrlState';
import {
  PriceLookupError,
  lookupPrice,
  type LookupStage,
  type PriceLookupResult,
} from './services/priceLookup';
import { AmountInput } from './components/AmountInput';
import { AltUnits } from './components/AltUnits';
import { CatalogSearch } from './components/CatalogSearch';
import { EmptyState, type Example } from './components/EmptyState';
import { MarketPicker } from './components/MarketPicker';
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
  /** 비교 기준 나라 id. null이면 데이터의 기본 나라. */
  marketId: string | null;
}

type Action =
  | { type: 'amount'; priceKRW: number | null }
  | { type: 'pick'; item: CatalogItem }
  | { type: 'restore'; subject: string; priceKRW: number }
  | { type: 'market'; marketId: string }
  | { type: 'reset' }
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

/** 빈 화면 시연에 쓸 항목. 크기가 와닿고 이름이 익숙한 쪽으로 골랐다. */
const EXAMPLE_ID = 'mac-mini';

const INITIAL: State = {
  subject: '',
  priceKRW: null,
  lookup: null,
  pickedId: null,
  stage: null,
  failure: null,
  marketId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    // 나라는 금액·항목과 다른 축이다. 다른 걸 눌렀다고 기준이 한국으로
    // 돌아가버리면, 나라를 바꿔놓고 이것저것 눌러보는 흐름이 끊긴다.
    case 'amount':
      return {
        ...INITIAL,
        marketId: state.marketId,
        subject: '입력한 금액',
        priceKRW: action.priceKRW,
      };

    case 'market':
      return { ...state, marketId: action.marketId };

    // 기준까지 되돌린다. "초기화"라는 말의 가장 곧은 뜻이고, 기준만 남기면
    // 왜 안 지워졌는지 되묻게 된다.
    case 'reset':
      return INITIAL;

    case 'pick':
      return {
        ...INITIAL,
        marketId: state.marketId,
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
        marketId: state.marketId,
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
        marketId: state.marketId,
      };

    case 'lookupFail':
      return { ...state, stage: null, failure: action.failure };
  }
}

export default function App() {
  const { data, origin } = usePrices();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const restored = useRef(false);

  const market = resolveMarket(data.markets, state.marketId, data.defaultMarketId);
  const baseMarket = resolveMarket(data.markets, null, data.defaultMarketId);

  const { initial } = useUrlState({
    query: state.subject,
    priceKRW: state.priceKRW,
    // 기본 나라는 링크에 안 붙인다. 한국 링크가 굳이 ?m=KR을 달 이유가 없다.
    marketId: market.id === data.defaultMarketId ? null : market.id,
  });

  // ?q=&p= 로 들어온 상태를 한 번만 복원한다.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    if (initial.marketId) dispatch({ type: 'market', marketId: initial.marketId });

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

  /*
   * 빈 화면에서 "무엇을 해주는 앱인지"를 말 대신 계산으로 보여준다.
   * 값을 그때그때 계산하므로 가격이 바뀌거나 나라·시절을 바꾸면 예시도 따라간다 —
   * 손으로 적어둔 설명이 본문과 어긋나는 일이 없다.
   */
  const example = useMemo<Example | null>(() => {
    const item =
      data.catalog.find((entry) => entry.id === EXAMPLE_ID) ?? data.catalog[0];
    if (!item) return null;
    return {
      item,
      result: toBigMacs(item.priceKRW, bigMacPriceKRW(market), {
        caloriesPerUnit: data.bigMac.caloriesPerUnit,
        heightCm: data.bigMac.heightCm,
        minimumWageKRW: minimumWageKRW(market),
      }),
    };
  }, [data, market]);

  const altUnits = useMemo(
    () =>
      state.priceKRW === null
        ? []
        : altUnitCounts(data.catalog, state.priceKRW, state.pickedId),
    [data.catalog, state.priceKRW, state.pickedId],
  );

  const result = useMemo(() => {
    if (state.priceKRW === null) return null;
    // 나라를 바꾸는 일은 이 두 인자를 바꿔 넣는 일에 지나지 않는다.
    // 열량·높이는 빅맥이라는 물건 자체의 성질이라 나라를 타지 않는다.
    return toBigMacs(state.priceKRW, bigMacPriceKRW(market), {
      caloriesPerUnit: data.bigMac.caloriesPerUnit,
      heightCm: data.bigMac.heightCm,
      minimumWageKRW: minimumWageKRW(market),
    });
  }, [state.priceKRW, data, market]);

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
          {/* 무엇을 해주는 앱인지 늘 붙어 있게 한다. 빈 화면의 시연은 결과가
              뜨는 순간 사라지지만, 이 한 줄은 남는다. */}
          <span className={styles.tagline}>아무 가격이나 빅맥 개수로</span>
        </h1>
        <div className={styles.meta}>
          {origin === 'fallback' ? (
            <span className={styles.offline}>오프라인</span>
          ) : null}
          <MarketPicker
            markets={data.markets}
            selected={market}
            base={baseMarket}
            priceKRW={state.priceKRW}
            onSelect={(picked: Market) =>
              dispatch({ type: 'market', marketId: picked.id })
            }
          />
        </div>
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
              {/* 넘치는 만큼은 여기서만 스크롤한다. 공유 버튼은 밖에 있어서
                  화면 크기와 상관없이 늘 눈에 남는다. */}
              <div className={styles.panelScroll}>
                <ResultPanel
                  subject={state.subject}
                  priceKRW={state.priceKRW}
                  bigMacPriceKRW={bigMacPriceKRW(market)}
                  result={result}
                  lookup={state.lookup}
                />
                <AltUnits
                  units={altUnits}
                  onPick={(id) => {
                    const item = data.catalog.find((entry) => entry.id === id);
                    if (item) dispatch({ type: 'pick', item });
                  }}
                />
              </div>
              <ShareBar
                subject={state.subject}
                priceKRW={state.priceKRW}
                bigMacPriceKRW={bigMacPriceKRW(market)}
                result={result}
                {...(badge ? { badge } : {})}
                {...(market.id === data.defaultMarketId
                  ? {}
                  : { marketName: market.name })}
                onReset={() => dispatch({ type: 'reset' })}
                shareUrl={buildShareUrl({
                  query: state.subject,
                  priceKRW: state.priceKRW,
                  marketId: market.id === data.defaultMarketId ? null : market.id,
                })}
              />
            </>
          ) : (
            <EmptyState
              stage={state.stage}
              failure={state.failure}
              example={example}
              onPickExample={(item) => dispatch({ type: 'pick', item })}
            />
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <span>출처: {market.source}</span>
        <span>최저시급 {formatWon(Math.round(minimumWageKRW(market)))} 기준</span>
      </footer>
    </div>
  );
}
