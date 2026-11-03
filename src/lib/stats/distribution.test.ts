import { describe, expect, it } from "vitest";
import {
  HISTOGRAM_BIN_WIDTH_PCT,
  axisModeForMetric,
  distributionAxis,
} from "./distribution";

describe("distributionAxis", () => {
  it("makes signed metrics symmetric around zero", () => {
    const axis = distributionAxis([-0.013, 0.021], "symmetric");
    expect(axis.minPct).toBe(-2.25);
    expect(axis.maxPct).toBe(2.25);
    expect(axis.edgesPct).toHaveLength(19);
    expect(axis.edgesPct[0]).toBe(-2.25);
    expect(axis.edgesPct[axis.edgesPct.length - 1]).toBe(2.25);
  });

  it("anchors nonnegative metrics at zero and covers the max", () => {
    const axis = distributionAxis([0, 0.0231, 0.0237], "nonnegative");
    expect(axis.minPct).toBe(0);
    expect(axis.maxPct).toBe(2.5);
    expect(axis.edgesPct[0]).toBe(0);
    expect(axis.edgesPct.at(-1)).toBe(2.5);
    expect(axis.edgesPct).toHaveLength(11);
  });

  it("anchors nonpositive metrics at zero and covers the min", () => {
    const axis = distributionAxis([-0.0321, -0.001], "nonpositive");
    expect(axis.minPct).toBe(-3.25);
    expect(axis.maxPct).toBe(0);
    expect(axis.edgesPct[0]).toBe(-3.25);
    expect(axis.edgesPct.at(-1)).toBe(0);
    expect(axis.edgesPct).toHaveLength(14);
  });

  it("always uses 0.25 percentage-point bins", () => {
    const axis = distributionAxis([-0.045, 0.045], "symmetric");
    for (let index = 1; index < axis.edgesPct.length; index += 1) {
      expect(axis.edgesPct[index] - axis.edgesPct[index - 1]).toBeCloseTo(
        HISTOGRAM_BIN_WIDTH_PCT,
        9,
      );
    }
  });

  it("keeps a usable axis for empty or constant zero data", () => {
    expect(distributionAxis([], "symmetric").edgesPct).toEqual([
      -0.25, 0, 0.25,
    ]);
    expect(distributionAxis([0, 0], "nonnegative").edgesPct).toEqual([0, 0.25]);
    expect(distributionAxis([0, 0], "nonpositive").edgesPct).toEqual([-0.25, 0]);
  });
});

describe("axisModeForMetric", () => {
  it("uses symmetric axes for signed return metrics", () => {
    expect(axisModeForMetric("openRet")).toBe("symmetric");
    expect(axisModeForMetric("highRet")).toBe("symmetric");
    expect(axisModeForMetric("lowRet")).toBe("symmetric");
  });

  it("uses one-sided axes for bounded metrics", () => {
    expect(axisModeForMetric("amplitude")).toBe("nonnegative");
    expect(axisModeForMetric("highVsOpen")).toBe("nonnegative");
    expect(axisModeForMetric("lowVsOpen")).toBe("nonpositive");
  });
});
