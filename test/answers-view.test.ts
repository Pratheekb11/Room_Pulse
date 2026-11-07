import { describe, expect, it } from "vitest";
import { pollTally, wordWeights } from "@/lib/answers";

describe("pollTally", () => {
  const options = [
    { id: "a", name: "Pizza" },
    { id: "b", name: "Sushi" },
    { id: "c", name: "Salad" },
  ];

  it("counts every option (including zero) with whole-number percentages, in option order", () => {
    const t = pollTally(options, [
      { focusId: "p", topicId: "b", n: 2 },
      { focusId: "p", topicId: "a", n: 1 },
      { focusId: "other", topicId: "c", n: 9 },
    ], "p");
    expect(t.total).toBe(3);
    expect(t.rows.map((r) => [r.name, r.n, r.pct])).toEqual([
      ["Pizza", 1, 33],
      ["Sushi", 2, 67],
      ["Salad", 0, 0],
    ]);
    expect(t.leader?.name).toBe("Sushi");
  });

  it("has no leader on a tie or with no votes", () => {
    expect(pollTally(options, [], "p").leader).toBeNull();
    expect(pollTally(options, [{ focusId: "p", topicId: "a", n: 1 }, { focusId: "p", topicId: "b", n: 1 }], "p").leader).toBeNull();
  });
});

describe("wordWeights", () => {
  it("scales from 0 (least said) to 1 (most said) for this focus topic only", () => {
    const w = wordWeights(
      [
        { focusId: "w", word: "speed", n: 5 },
        { focusId: "w", word: "trust", n: 1 },
        { focusId: "w", word: "focus", n: 3 },
        { focusId: "x", word: "nope", n: 50 },
      ],
      "w",
    );
    expect(w.map((x) => [x.word, x.weight])).toEqual([
      ["speed", 1],
      ["focus", 0.5],
      ["trust", 0],
    ]);
  });

  it("gives every word full weight when all counts are equal", () => {
    expect(wordWeights([{ focusId: "w", word: "a", n: 2 }, { focusId: "w", word: "b", n: 2 }], "w").map((x) => x.weight)).toEqual([1, 1]);
  });
});

describe("pollTally for pick-several questions", () => {
  it("gives each option's share of the people who answered, so shares can add up to more than 100%", async () => {
    const { pollTally } = await import("@/lib/answers");
    const options = [
      { id: "a", name: "Gym" },
      { id: "b", name: "Lunch" },
    ];
    const t = pollTally(options, [{ focusId: "m", topicId: "a", n: 3 }, { focusId: "m", topicId: "b", n: 2 }], "m", 4);
    expect(t.total).toBe(5);
    expect(t.rows.map((r) => r.pct)).toEqual([75, 50]);
  });
});

describe("rankTally", () => {
  it("orders options by average place and counts how many put each one in each place", async () => {
    const { rankTally } = await import("@/lib/answers");
    const options = [
      { id: "s", name: "Speed" },
      { id: "p", name: "Price" },
      { id: "d", name: "Design" },
    ];
    const t = rankTally(
      options,
      [
        { focusId: "r", topicId: "s", rank: 1, n: 2 },
        { focusId: "r", topicId: "p", rank: 2, n: 1 },
        { focusId: "r", topicId: "p", rank: 3, n: 1 },
        { focusId: "r", topicId: "d", rank: 2, n: 1 },
        { focusId: "r", topicId: "d", rank: 3, n: 1 },
        { focusId: "x", topicId: "d", rank: 1, n: 9 },
      ],
      "r",
    );
    expect(t.people).toBe(2);
    expect(t.rows.map((r) => [r.name, r.average, r.places])).toEqual([
      ["Speed", 1, [2, 0, 0]],
      ["Price", 2.5, [0, 1, 1]],
      ["Design", 2.5, [0, 1, 1]],
    ]);
    // score: 1 for always first, 0 for always last
    expect(t.rows.map((r) => r.score)).toEqual([1, 0.25, 0.25]);
    expect(t.rows.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it("puts options with no answers last with no average", async () => {
    const { rankTally } = await import("@/lib/answers");
    const t = rankTally([{ id: "a", name: "A" }, { id: "b", name: "B" }], [], "r");
    expect(t.people).toBe(0);
    expect(t.rows.map((r) => r.average)).toEqual([null, null]);
  });
});

describe("numberStats", () => {
  it("works out average, middle value, lowest, highest and a histogram over the question's range", async () => {
    const { numberStats } = await import("@/lib/answers");
    const s = numberStats(
      [
        { focusId: "n", value: 10, n: 2 },
        { focusId: "n", value: 40, n: 1 },
        { focusId: "n", value: 100, n: 1 },
        { focusId: "x", value: 5, n: 50 },
      ],
      "n",
      0,
      100,
      4,
    );
    expect(s.n).toBe(4);
    expect(s.mean).toBe(40);
    expect(s.median).toBe(25);
    expect([s.low, s.high]).toEqual([10, 100]);
    expect(s.bins.map((b) => [b.from, b.to, b.n])).toEqual([
      [0, 25, 2],
      [25, 50, 1],
      [50, 75, 0],
      [75, 100, 1],
    ]);
  });

  it("is empty with no answers", async () => {
    const { numberStats } = await import("@/lib/answers");
    const s = numberStats([], "n", 0, 10, 5);
    expect(s).toMatchObject({ n: 0, mean: null, median: null, low: null, high: null });
    expect(s.bins).toHaveLength(5);
  });

  it("uses whole-number bins for small whole-number ranges", async () => {
    const { numberStats } = await import("@/lib/answers");
    const s = numberStats([{ focusId: "n", value: 3, n: 1 }], "n", 1, 5, 10);
    expect(s.bins.map((b) => b.from)).toEqual([1, 2, 3, 4, 5]);
    expect(s.bins.map((b) => b.n)).toEqual([0, 0, 1, 0, 0]);
  });
});

describe("formatNumber", () => {
  it("shows up to 2 decimals with thousands separators", async () => {
    const { formatNumber } = await import("@/lib/answers");
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatNumber(2 / 3)).toBe("0.67");
    expect(formatNumber(null)).toBe("–");
  });
});
