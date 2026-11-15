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

// Found in the 2026-11-14 sweep: with a leaf, note or star shown big, Esc also went back to
// "All questions" and the arrow keys also changed the question behind it.
describe("keys pressed while a leaf, note or star is shown big stay with it", () => {
  const board = src("components/results/BoardView.tsx");
  const dialog = board.slice(board.indexOf("function PieceDialog"));

  it("handles Esc and the arrows before the results screen does, and stops them there", () => {
    expect(dialog).toMatch(/window\.addEventListener\("keydown", onKey, true\)/);
    expect(dialog).toMatch(/window\.removeEventListener\("keydown", onKey, true\)/);
    expect(dialog).toContain("e.stopImmediatePropagation()");
  });

  it("takes the focus once, when it opens, not again every time new results arrive", () => {
    // its close and step handlers are new functions on every refresh: they're kept in a ref
    expect(dialog).toMatch(/closeRef\.current\?\.focus\(\);[\s\S]{0,900}\}, \[\]\);/);
  });

  it("keeps the presenter's other shortcuts (F, Q, 1–5) from firing behind it", () => {
    // every key is stopped while the box is open, except Tab (moving between its buttons)
    expect(dialog).toMatch(/e\.key === "Tab"/);
  });
});

// Found in the 2026-11-14 sweep, on the builder at 390px.
describe("the builder's item rows and save bar fit a phone", () => {
  it("puts '+ description' on a line of its own, so the item's name box keeps the row's width", () => {
    // sharing the row, it left the name box about 10 letters wide on a phone ("Daily standu")
    const list = src("components/admin/ListEditor.tsx");
    expect(list).toMatch(/<div className="w-full[^"]*">\s*<button[\s\S]{0,400}\+ description/);
  });

  it("says 'Save' on a phone, where 'Save changes' doesn't fit beside Cancel and Preview", () => {
    const form = src("components/admin/PresentationForm.tsx");
    expect(form).toMatch(/Save<span className="max-sm:hidden"> changes<\/span>/);
  });
});

describe("the tree's 'tap to read' hint stays on one line on a phone", () => {
  it("uses the short wording when the picture is narrow (the long one wrapped under the zoom buttons' side)", () => {
    const board = src("components/results/BoardView.tsx");
    expect(board).toMatch(/w < 360 \? `Tap a \$\{[a-z]+\} to read it` : `Zoom in or tap a \$\{[a-z]+\} to read it`/);
    expect(board).toMatch(/whitespace-nowrap[^"]*">\{hint\}/);
  });
});
