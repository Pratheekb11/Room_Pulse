// Bugs found in the 2026-11-09 click-through sweep.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resultGroups } from "@/lib/focus";
import { onSurface } from "@/lib/colors";

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("results on phones leave quizzes out completely", () => {
  const focus = [
    { id: "r", name: "Rate the ideas", kind: "rating" as const },
    { id: "q", name: "Capital of France?", kind: "quiz" as const },
    { id: "w", name: "One word", kind: "words" as const },
  ];
  const topics = [
    { id: "t1", name: "Dark mode", focusId: "r" },
    { id: "t2", name: "Paris", focusId: "q" },
    { id: "t3", name: "Rome", focusId: "q" },
  ];

  it("shows no quiz and no stray 'Topics' group holding the quiz's answers", () => {
    const groups = resultGroups(focus, topics, true);
    expect(groups.map((g) => g.focus.name)).toEqual(["Rate the ideas", "One word"]);
    expect(groups.flatMap((g) => g.topics.map((t) => t.item.name))).toEqual(["Dark mode"]);
  });

  it("keeps the quiz on the presenter's screen, and colours keep their place in the presentation", () => {
    const groups = resultGroups(focus, topics, false);
    expect(groups.map((g) => g.focus.name)).toEqual(["Rate the ideas", "Capital of France?", "One word"]);
    expect(groups[1].topics.map((t) => t.index)).toEqual([1, 2]);
  });

  it("is what the results screen uses", () => {
    expect(src("components/DashboardApp.tsx")).toMatch(/resultGroups\(/);
  });
});

describe("tinted answers stay readable in dark designs", () => {
  it("mixes the colour with the design's surface, not plain white", () => {
    expect(onSurface("#dfa88f", 30)).toBe("color-mix(in srgb, #dfa88f 30%, var(--color-white, #ffffff))");
  });

  it("quiz bars and the answer wall use it, and no results view mixes with plain white", () => {
    for (const f of ["components/results/QuizResults.tsx", "components/results/TextResults.tsx", "components/results/RankResults.tsx"]) {
      expect(src(f), f).not.toMatch(/%,\s*white\)/);
      expect(src(f), f).not.toMatch(/:\s*"white"/);
    }
    expect(src("components/results/QuizResults.tsx")).toMatch(/onSurface\(/);
    expect(src("components/results/TextResults.tsx")).toMatch(/onSurface\(/);
  });

  it("the places grid writes its numbers in dark ink on the light tint", () => {
    expect(src("components/results/RankResults.tsx")).toMatch(/color:\s*n\s*\?\s*INK/);
  });
});

describe("the voter's card slide doesn't make the phone page scroll sideways", () => {
  it("clips sideways overflow on the voter page", () => {
    expect(src("components/VoteApp.tsx")).toMatch(/className="min-h-dvh overflow-x-clip pb-16"/);
  });
});

describe("Summary counts the people who scored that question", () => {
  it("passes the question's own respondents, not everyone in the presentation", () => {
    expect(src("components/DashboardApp.tsx")).toMatch(/voterCount=\{peopleIn\(group\.focus\.id\)\}/);
  });
});
