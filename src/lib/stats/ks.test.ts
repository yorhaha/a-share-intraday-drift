import { describe, expect, it } from "vitest";
import { ksDistance, ksTwoSample } from "./ks";

describe("ks", () => {
  it("returns zero distance for identical samples", () => {
    const result = ksTwoSample([1, 2, 3], [1, 2, 3]);
    expect(result.d).toBe(0);
    expect(result.p).toBe(1);
  });

  it("returns one for disjoint samples", () => {
    const result = ksTwoSample([0, 0.1, 0.2], [10, 10.1, 10.2]);
    expect(result.d).toBe(1);
    expect(result.p).toBeLessThan(0.05);
  });

  it("computes a known distance", () => {
    expect(ksDistance([1, 2, 3, 4], [2, 3, 4, 5])).toBeCloseTo(0.25, 12);
  });

  it("handles ties", () => {
    const result = ksTwoSample([1, 1, 1], [1, 1, 1]);
    expect(result.d).toBe(0);
    expect(result.p).toBe(1);
  });
});
