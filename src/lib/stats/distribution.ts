import type { MetricKey } from "../data/types";

export const HISTOGRAM_BIN_WIDTH_PCT = 0.25;

export type DistributionAxisMode = "symmetric" | "nonnegative" | "nonpositive";

export interface DistributionAxis {
  minPct: number;
  maxPct: number;
  edgesPct: number[];
}

const EPS = 1e-9;

export function axisModeForMetric(metric: MetricKey): DistributionAxisMode {
  if (metric === "amplitude" || metric === "highVsOpen") return "nonnegative";
  if (metric === "lowVsOpen") return "nonpositive";
  return "symmetric";
}

function snapUp(valuePct: number, width: number): number {
  if (!Number.isFinite(valuePct) || valuePct <= 0) return width;
  return Math.ceil((valuePct - EPS) / width) * width;
}

function roundPct(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * 把指标值（小数比例）换算成百分数坐标，并按固定宽度对齐。
 * 正负指标以 0 为中心对称；振幅、最高相对开盘从 0 起；
 * 最低相对开盘到 0 止。
 */
export function distributionAxis(
  values: number[],
  mode: DistributionAxisMode,
  binWidthPct = HISTOGRAM_BIN_WIDTH_PCT,
): DistributionAxis {
  const width = binWidthPct > 0 ? binWidthPct : HISTOGRAM_BIN_WIDTH_PCT;
  const pcts = values
    .filter((value) => Number.isFinite(value))
    .map((value) => value * 100);
  const min = pcts.length > 0 ? Math.min(...pcts) : 0;
  const max = pcts.length > 0 ? Math.max(...pcts) : 0;

  let minPct = 0;
  let maxPct = 0;
  if (mode === "symmetric") {
    const half = Math.max(
      snapUp(Math.abs(min), width),
      snapUp(Math.abs(max), width),
      width,
    );
    minPct = -half;
    maxPct = half;
  } else if (mode === "nonnegative") {
    minPct = 0;
    maxPct = Math.max(snapUp(max, width), width);
  } else {
    minPct = -Math.max(snapUp(Math.abs(min), width), width);
    maxPct = 0;
  }

  const count = Math.max(1, Math.round((maxPct - minPct) / width));
  const edgesPct = Array.from({ length: count + 1 }, (_, index) =>
    roundPct(minPct + index * width),
  );
  edgesPct[count] = roundPct(maxPct);

  return {
    minPct: roundPct(minPct),
    maxPct: roundPct(maxPct),
    edgesPct,
  };
}
