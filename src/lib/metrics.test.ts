import { describe, expect, it } from "vitest";
import type { DailyBar } from "./data/types";
import { computeMetricValues, computeMetrics, isValidBar } from "./metrics";

const base: DailyBar[] = [
  {
    date: "2024-01-02",
    open: 50,
    high: 51,
    low: 49,
    close: 50,
    volume: 100,
  },
  {
    date: "2024-01-03",
    open: 51,
    high: 52,
    low: 49.5,
    close: 51,
    volume: 200,
  },
  {
    date: "2024-01-04",
    open: 51,
    high: 51,
    low: 51,
    close: 51,
    volume: 50,
  },
];

describe("computeMetrics", () => {
  it("computes the six metrics against previous close", () => {
    const metrics = computeMetrics(base);
    expect(metrics).toHaveLength(2);
    const row = metrics[0];
    expect(row.openRet).toBeCloseTo(0.02, 10);
    expect(row.highRet).toBeCloseTo(0.04, 10);
    expect(row.lowRet).toBeCloseTo(-0.01, 10);
    expect(row.amplitude).toBeCloseTo(0.05, 10);
    expect(row.highVsOpen).toBeCloseTo(52 / 51 - 1, 10);
    expect(row.lowVsOpen).toBeCloseTo(49.5 / 51 - 1, 10);
    expect(row.zeroRange).toBe(false);
    expect(row.gapDays).toBe(1);
  });

  it("flags zero range days and produces zero excursions", () => {
    const metrics = computeMetrics(base);
    const zero = metrics[1];
    expect(zero.zeroRange).toBe(true);
    expect(zero.amplitude).toBeCloseTo(0, 10);
    expect(zero.highVsOpen).toBeCloseTo(0, 10);
    expect(zero.lowVsOpen).toBeCloseTo(0, 10);
  });

  it("sorts bars and drops invalid rows", () => {
    const reversed = [...base].reverse();
    const metrics = computeMetrics(reversed);
    expect(metrics.map((row) => row.date)).toEqual([
      "2024-01-03",
      "2024-01-04",
    ]);
  });
});

describe("isValidBar", () => {
  it("rejects inconsistent high/low", () => {
    expect(
      isValidBar({
        date: "2024-01-02",
        open: 10,
        high: 9,
        low: 8,
        close: 9.5,
        volume: 1,
      }),
    ).toBe(false);
  });
});

describe("computeMetricValues", () => {
  it("uses the latest price as the session close", () => {
    const values = computeMetricValues(
      {
        date: "2024-01-03",
        open: 51,
        high: 52,
        low: 49.5,
        close: 50.5,
        volume: 200,
      },
      50,
    );
    expect(values).not.toBeNull();
    expect(values?.openRet).toBeCloseTo(0.02, 10);
    expect(values?.highRet).toBeCloseTo(0.04, 10);
    expect(values?.lowRet).toBeCloseTo(-0.01, 10);
    expect(values?.amplitude).toBeCloseTo(0.05, 10);
    expect(values?.zeroRange).toBe(false);
  });

  it("rejects a non-positive previous close", () => {
    expect(
      computeMetricValues(
        {
          date: "2024-01-03",
          open: 51,
          high: 52,
          low: 49.5,
          close: 50.5,
          volume: 200,
        },
        0,
      ),
    ).toBeNull();
  });
});
