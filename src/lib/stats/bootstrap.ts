import { median } from "./describe";
import { hashString, mulberry32 } from "./random";

export interface MedianCi {
  median: number;
  low: number;
  high: number;
  reps: number;
}

function percentileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return (
    sorted[lower] * (upper - pos) + sorted[upper] * (pos - lower)
  );
}

export function bootstrapMedianCI(
  values: number[],
  reps = 2000,
  seedKey = "median",
): MedianCi {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length === 0) {
    return { median: NaN, low: NaN, high: NaN, reps: 0 };
  }
  if (clean.length === 1) {
    return {
      median: clean[0],
      low: clean[0],
      high: clean[0],
      reps: 0,
    };
  }
  const random = mulberry32(hashString(seedKey));
  const medians = new Array<number>(reps);
  for (let r = 0; r < reps; r += 1) {
    const sample = new Array<number>(clean.length);
    for (let i = 0; i < clean.length; i += 1) {
      sample[i] = clean[Math.floor(random() * clean.length)];
    }
    medians[r] = median(sample);
  }
  medians.sort((a, b) => a - b);
  return {
    median: median(clean),
    low: percentileSorted(medians, 0.025),
    high: percentileSorted(medians, 0.975),
    reps,
  };
}

export function bootstrapMedianDiffCI(
  a: number[],
  b: number[],
  reps = 2000,
  seedKey = "median-diff",
): { delta: number; low: number; high: number } {
  const cleanA = a.filter((value) => Number.isFinite(value));
  const cleanB = b.filter((value) => Number.isFinite(value));
  if (cleanA.length === 0 || cleanB.length === 0) {
    return { delta: NaN, low: NaN, high: NaN };
  }
  const random = mulberry32(hashString(seedKey));
  const deltas = new Array<number>(reps);
  for (let r = 0; r < reps; r += 1) {
    const sampleA = new Array<number>(cleanA.length);
    const sampleB = new Array<number>(cleanB.length);
    for (let i = 0; i < cleanA.length; i += 1) {
      sampleA[i] = cleanA[Math.floor(random() * cleanA.length)];
    }
    for (let i = 0; i < cleanB.length; i += 1) {
      sampleB[i] = cleanB[Math.floor(random() * cleanB.length)];
    }
    deltas[r] = median(sampleA) - median(sampleB);
  }
  deltas.sort((x, y) => x - y);
  return {
    delta: median(cleanA) - median(cleanB),
    low: percentileSorted(deltas, 0.025),
    high: percentileSorted(deltas, 0.975),
  };
}
