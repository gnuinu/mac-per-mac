import { SCALE_LABELS } from '../domain/bigmac';
import {
  formatCalories,
  formatCount,
  formatHeight,
  formatKoreanNumber,
  formatWon,
  formatWorkTime,
} from '../domain/format';
import type { BigMacResult } from '../domain/types';
import type { PriceLookupResult } from '../services/priceLookup';
import { HeightCompare } from './HeightCompare';
import { MetricRow } from './MetricRow';
import styles from './ResultPanel.module.css';

interface Props {
  subject: string;
  priceKRW: number;
  bigMacPriceKRW: number;
  result: BigMacResult;
  lookup: PriceLookupResult | null;
}

const SOURCE_BADGE: Record<PriceLookupResult['source'], string | null> = {
  catalog: null,
  shopping: '쇼핑몰 최저가 기준',
  estimate: '추정치',
};

export function ResultPanel({
  subject,
  priceKRW,
  bigMacPriceKRW,
  result,
  lookup,
}: Props) {
  const height = formatHeight(result.stackHeightCm);
  const work = formatWorkTime(result.workHours);
  const badge = lookup ? SOURCE_BADGE[lookup.source] : null;
  const uncertain = lookup?.confidence === 'estimated';

  return (
    <section className={styles.wrap} aria-label="환산 결과">
      <div className={styles.head}>
        <p className={styles.subject}>
          <span className={styles.name}>{subject}</span>
          <span className={`${styles.price} tnum`}>{formatWon(priceKRW)}</span>
        </p>
        {badge ? (
          <div className={styles.badges}>
            <span className={styles.badge}>{badge}</span>
          </div>
        ) : null}
      </div>

      <div>
        <p className={styles.headline}>
          <span className={`${styles.count} tnum`}>
            {formatKoreanNumber(result.wholeCount)}
          </span>
          <span className={styles.countUnit}>개</span>
        </p>
        <p className={styles.scale}>{SCALE_LABELS[result.scale]}</p>
      </div>

      {/*
        지표보다 먼저 보여준다. 세로가 짧은 휴대폰에서 첫 화면에 남아야 할 것은
        큰 숫자와 이 그림이고, 세 줄짜리 수치는 스크롤해서 봐도 되는 참고 정보다.
      */}
      <HeightCompare
        stackCm={result.stackHeightCm}
        comparison={height.comparison}
        burgerCount={result.count}
      />

      <hr className={styles.rule} />

      <div className={styles.metrics}>
        {/* 지표는 순차로 스며 나오게 한다. reduced-motion은 reset.css가 죽인다. */}
        <MetricRow label="총 열량" value={formatCalories(result.calories)} delayMs={0} />
        <MetricRow
          label="쌓은 높이"
          value={height.value}
          sub={height.analogy}
          delayMs={60}
        />
        <MetricRow
          label="필요 노동시간"
          value={work.text}
          delayMs={120}
          {...(work.note ? { sub: work.note } : {})}
        />
      </div>

      <hr className={styles.rule} />

      {result.remainderKRW > 0 && result.wholeCount > 0 ? (
        <p className={styles.remainder}>
          그리고 <strong className="tnum">{formatWon(result.remainderKRW)}</strong>이
          남아요.
        </p>
      ) : null}

      {result.wholeCount === 0 ? (
        <p className={styles.remainder}>
          한 개까지{' '}
          <strong className="tnum">{formatWon(bigMacPriceKRW - priceKRW)}</strong>{' '}
          모자라요.
        </p>
      ) : null}

      {lookup?.note || lookup?.sourceUrl ? (
        <p className={styles.note}>
          {lookup.note ? <span>{lookup.note}</span> : null}
          {lookup.sourceUrl ? (
            <a
              className={styles.source}
              href={lookup.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              출처
            </a>
          ) : null}
        </p>
      ) : null}

      <p className="visually-hidden">
        빅맥 {formatCount(result.wholeCount)}, 총 열량{' '}
        {formatCalories(result.calories)}, 쌓은 높이 {height.value} ({height.analogy}),
        필요 노동시간 {work.text}
        {uncertain ? ', 가격은 추정치입니다' : ''}
      </p>
    </section>
  );
}
