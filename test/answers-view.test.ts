import { describe, expect, it } from "vitest";
import { pollTally, qaOrder, qaVoterView, wordWeights } from "@/lib/answers";
import { PRESETS, matchingPreset } from "@/lib/presets";

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

describe("qaOrder", () => {
  const q = (id: string, votes: number, at: string, extra: { answered?: boolean; hidden?: boolean; focusId?: string } = {}) => ({
    id,
    focusId: extra.focusId ?? "f",
    text: id,
    votes,
    answered: extra.answered ?? false,
    hidden: extra.hidden ?? false,
    at,
  });
  const items = [
    q("old-popular", 5, "2026-01-01T10:00:00Z"),
    q("new-quiet", 1, "2026-01-01T10:05:00Z"),
    q("tie-newer", 5, "2026-01-01T10:03:00Z"),
    q("answered", 9, "2026-01-01T10:01:00Z", { answered: true }),
    q("hidden", 99, "2026-01-01T10:02:00Z", { hidden: true }),
    q("elsewhere", 50, "2026-01-01T10:02:00Z", { focusId: "g" }),
  ];

  it("puts the most votes first (newer wins a tie), answered last, and leaves hidden ones out", () => {
    expect(qaOrder(items, "f", "top").map((x) => x.id)).toEqual(["tie-newer", "old-popular", "new-quiet", "answered"]);
  });

  it("can sort newest first, still with answered last", () => {
    expect(qaOrder(items, "f", "new").map((x) => x.id)).toEqual(["new-quiet", "tie-newer", "old-popular", "answered"]);
  });

  it("can include hidden ones for the owner's list", () => {
    expect(qaOrder(items, "f", "top", { includeHidden: true }).map((x) => x.id)).toContain("hidden");
  });
});

describe("question presets", () => {
  it("Yes / No / Not sure is a Pick one question with those 3 options", () => {
    const yesNo = PRESETS.find((p) => p.id === "yes-no");
    expect(yesNo).toMatchObject({ label: "Yes / No / Not sure", kind: "poll", options: ["Yes", "No", "Not sure"] });
  });

  it("recognises a question that still matches a preset, ignoring blank rows", () => {
    expect(matchingPreset("poll", ["Yes", "No", "Not sure"])?.id).toBe("yes-no");
    expect(matchingPreset("poll", ["Yes", "No", "Not sure", ""])?.id).toBe("yes-no");
    expect(matchingPreset("poll", ["Yes", "No"])).toBeNull();
    expect(matchingPreset("multi", ["Yes", "No", "Not sure"])).toBeNull();
  });
});

describe("qaVoterView", () => {
  const server = [
    { id: "a", focusId: "f", text: "A?", votes: 3, answered: false, at: "2026-01-01T10:00:00Z" },
    { id: "b", focusId: "f", text: "B?", votes: 1, answered: false, at: "2026-01-01T10:01:00Z" },
    { id: "x", focusId: "g", text: "X?", votes: 9, answered: false, at: "2026-01-01T10:01:00Z" },
  ];
  const now = Date.parse("2026-01-01T10:02:00Z");
  const empty = { asked: [], voted: [], adjust: {} };

  it("marks the voter's own questions and votes, sorted by votes, other Q&As left out", () => {
    const v = qaVoterView(server, "f", { ...empty, asked: [{ id: "b", text: "B?", at: "2026-01-01T10:01:00Z" }], voted: ["a"] }, now);
    expect(v.map((q) => [q.id, q.votes, q.mine, q.voted])).toEqual([
      ["a", 3, false, true],
      ["b", 1, true, false],
    ]);
  });

  it("shows a just-sent question before the server list catches up, then stops after a minute", () => {
    const asked = [{ id: "new", text: "Fresh?", at: "2026-01-01T10:01:50Z" }];
    expect(qaVoterView(server, "f", { ...empty, asked }, now).find((q) => q.id === "new")).toMatchObject({ votes: 0, mine: true });
    expect(qaVoterView(server, "f", { ...empty, asked }, now + 61_000).find((q) => q.id === "new")).toBeUndefined();
  });

  it("adds the voter's own change to a stale count until the server count moves", () => {
    const local = { asked: [], voted: ["b"], adjust: { b: { base: 1, delta: 1 } } };
    expect(qaVoterView(server, "f", local, now).find((q) => q.id === "b")?.votes).toBe(2);
    const moved = server.map((q) => (q.id === "b" ? { ...q, votes: 2 } : q));
    expect(qaVoterView(moved, "f", local, now).find((q) => q.id === "b")?.votes).toBe(2);
  });
});
