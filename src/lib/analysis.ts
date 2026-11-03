import type {
  BlockBuildResult,
  DailyBar,
  DailyMetrics,
  FqMode,
  SymbolHit,
} from "./data/types";
import { fetchDailySeries } from "./data/tencent";
import { computeMetrics, filterMetricsByRange } from "./metrics";
import { buildPeriods } from "./periods";
import { analyzeDrift, type DriftAnalysis } from "./stats/drift";
import { fmtRelativeTime } from "./format";

export interface AnalysisOptions {
  symbol: SymbolHit;
  start: string;
  end: string;
  p: number;
  k: number;
  excludeZeroRange: boolean;
  fq: FqMode;
  force?: boolean;
}

export interface AnalysisResult {
  options: AnalysisOptions;
  bars: DailyBar[];
  metrics: DailyMetrics[];
  rangeMetrics: DailyMetrics[];
  blockResult: BlockBuildResult;
  drift: DriftAnalysis;
  dataAsOf: string;
  warnings: string[];
  fromCache: boolean;
  staleCache: boolean;
  cacheAgeMs: number | null;
}

export async function runAnalysis(
  options: AnalysisOptions,
): Promise<AnalysisResult> {
  const series = await fetchDailySeries(
    options.symbol.symbol,
    options.start,
    options.end,
    options.fq,
    options.force,
  );

  const metrics = computeMetrics(series.bars);
  const rangeMetrics = filterMetricsByRange(
    metrics,
    options.start,
    options.end,
  );
  if (rangeMetrics.length === 0) {
    throw new Error("所选区间内没有可计算的交易日，请拉长区间或检查日期。");
  }

  const blockResult = buildPeriods(
    rangeMetrics,
    options.p,
    options.k,
    options.excludeZeroRange,
  );
  const drift = analyzeDrift(blockResult.blocks, blockResult.warnings);

  const warnings: string[] = [];
  if (series.dropped > 0) {
    warnings.push(
      `数据清洗时丢弃 ${series.dropped} 条无效或零成交 K 线（停牌、字段异常等）。`,
    );
  }
  const longGaps = rangeMetrics.filter((row) => row.gapDays > 10).length;
  if (longGaps > 0) {
    warnings.push(
      `区间内有 ${longGaps} 个交易日与前一交易日间隔超过 10 个自然日，可能是停牌；跨停牌日的涨跌幅为多日累计。`,
    );
  }
  if (metrics.length > 0 && rangeMetrics.length > 0) {
    const firstInRange = rangeMetrics[0];
    const hasPrev = metrics.some((row) => row.date < firstInRange.date);
    if (!hasPrev) {
      warnings.push(
        "区间首日缺少前收盘价（可能刚上市），该日不计入指标样本。",
      );
    }
  }
  if (series.stale && series.cachedAt != null) {
    warnings.push(
      `行情请求失败，当前显示 ${fmtRelativeTime(
        Date.now() - series.cachedAt,
      )}的本地缓存。`,
    );
  }

  const allWarnings = [...new Set([...warnings, ...drift.warnings])];

  return {
    options,
    bars: series.bars,
    metrics,
    rangeMetrics,
    blockResult,
    drift,
    dataAsOf: rangeMetrics[rangeMetrics.length - 1].date,
    warnings: allWarnings,
    fromCache: series.fromCache,
    staleCache: series.stale,
    cacheAgeMs:
      series.cachedAt == null ? null : Date.now() - series.cachedAt,
  };
}
