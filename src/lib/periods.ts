import type {
  BlockBuildResult,
  DailyMetrics,
  PeriodBlock,
} from "./data/types";

export function buildPeriods(
  metrics: DailyMetrics[],
  requestedP: number,
  requestedK: number,
  excludeZeroRange: boolean,
): BlockBuildResult {
  const warnings: string[] = [];
  const p = Math.max(1, Math.floor(requestedP));
  const k = Math.max(1, Math.floor(requestedK));
  const n = metrics.length;

  if (n < 2 * p) {
    return {
      blocks: [],
      effectiveK: 0,
      requestedK: k,
      effectiveP: p,
      leftover: metrics,
      warnings: [
        `区间内只有 ${n} 个交易日，不足以切出 2 个周期（每段 ${p} 日）。请缩短周期或拉长区间。`,
      ],
    };
  }

  const effectiveK = Math.min(k, Math.floor(n / p));
  if (effectiveK < k) {
    warnings.push(
      `区间内只有 ${n} 个交易日，最多容纳 ${effectiveK} 个完整周期；已按 K=${effectiveK} 计算，可拉长区间容纳 ${k} 段。`,
    );
  }

  const needed = effectiveK * p;
  const startIndex = n - needed;
  const leftover = metrics.slice(0, startIndex);
  const blocks: PeriodBlock[] = [];

  for (let index = 0; index < effectiveK; index += 1) {
    const raw = metrics.slice(
      startIndex + index * p,
      startIndex + (index + 1) * p,
    );
    const rows = excludeZeroRange
      ? raw.filter((row) => !row.zeroRange)
      : raw;
    const excludedCount = raw.length - rows.length;
    if (excludedCount > 0) {
      warnings.push(
        `B${index + 1} 剔除 ${excludedCount} 个零振幅日，有效样本 ${rows.length} 日。`,
      );
    }
    blocks.push({
      index: index + 1,
      label: `B${index + 1}`,
      startDate: raw[0]?.date ?? "",
      endDate: raw[raw.length - 1]?.date ?? "",
      raw,
      rows,
      excludedCount,
    });
  }

  return {
    blocks,
    effectiveK,
    requestedK: k,
    effectiveP: p,
    leftover,
    warnings,
  };
}
