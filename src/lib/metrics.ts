import type { DailyBar, DailyMetrics } from "./data/types";
import { diffCalendarDays } from "./date";

const PRICE_EPS = 1e-6;
const ZERO_RANGE_EPS = 0.0005;

export function isValidBar(bar: DailyBar): boolean {
  const values = [bar.open, bar.close, bar.high, bar.low, bar.volume];
  if (!values.every((value) => Number.isFinite(value))) return false;
  if (bar.open <= 0 || bar.close <= 0 || bar.high <= 0 || bar.low <= 0) {
    return false;
  }
  if (bar.volume < 0) return false;
  if (bar.high < bar.low - PRICE_EPS) return false;
  if (bar.high < Math.max(bar.open, bar.close) - PRICE_EPS) return false;
  if (bar.low > Math.min(bar.open, bar.close) + PRICE_EPS) return false;
  return true;
}

export function computeMetrics(bars: DailyBar[]): DailyMetrics[] {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const valid: DailyBar[] = [];
  const seen = new Set<string>();
  for (const bar of sorted) {
    if (!isValidBar(bar)) continue;
    if (seen.has(bar.date)) continue;
    seen.add(bar.date);
    valid.push(bar);
  }

  const out: DailyMetrics[] = [];
  for (let i = 1; i < valid.length; i += 1) {
    const bar = valid[i];
    const prev = valid[i - 1];
    const prevClose = prev.close;
    if (!(prevClose > 0) || !(bar.open > 0)) continue;

    const openRet = bar.open / prevClose - 1;
    const highRet = bar.high / prevClose - 1;
    const lowRet = bar.low / prevClose - 1;
    const amplitude = (bar.high - bar.low) / prevClose;
    const highVsOpen = bar.high / bar.open - 1;
    const lowVsOpen = bar.low / bar.open - 1;
    const range =
      Math.max(bar.open, bar.high, bar.low, bar.close) -
      Math.min(bar.open, bar.high, bar.low, bar.close);

    if (
      ![openRet, highRet, lowRet, amplitude, highVsOpen, lowVsOpen].every(
        Number.isFinite,
      )
    ) {
      continue;
    }

    out.push({
      ...bar,
      prevClose,
      openRet,
      highRet,
      lowRet,
      amplitude,
      highVsOpen,
      lowVsOpen,
      zeroRange: range <= ZERO_RANGE_EPS,
      gapDays: diffCalendarDays(prev.date, bar.date),
    });
  }
  return out;
}

export function filterMetricsByRange(
  metrics: DailyMetrics[],
  start: string,
  end: string,
): DailyMetrics[] {
  return metrics.filter((row) => row.date >= start && row.date <= end);
}

export function findPreviousBar(
  bars: DailyBar[],
  date: string,
): DailyBar | undefined {
  let candidate: DailyBar | undefined;
  for (const bar of bars) {
    if (bar.date >= date) break;
    candidate = bar;
  }
  return candidate;
}
