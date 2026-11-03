import {
  ALPHA,
  BOOTSTRAP_REPS,
  LOW_POWER_BLOCK_N,
  METRIC_DEFS,
  MIN_BLOCK_N,
  PERMUTATION_REPS,
} from "../constants";
import type { MetricKey, PeriodBlock } from "../data/types";
import { bhFdr } from "./fdr";
import { bootstrapMedianCI, bootstrapMedianDiffCI } from "./bootstrap";
import { describe, type DescribeResult } from "./describe";
import { ksTwoSample } from "./ks";
import { permutationMaxKs } from "./permutation";

export interface BlockSummary {
  index: number;
  label: string;
  startDate: string;
  endDate: string;
  n: number;
  rawN: number;
  excludedCount: number;
  median: number;
  mean: number;
  std: number;
  q1: number;
  q3: number;
  p5: number;
  p95: number;
  ci: [number, number] | null;
}

export interface AdjacentResult {
  from: number;
  to: number;
  fromLabel: string;
  toLabel: string;
  d: number;
  p: number;
  q: number | null;
}

export type DriftStatus = "ok" | "insufficient" | "constant";

export interface MetricDrift {
  metric: MetricKey;
  label: string;
  status: DriftStatus;
  overall: DescribeResult;
  blocks: BlockSummary[];
  globalP: number | null;
  globalQ: number | null;
  observedD: number | null;
  delta: number | null;
  deltaCI: [number, number] | null;
  iqrRatio: number | null;
  adjacent: AdjacentResult[];
  significantAdjacent: AdjacentResult[];
  verdict: string;
  direction: "up" | "down" | "none" | "unknown";
  warning: string | null;
}

export interface DriftAnalysis {
  metrics: MetricDrift[];
  significantCount: number;
  testedMetrics: number;
  warnings: string[];
}

function blockSummary(
  block: PeriodBlock,
  values: number[],
  metric: MetricKey,
): BlockSummary {
  const stats = describe(values);
  const ci =
    values.length >= 2
      ? bootstrapMedianCI(
          values,
          BOOTSTRAP_REPS,
          `${metric}|block|${block.index}|${block.startDate}|${block.endDate}|${values.length}`,
        )
      : null;
  return {
    index: block.index,
    label: block.label,
    startDate: block.startDate,
    endDate: block.endDate,
    n: values.length,
    rawN: block.raw.length,
    excludedCount: block.excludedCount,
    median: stats.median,
    mean: stats.mean,
    std: stats.std,
    q1: stats.p25,
    q3: stats.p75,
    p5: stats.p5,
    p95: stats.p95,
    ci: ci ? [ci.low, ci.high] : null,
  };
}

