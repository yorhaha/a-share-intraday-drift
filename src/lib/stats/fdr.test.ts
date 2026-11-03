import { describe, expect, it } from "vitest";
import { bhFdr } from "./fdr";

describe("bhFdr", () => {
  it("matches a hand-computed example", () => {
    const q = bhFdr([0.01, 0.04, 0.03, 0.2]);
    expect(q[0]).toBeCloseTo(0.04, 10);
    expect(q[1]).toBeCloseTo(0.0533333333, 8);
    expect(q[2]).toBeCloseTo(0.0533333333, 8);
    expect(q[3]).toBeCloseTo(0.2, 10);
  });

  it("preserves nulls and adjusts only valid p-values", () => {
    const q = bhFdr([0.01, null, 0.04]);
    expect(q[0]).toBeCloseTo(0.02, 10);
    expect(q[1]).toBeNull();
    expect(q[2]).toBeCloseTo(0.04, 10);
  });

  it("caps q-values at one", () => {
    const q = bhFdr([0.9, 0.95]);
    expect(q[0]).toBeLessThanOrEqual(1);
    expect(q[1]).toBeLessThanOrEqual(1);
  });
});
