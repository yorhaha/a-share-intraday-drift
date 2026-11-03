import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "./analysis";
import type { DailyMetrics, PeriodBlock } from "./data/types";
import { buildCsv } from "./csv";

function row(date: string, close: number, amplitude: number): DailyMetrics {
  return {
    date,
    open: close - 0.1,
    close,
    high: close + amplitude / 2,
    low: close - amplitude / 2,
    volume: 1000,
    prevClose: close - 0.2,
    openRet: 0.01,
    highRet: 0.02,
    lowRet: -0.01,
    amplitude,
    highVsOpen: 0.015,
    lowVsOpen: -0.02,
    zeroRange: false,
    gapDays: 1,
  };
}

function block(index: number, rows: DailyMetrics[]): PeriodBlock {
  return {
    index,
    label: `B${index}`,
    startDate: rows[0].date,
    endDate: rows[rows.length - 1].date,
    raw: rows,
    rows,
    excludedCount: 0,
  };
}

describe("buildCsv", () => {
  it("writes a BOM header, block labels and percent values", () => {
    const rows = [row("2024-01-02", 10, 0.02), row("2024-01-03", 10.2, 0.03)];
    const blocks = [block(1, [rows[0]]), block(2, [rows[1]])];
    const analysis = {
      options: {
        symbol: {
          symbol: "sh601318",
          market: "sh" as const,
          code: "601318",
          name: "中国平安",
          pinyin: "zgpa",
        },
        start: "2024-01-01",
        end: "2024-01-31",
        p: 1,
        k: 2,
        excludeZeroRange: false,
        fq: "qfq" as const,
      },
      bars: [],
      metrics: rows,
      rangeMetrics: rows,
      blockResult: {
        blocks,
        effectiveK: 2,
        requestedK: 2,
        effectiveP: 1,
        leftover: [],
        warnings: [],
      },
      drift: { metrics: [], significantCount: 0, testedMetrics: 0, warnings: [] },
      dataAsOf: "2024-01-03",
      warnings: [],
      fromCache: false,
    } satisfies AnalysisResult;

    const csv = buildCsv(analysis);
    const lines = csv.replace(/^﻿/, "").trim().split("\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toContain("open_ret_pct");
    expect(lines[1]).toContain("2024-01-02,B1");
    expect(lines[1]).toContain("1.000000");
    expect(lines[2]).toContain("2024-01-03,B2");
  });
});
