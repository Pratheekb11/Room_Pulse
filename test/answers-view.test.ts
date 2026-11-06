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
