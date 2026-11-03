import { describe, expect, it } from "vitest";
import {
  boxStats,
  describe as describeValues,
  histogram,
  histogramWithEdges,
  percentileRank,
  sidePercentileRank,
  twoSidedEcdfPoints,
} from "./describe";

describe("describe", () => {
  it("computes quantiles and IQR", () => {
    const stats = describeValues([1, 2, 3, 4, 5]);
    expect(stats.n).toBe(5);
    expect(stats.median).toBe(3);
    expect(stats.p25).toBe(2);
    expect(stats.p75).toBe(4);
    expect(stats.iqr).toBe(2);
    expect(stats.std).toBeCloseTo(Math.sqrt(2.5), 12);
  });

  it("marks values outside the 1.5 IQR fences as outliers", () => {
    const stats = boxStats([1, 2, 3, 4, 100]);
    expect(stats.outliers).toContain(100);
    expect(stats.whiskerHigh).toBe(4);
  });
});

describe("histogramWithEdges", () => {
  it("counts a constant sample when all edges collapse", () => {
    const bins = histogram([0.02, 0.02, 0.02]);
    const edges = [bins[0].x0, ...bins.map((bin) => bin.x1)];
    expect(histogramWithEdges([0.02, 0.02, 0.02], edges)).toEqual([3]);
  });

  it("assigns the upper edge to the last bin", () => {
    expect(histogramWithEdges([0, 1, 2], [0, 1, 2])).toEqual([1, 2]);
  });
});

describe("percentileRank", () => {
  it("returns the share of samples at or below the value", () => {
    expect(percentileRank([1, 2, 3, 4], 2)).toBe(0.5);
    expect(percentileRank([1, 2, 3, 4], 2.5)).toBe(0.5);
    expect(percentileRank([1, 2, 3, 4], 0)).toBe(0);
    expect(percentileRank([1, 2, 3, 4], 4)).toBe(1);
  });

  it("returns NaN for empty or non-finite inputs", () => {
    expect(percentileRank([], 1)).toBeNaN();
    expect(percentileRank([1, 2], Number.NaN)).toBeNaN();
  });
});

describe("sidePercentileRank", () => {
  it("uses the matching side and excludes zero values", () => {
    const values = [-3, -2, -1, 0, 1, 2, 3];
    expect(sidePercentileRank(values, -2)).toBeCloseTo(2 / 3, 12);
    expect(sidePercentileRank(values, 2)).toBeCloseTo(2 / 3, 12);
    expect(sidePercentileRank(values, 0)).toBe(1);
    expect(sidePercentileRank([1, 2, 3], -1)).toBeNaN();
  });
});

describe("twoSidedEcdfPoints", () => {  it("accumulates each side toward zero and meets at 100%", () => {
    expect(twoSidedEcdfPoints([-2, -1, -1, 1, 2, 0])).toEqual([
      [-2, 0],
      [-2, 1 / 3],
      [-1, 1 / 3],
      [-1, 1],
      [0, 1],
      [1, 1],
      [1, 0.5],
      [2, 0.5],
      [2, 0],
    ]);
  });

  it("normalizes each side independently when the other side is empty", () => {
    expect(twoSidedEcdfPoints([1, 2, 3])).toEqual([
      [0, 1],
      [1, 1],
      [1, 2 / 3],
      [2, 2 / 3],
      [2, 1 / 3],
      [3, 1 / 3],
      [3, 0],
    ]);
    expect(twoSidedEcdfPoints([-3, -2, -1])).toEqual([
      [-3, 0],
      [-3, 1 / 3],
      [-2, 1 / 3],
      [-2, 2 / 3],
      [-1, 2 / 3],
      [-1, 1],
      [0, 1],
    ]);
  });

  it("handles zero-only and empty samples", () => {
    expect(twoSidedEcdfPoints([0, 0])).toEqual([[0, 1]]);
    expect(twoSidedEcdfPoints([])).toEqual([]);
  });
});