export function analyzeDrift(
  blocks: PeriodBlock[],
  seedWarnings: string[] = [],
): DriftAnalysis {
  const warnings = [...seedWarnings];
  if (blocks.length < 2) {
    return {
      metrics: [],
      significantCount: 0,
      testedMetrics: 0,
      warnings: [
        ...warnings,
        "完整周期不足 2 段，无法进行分布漂移检验。",
      ],
    };
  }

  const results: MetricDrift[] = METRIC_DEFS.map((def) => {
    const groups = blocks.map((block) =>
      block.rows
        .map((row) => row[def.key])
        .filter((value) => Number.isFinite(value)),
    );
    const pooled = groups.flat();
    const overall = describe(pooled);
    const summaries = blocks.map((block, index) =>
      blockSummary(block, groups[index], def.key),
    );
    const minN = Math.min(...groups.map((group) => group.length));
    const allConstant =
      pooled.length > 0 && pooled.every((value) => value === pooled[0]);

    let status: DriftStatus = "ok";
    let warning: string | null = null;
    if (allConstant) {
      status = "constant";
      warning = "该指标在所有周期内为常数，无法检验分布差异。";
    } else if (minN < MIN_BLOCK_N) {
      status = "insufficient";
      warning = `至少一个周期有效样本不足 ${MIN_BLOCK_N} 日（最小 ${minN} 日），未做分布检验。`;
    } else if (minN < LOW_POWER_BLOCK_N) {
      warning = `部分周期有效样本少于 ${LOW_POWER_BLOCK_N} 日，检验功效有限。`;
    }

    let globalP: number | null = null;
    let observedD: number | null = null;
    if (status === "ok") {
      const permutation = permutationMaxKs(
        groups,
        PERMUTATION_REPS,
        `${def.key}|global|${blocks
          .map((block) => `${block.startDate}:${block.endDate}:${block.rows.length}`)
          .join("|")}`,
      );
      globalP = permutation.p;
      observedD = permutation.observedD;
    }

    let delta: number | null = null;
    let deltaCI: [number, number] | null = null;
    const first = groups[0];
    const last = groups[groups.length - 1];
    if (first.length > 0 && last.length > 0) {
      const diff = bootstrapMedianDiffCI(
        last,
        first,
        BOOTSTRAP_REPS,
        `${def.key}|delta|${blocks[0].startDate}|${blocks[blocks.length - 1].endDate}`,
      );
      if (Number.isFinite(diff.delta)) {
        delta = diff.delta;
        deltaCI = [diff.low, diff.high];
      }
    }

    const firstSummary = summaries[0];
    const lastSummary = summaries[summaries.length - 1];
    const iqrRatio =
      firstSummary && lastSummary &&
      Number.isFinite(firstSummary.q3 - firstSummary.q1) &&
      firstSummary.q3 - firstSummary.q1 > 0
        ? (lastSummary.q3 - lastSummary.q1) /
          (firstSummary.q3 - firstSummary.q1)
        : null;

    const adjacent: AdjacentResult[] = [];
    for (let i = 0; i < groups.length - 1; i += 1) {
      const left = groups[i];
      const right = groups[i + 1];
      if (left.length < MIN_BLOCK_N || right.length < MIN_BLOCK_N) continue;
      const ks = ksTwoSample(left, right);
      adjacent.push({
        from: blocks[i].index,
        to: blocks[i + 1].index,
        fromLabel: blocks[i].label,
        toLabel: blocks[i + 1].label,
        d: ks.d,
        p: ks.p,
        q: null,
      });
    }

    return {
      metric: def.key,
      label: def.label,
      status,
      overall,
      blocks: summaries,
      globalP,
      globalQ: null,
      observedD,
      delta,
      deltaCI,
      iqrRatio,
      adjacent,
      significantAdjacent: [],
      verdict: "待计算",
      direction: "unknown",
      warning,
    };
  });

  const globalQs = bhFdr(results.map((result) => result.globalP));
  results.forEach((result, index) => {
    result.globalQ = globalQs[index];
  });

  const adjacentRefs: Array<{
    result: MetricDrift;
    item: AdjacentResult;
  }> = [];
  for (const result of results) {
    for (const item of result.adjacent) {
      adjacentRefs.push({ result, item });
    }
  }
  const adjacentQs = bhFdr(adjacentRefs.map((entry) => entry.item.p));
  adjacentRefs.forEach((entry, index) => {
    entry.item.q = adjacentQs[index];
  });

  let significantCount = 0;
  for (const result of results) {
    if (result.globalQ != null && result.globalQ < ALPHA) {
      significantCount += 1;
      result.significantAdjacent = result.adjacent.filter(
        (item) => item.q != null && item.q < ALPHA,
      );
      if (result.deltaCI) {
        if (result.deltaCI[0] > 0) {
          result.direction = "up";
          result.verdict = "显著上行漂移";
        } else if (result.deltaCI[1] < 0) {
          result.direction = "down";
          result.verdict = "显著下行漂移";
        } else {
          result.direction = "none";
          result.verdict = "显著，但非中位数漂移";
        }
      } else {
        result.direction = "unknown";
        result.verdict = "显著分布漂移";
      }
    } else if (result.status === "insufficient") {
      result.verdict = "样本不足";
      result.direction = "unknown";
    } else if (result.status === "constant") {
      result.verdict = "无变化（常数）";
      result.direction = "none";
    } else {
      result.verdict = "未检出显著漂移";
      result.direction = "none";
    }
  }

  const lowPower = results.find((result) =>
    result.warning?.includes("功效有限"),
  );
  if (lowPower) {
    warnings.push("部分周期有效样本少于 20 日，p 值仅作参考，重点看效应量和 CI。");
  }

  return {
    metrics: results,
    significantCount,
    testedMetrics: results.filter((result) => result.status === "ok").length,
    warnings,
  };
}

export function driftByMetric(
  analysis: DriftAnalysis,
): Record<MetricKey, MetricDrift | undefined> {
  return Object.fromEntries(
    analysis.metrics.map((result) => [result.metric, result]),
  ) as Record<MetricKey, MetricDrift | undefined>;
}
