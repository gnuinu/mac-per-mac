import rawPrices from '../../public/data/prices.json';
import { parsePriceData } from './catalog';
import type { PriceData } from './types';

/**
 * 번들에 포함되는 fallback 가격 데이터.
 *
 * `public/data/prices.json`을 그대로 import한다. 손으로 복사해 두면 두 벌이
 * 조용히 어긋나므로, 빌드 시점에 같은 파일을 읽어 한 벌로 유지한다.
 * 런타임에는 항상 원본 JSON을 먼저 fetch하고, 실패했을 때만 이 값이 쓰인다.
 */
export const FALLBACK_PRICE_DATA: PriceData = parsePriceData(rawPrices);
