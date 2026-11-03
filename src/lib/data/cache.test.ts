import { describe, expect, it } from "vitest";
import {
  coversRange,
  mergeBars,
  mergeCoverage,
  type DateCoverage,
} from "./cache";
import type { DailyBar } from "./types";

function bar(date: string, close: number): DailyBar {
  return { date, open: close, close, high: close, low: close, volume: 1 };
}

describe("mergeCoverage", () => {
  it("merges overlapping and adjacent date ranges", () => {
    const coverage: DateCoverage[] = [
      { start: "2024-01-01", end: "2024-01-31" },
    ];
    const merged = mergeCoverage(coverage, {
      start: "2024-02-01",
      end: "2024-02-29",
    });
    expect(merged).toEqual([
      { start: "2024-01-01", end: "2024-02-29" },
    ]);
  });

  it("keeps disjoint ranges separate", () => {
    const merged = mergeCoverage(
      [{ start: "2024-01-01", end: "2024-01-31" }],
      { start: "2024-03-01", end: "2024-03-31" },
    );
    expect(merged).toHaveLength(2);
    expect(coversRange(merged, "2024-01-10", "2024-01-20")).toBe(true);
    expect(coversRange(merged, "2024-02-01", "2024-02-10")).toBe(false);
  });
});

describe("mergeBars", () => {
  it("dedupes by date, lets newer rows win and sorts ascending", () => {
    const merged = mergeBars(
      [bar("2024-01-03", 10), bar("2024-01-01", 9)],
      [bar("2024-01-02", 11), bar("2024-01-03", 12)],
    );
    expect(merged.map((item) => item.date)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
    ]);
    expect(merged[2].close).toBe(12);
  });
});
