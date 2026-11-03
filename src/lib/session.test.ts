import { describe, expect, it } from "vitest";
import type { QuoteSnapshot } from "./data/tencent";
import { buildMarketSnapshot } from "./session";

const quote: QuoteSnapshot = {
  date: "2024-11-01",
  open: 51,
  high: 52,
  low: 49.5,
  close: 50.5,
  volume: 200,
  prevClose: 50,
  time: "14:35",
};

describe("buildMarketSnapshot", () => {
  it("computes intraday metrics from the latest quote", () => {
    const snapshot = buildMarketSnapshot(quote, "2024-11-01");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.isToday).toBe(true);
    expect(snapshot?.close).toBeCloseTo(50.5, 10);
    expect(snapshot?.openRet).toBeCloseTo(0.02, 10);
    expect(snapshot?.amplitude).toBeCloseTo(0.05, 10);
  });

  it("marks a previous trading day when the quote date is older", () => {
    const snapshot = buildMarketSnapshot(quote, "2024-11-03");
    expect(snapshot?.isToday).toBe(false);
  });

  it("rejects inconsistent quotes", () => {
    expect(
      buildMarketSnapshot({ ...quote, high: 49 }, "2024-11-01"),
    ).toBeNull();
  });
});
