import type { QuoteSnapshot } from "./data/tencent";
import type { DailyMetricValues } from "./metrics";
import { computeMetricValues, isValidBar } from "./metrics";
import { todayShanghai } from "./date";

export interface MarketSnapshot extends QuoteSnapshot, DailyMetricValues {
  isToday: boolean;
}

/** 把实时行情转成与日线样本同口径的六项指标。 */
export function buildMarketSnapshot(
  quote: QuoteSnapshot,
  today = todayShanghai(),
): MarketSnapshot | null {
  if (!isValidBar(quote)) return null;
  const values = computeMetricValues(quote, quote.prevClose);
  if (!values) return null;
  return {
    ...quote,
    ...values,
    isToday: quote.date === today,
  };
}
