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
          {subject} · <span className="tnum">{formatWon(priceKRW)}</span>
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

      <hr className={styles.rule} />

      <div className={styles.metrics}>
        <MetricRow label="총 열량" value={formatCalories(result.calories)} />
        <MetricRow label="쌓은 높이" value={height.value} sub={height.analogy} />
        <MetricRow
          label="필요 노동시간"
          value={work.text}
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
