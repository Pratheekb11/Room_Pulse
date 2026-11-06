import { describe, expect, it } from "vitest";
import { agreement, quadrant } from "@/lib/insights";

describe("agreement", () => {
  it("is null with fewer than 2 ratings", () => {
    expect(agreement([0, 0, 1, 0, 0], 5)).toBeNull();
    expect(agreement([0, 0, 0, 0, 0], 5)).toBeNull();
  });

  it("reports strong agreement when everyone gives the same or nearby scores", () => {
    expect(agreement([0, 0, 0, 10, 0], 5)?.label).toBe("Strong agreement");
    expect(agreement([0, 0, 2, 8, 2], 5)?.label).toBe("Strong agreement");
  });

  it("reports split views when the room is polarised", () => {
    expect(agreement([10, 0, 0, 0, 10], 5)?.label).toBe("Split views");
  });

  it("reports mixed views in between", () => {
    expect(agreement([2, 3, 3, 3, 2], 5)?.label).toBe("Mixed views");
  });

  it("is relative to the scale size", () => {
    // Same spread of ±1 is tighter on a 10-point scale than on a 3-point one.
    const ten = new Array(10).fill(0);
    ten[4] = 5;
    ten[6] = 5;
    expect(agreement(ten, 10)?.label).toBe("Strong agreement");
    expect(agreement([5, 0, 5], 3)?.label).toBe("Split views");
  });

  it("returns the standard deviation", () => {
    expect(agreement([1, 0, 1], 3)?.sd).toBeCloseTo(1);
  });
});

describe("quadrant", () => {
  it("splits at the middle of the scale", () => {
    expect(quadrant(4, 4, 5)).toBe("both_high");
    expect(quadrant(2, 4, 5)).toBe("y_high");
    expect(quadrant(4, 2, 5)).toBe("x_high");
    expect(quadrant(2, 2, 5)).toBe("both_low");
    expect(quadrant(3, 3, 5)).toBe("both_high"); // the midpoint counts as high
  });
});
