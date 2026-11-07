import { describe, expect, it } from "vitest";
import { previewQuestions, sampleCounts, sampleWords } from "@/lib/preview";

describe("builder preview", () => {
  it("makes believable sample votes: one per option, never all equal, the same every time", () => {
    const a = sampleCounts(4);
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBeGreaterThan(1);
    expect(a.every((n) => Number.isInteger(n) && n > 0)).toBe(true);
    expect(sampleCounts(4)).toEqual(a);
    expect(sampleCounts(0)).toEqual([]);
  });

  it("samples words from the question's own words when it has some", () => {
    const w = sampleWords("One word for this sprint?");
    expect(w.length).toBeGreaterThanOrEqual(5);
    expect(w.every((x) => x.word.length > 0 && x.n > 0)).toBe(true);
  });

  it("turns builder drafts into preview slides, filling blanks so empty questions still show something", () => {
    const qs = previewQuestions([
      { kind: "poll", name: "Lunch?", options: ["Pizza", "", "Sushi"] },
      { kind: "poll", name: "  ", options: [] },
      { kind: "text", name: "Thoughts?", options: ["ignored"] },
    ]);
    expect(qs[0]).toMatchObject({ kind: "poll", name: "Lunch?" });
    expect(qs[0].options.map((o) => o.name)).toEqual(["Pizza", "Sushi"]);
    expect(new Set(qs[0].options.map((o) => o.id)).size).toBe(2);
    expect(qs[1].name).toBe("Question 2");
    expect(qs[1].options.map((o) => o.name)).toEqual(["Option A", "Option B"]);
    expect(qs[2].options).toEqual([]);
  });
});
