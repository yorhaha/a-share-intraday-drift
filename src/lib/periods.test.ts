import { describe, expect, it } from "vitest";
import type { DailyMetrics } from "./data/types";
import { addDays } from "./date";
import { buildPeriods } from "./periods";

function makeMetrics(count: number): DailyMetrics[] {
  let date = "2024-01-02";
  return Array.from({ length: count }, (_, index) => {
    const row = {
      date,
      open: 10,
      close: 10,
      high: 10,
      low: 10,
      volume: 1,
      prevClose: 10,
      openRet: 0,
      highRet: 0,
      lowRet: 0,
      amplitude: 0,
      highVsOpen: 0,
      lowVsOpen: 0,
      zeroRange: index % 10 === 0,
      gapDays: 1,
    } satisfies DailyMetrics;
    date = addDays(date, 1);
    return row;
  });
}

describe("buildPeriods", () => {
  it("splits the most recent K full blocks", () => {
    const metrics = makeMetrics(243);
    const result = buildPeriods(metrics, 60, 4, false);
    expect(result.effectiveK).toBe(4);
    expect(result.blocks).toHaveLength(4);
    expect(result.leftover).toHaveLength(3);
    expect(result.blocks[0].raw).toHaveLength(60);
    expect(result.blocks[3].raw).toHaveLength(60);
    expect(result.blocks[0].startDate).toBe(metrics[3].date);
    expect(result.blocks[3].endDate).toBe(metrics[242].date);
  });

  it("reduces K when the range is too short", () => {
    const result = buildPeriods(makeMetrics(130), 60, 4, false);
    expect(result.effectiveK).toBe(2);
    expect(result.blocks).toHaveLength(2);
    expect(result.warnings.join("")).toContain("最多容纳 2 个完整周期");
  });

  it("returns no blocks when fewer than two periods fit", () => {
    const result = buildPeriods(makeMetrics(100), 60, 4, false);
    expect(result.blocks).toHaveLength(0);
    expect(result.effectiveK).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("excludes zero-range rows without moving block boundaries", () => {
    const metrics = makeMetrics(240);
    const result = buildPeriods(metrics, 60, 4, true);
    expect(result.blocks[0].raw).toHaveLength(60);
    expect(result.blocks[0].rows).toHaveLength(54);
    expect(result.blocks[0].excludedCount).toBe(6);
    expect(result.blocks[0].startDate).toBe(metrics[0].date);
  });
});
