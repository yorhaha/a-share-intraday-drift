import { describe, expect, it } from "vitest";
import {
  boxStats,
  describe as describeValues,
  histogram,
  histogramWithEdges,
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
