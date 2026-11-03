import { finiteValues } from "./describe";

export interface KsResult {
  d: number;
  p: number;
  n1: number;
  n2: number;
}

function asymptoticP(d: number, n1: number, n2: number): number {
  if (!(d > 0)) return 1;
  if (!(n1 > 0) || !(n2 > 0)) return 1;
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * d;
  let sum = 0;
  for (let k = 1; k <= 100; k += 1) {
    const term = 2 * Math.pow(-1, k - 1) * Math.exp(-2 * k * k * lambda * lambda);
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.min(1, Math.max(0, sum));
}

export function ksDistanceSorted(x: number[], y: number[]): number {
  if (x.length === 0 || y.length === 0) return 0;
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < x.length || j < y.length) {
    if (j >= y.length || (i < x.length && x[i] < y[j])) {
      i += 1;
    } else if (i >= x.length || y[j] < x[i]) {
      j += 1;
    } else {
      const value = x[i];
      while (i < x.length && x[i] === value) i += 1;
      while (j < y.length && y[j] === value) j += 1;
    }
    d = Math.max(d, Math.abs(i / x.length - j / y.length));
  }
  return d;
}

export function ksDistance(a: number[], b: number[]): number {
  const x = finiteValues(a).sort((m, n) => m - n);
  const y = finiteValues(b).sort((m, n) => m - n);
  return ksDistanceSorted(x, y);
}

export function ksTwoSample(a: number[], b: number[]): KsResult {
  const x = finiteValues(a);
  const y = finiteValues(b);
  const d = ksDistance(x, y);
  return {
    d,
    p: asymptoticP(d, x.length, y.length),
    n1: x.length,
    n2: y.length,
  };
}
