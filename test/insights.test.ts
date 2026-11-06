import { describe, expect, it } from "vitest";
import { agreement } from "@/lib/insights";

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


import { takeaways, type TopicStat } from "@/lib/insights";

describe("takeaways", () => {
  const crit = ["Impact", "Feasibility"];
  const t = (name: string, overall: number | null, per: (number | null)[], label: TopicStat["agreement"] = "Strong agreement"): TopicStat => ({
    name,
    overall,
    perCriterion: per,
    agreement: label,
  });

  it("names the leader and its margin over second place", () => {
    const out = takeaways([t("Mobile app", 4.6, [4.5, 4.7]), t("AI notes", 3.2, [3, 3.4])], crit, 5);
    expect(out[0]).toBe("Mobile app leads with 4.6 out of 5, 1.4 ahead of AI notes.");
  });

  it("calls a near tie a near tie", () => {
    const out = takeaways([t("A", 4.1, [4, 4.2]), t("B", 4.0, [4, 4])], crit, 5);
    expect(out[0]).toBe("A and B are nearly tied at the top (4.1 and 4.0).");
  });

  it("flags topics that split the room", () => {
    const out = takeaways([t("A", 4, [4, 4]), t("B", 3, [3, 3], "Split views"), t("C", 2, [2, 2], "Split views")], crit, 5);
    expect(out).toContain("The room is split on B and C. Worth discussing before deciding.");
  });

  it("points out the lowest topic and its weakest criterion", () => {
    const out = takeaways([t("A", 4, [4, 4]), t("B", 2.1, [1.7, 2.5])], crit, 5);
    expect(out).toContain("B ranks last at 2.1, weakest on Impact (1.7).");
  });

  it("names the weakest criterion across all topics", () => {
    const out = takeaways([t("A", 4, [3.2, 4.8]), t("B", 3, [2.8, 3.2])], crit, 5);
    expect(out).toContain("Impact scores lowest across the board (3.0 average).");
  });

  it("says nothing before any votes, and only the leader with one topic", () => {
    expect(takeaways([t("A", null, [null, null])], crit, 5)).toEqual([]);
    expect(takeaways([t("A", 3.5, [3, 4])], crit, 5)).toEqual(["A scores 3.5 out of 5."]);
  });
});
