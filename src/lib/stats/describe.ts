export interface DescribeResult {
  n: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  iqr: number;
}

export function finiteValues(values: number[]): number[] {
  return values.filter((value) => Number.isFinite(value));
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

export function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return quantileSorted(sorted, 0.5);
}

export function describe(values: number[]): DescribeResult {
  const clean = finiteValues(values);
  if (clean.length === 0) {
    return {
      n: 0,
      mean: NaN,
      median: NaN,
      std: NaN,
      min: NaN,
      max: NaN,
      p5: NaN,
      p25: NaN,
      p75: NaN,
      p95: NaN,
      iqr: NaN,
    };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const avg = mean(sorted);
  const variance =
    sorted.length > 1
      ? sorted.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
        (sorted.length - 1)
      : 0;
  return {
    n: sorted.length,
    mean: avg,
    median: quantileSorted(sorted, 0.5),
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p5: quantileSorted(sorted, 0.05),
    p25: quantileSorted(sorted, 0.25),
    p75: quantileSorted(sorted, 0.75),
    p95: quantileSorted(sorted, 0.95),
    iqr: quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25),
  };
}

export interface BoxStats {
  min: number;
  whiskerLow: number;
  q1: number;
  median: number;
  q3: number;
  whiskerHigh: number;
  max: number;
  outliers: number[];
}

export function boxStats(values: number[]): BoxStats {
  const clean = finiteValues(values);
  const desc = describe(clean);
  if (clean.length === 0) {
    return {
      min: NaN,
      whiskerLow: NaN,
      q1: NaN,
      median: NaN,
      q3: NaN,
      whiskerHigh: NaN,
      max: NaN,
      outliers: [],
    };
  }
  const sorted = [...clean].sort((a, b) => a - b);
  const lowerFence = desc.p25 - 1.5 * desc.iqr;
  const upperFence = desc.p75 + 1.5 * desc.iqr;
  const inside = sorted.filter(
    (value) => value >= lowerFence && value <= upperFence,
  );
  const outliers = sorted.filter(
    (value) => value < lowerFence || value > upperFence,
  );
  return {
    min: sorted[0],
    whiskerLow: inside[0] ?? desc.p25,
    q1: desc.p25,
    median: desc.median,
    q3: desc.p75,
    whiskerHigh: inside[inside.length - 1] ?? desc.p75,
    max: sorted[sorted.length - 1],
    outliers,
  };
}

export function ecdfPoints(
  values: number[],
): Array<[number, number]> {
  const clean = finiteValues(values).sort((a, b) => a - b);
  if (clean.length === 0) return [];
  const points: Array<[number, number]> = [];
  let i = 0;
  while (i < clean.length) {
    let j = i;
    while (j + 1 < clean.length && clean[j + 1] === clean[i]) j += 1;
    points.push([clean[i], (j + 1) / clean.length]);
    i = j + 1;
  }
  return points;
}

export interface HistogramBin {
  x0: number;
  x1: number;
  label: string;
  count: number;
  pct: number;
}

export function histogram(values: number[], binCount?: number): HistogramBin[] {
  const clean = finiteValues(values);
  if (clean.length === 0) return [];
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (min === max) {
    return [
      {
        x0: min,
        x1: max,
        label: min.toFixed(3),
        count: clean.length,
        pct: 1,
      },
    ];
  }

  let bins = binCount;
  if (!bins) {
    const desc = describe(clean);
    const fd =
      desc.iqr > 0
        ? (2 * desc.iqr) / Math.cbrt(clean.length)
        : (max - min) / 10;
    const width = fd > 0 ? fd : (max - min) / 10;
    bins = Math.ceil((max - min) / width);
  }
  bins = Math.min(40, Math.max(8, Math.round(bins)));

  const width = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const value of clean) {
    const index = Math.min(bins - 1, Math.floor((value - min) / width));
    counts[index] += 1;
  }
  return counts.map((count, index) => {
    const x0 = min + index * width;
    const x1 = x0 + width;
    return {
      x0,
      x1,
      label: `${(x0 * 100).toFixed(1)}`,
      count,
      pct: count / clean.length,
    };
  });
}

export function histogramWithEdges(
  values: number[],
  edges: number[],
): number[] {
  const counts = new Array<number>(Math.max(0, edges.length - 1)).fill(0);
  if (edges.length < 2) return counts;
  const firstWidth = edges[1] - edges[0];
  if (!(firstWidth > 0)) {
    const clean = finiteValues(values);
    counts[0] = clean.filter((value) => value === edges[0]).length;
    return counts;
  }
  for (const value of finiteValues(values)) {
    if (value < edges[0] || value > edges[edges.length - 1]) continue;
    let index = Math.floor((value - edges[0]) / firstWidth);
    if (index >= counts.length) index = counts.length - 1;
    if (index < 0) index = 0;
    counts[index] += 1;
  }
  return counts;
}

export function binEdges(values: number[], binCount?: number): number[] {
  const bins = histogram(values, binCount);
  if (bins.length === 0) return [];
  return [bins[0].x0, ...bins.map((bin) => bin.x1)];
}
