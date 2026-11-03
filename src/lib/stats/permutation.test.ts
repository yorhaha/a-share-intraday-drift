import { describe, expect, it } from "vitest";
import { maxPairwiseKsD, permutationMaxKs } from "./permutation";

describe("permutationMaxKs", () => {
  it("detects separated groups", () => {
    const groups = [
      [0, 0.1, 0.2, 0.3, 0.4],
      [10, 10.1, 10.2, 10.3, 10.4],
    ];
    const result = permutationMaxKs(groups, 99, "test-separated");
    expect(result.observedD).toBe(1);
    expect(result.p).toBeLessThan(0.05);
    expect(maxPairwiseKsD(groups)).toBe(1);
  });

  it("returns p=1 for identical samples", () => {
    const result = permutationMaxKs(
      [
        [1, 2, 3, 4],
        [1, 2, 3, 4],
      ],
      99,
      "test-identical",
    );
    expect(result.observedD).toBe(0);
    expect(result.p).toBe(1);
  });

  it("is deterministic for a given seed", () => {
    const groups = [
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1.2, 2.2, 3.2, 4.2, 5.2, 6.2, 7.2, 8.2],
      [1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1],
    ];
    const a = permutationMaxKs(groups, 199, "same");
    const b = permutationMaxKs(groups, 199, "same");
    expect(a.p).toBe(b.p);
    expect(a.observedD).toBe(b.observedD);
  });
});
