import { ksDistanceSorted } from "./ks";
import { hashString, mulberry32, shuffleLabelsInPlace } from "./random";

export interface PermutationResult {
  p: number;
  observedD: number;
  reps: number;
  nullMeanD: number;
}

export function maxPairwiseKsD(groups: number[][]): number {
  if (groups.length < 2) return 0;
  const sorted = groups.map((group) =>
    group.filter((value) => Number.isFinite(value)).sort((a, b) => a - b),
  );
  let maxD = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      maxD = Math.max(maxD, ksDistanceSorted(sorted[i], sorted[j]));
    }
  }
  return maxD;
}

export function permutationMaxKs(
  groups: number[][],
  reps = 999,
  seedKey = "permutation",
): PermutationResult {
  const clean = groups.map((group) =>
    group.filter((value) => Number.isFinite(value)),
  );
  if (clean.length < 2 || clean.some((group) => group.length === 0)) {
    return { p: 1, observedD: 0, reps, nullMeanD: 0 };
  }

  const observedD = maxPairwiseKsD(clean);
  if (observedD === 0) {
    return { p: 1, observedD: 0, reps, nullMeanD: 0 };
  }

  const sizes = clean.map((group) => group.length);
  const pool = clean.flat();
  const labels = new Int32Array(pool.length);
  let cursor = 0;
  for (let group = 0; group < sizes.length; group += 1) {
    for (let k = 0; k < sizes[group]; k += 1) {
      labels[cursor] = group;
      cursor += 1;
    }
  }

  const random = mulberry32(hashString(seedKey));
  let exceed = 0;
  let nullSum = 0;
  for (let rep = 0; rep < reps; rep += 1) {
    shuffleLabelsInPlace(labels, random);
    const shuffled: number[][] = sizes.map(() => []);
    for (let i = 0; i < labels.length; i += 1) {
      shuffled[labels[i]].push(pool[i]);
    }
    const d = maxPairwiseKsD(shuffled);
    nullSum += d;
    if (d >= observedD - 1e-12) exceed += 1;
  }

  return {
    p: (1 + exceed) / (reps + 1),
    observedD,
    reps,
    nullMeanD: nullSum / reps,
  };
}
