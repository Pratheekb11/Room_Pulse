// Team activities on screen: the phone's answer card for a board question, and the board itself.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TextCard } from "@/components/vote/TextCard";
import { BoardCard } from "@/components/vote/BoardCard";
import { BoardView } from "@/components/results/BoardView";
import { TextAnswers } from "@/components/results/TextResults";
import type { TextAnswer } from "@/lib/types";

const card = (extra: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(TextCard, { question: "What motivates you?", color: "#000", value: undefined, status: undefined, disabled: false, onSend: () => {}, ...extra }),
  );

const t = (id: string, text: string, author: string | null = null): TextAnswer => ({
  id,
  focusId: "f",
  hidden: false,
  text,
  author,
  at: "2026-11-14T10:00:00.000Z",
});

const leafCard = (extra: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(BoardCard, {
      question: "What motivates you?",
      color: "#000",
      board: "tree",
      leaves: [],
      disabled: false,
      onSave: () => {},
      onRemove: () => {},
      onFinish: () => {},
      ...extra,
    }),
  );

describe("the phone's card for a board question", () => {
  it("asks for a leaf on a tree, signed with the person's name (team building needs names)", () => {
    const html = leafCard({});
    expect(html).toContain("Write your leaf");
    expect(html).toContain("Your name");
    expect(html).not.toContain("optional");
    expect(html).not.toContain("nobody will know");
    expect(html).toMatch(/id="text-author"[^>]*required/);
    expect(html).toMatch(/maxLength="30"|maxlength="30"/);
    expect(html).toContain("goes on the tree");
    expect(html).toContain("Add my leaf");
    expect(html).toContain("You can add up to 5 leaves.");
  });

  it("names the piece for each board", () => {
    expect(leafCard({ board: "wall" })).toContain("Write your sticky note");
    expect(leafCard({ board: "sky" })).toContain("Write your star");
  });

  it("fills in the name the person signed with before", () => {
    expect(leafCard({ author: "Priya" })).toContain('value="Priya"');
  });

  it("won't add a leaf until there's a name", () => {
    const src = readFileSync(new URL("../components/vote/BoardCard.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/disabled=\{disabled \|\| !clean \|\| !tidy\(name\)\}/);
  });

  it("lists the person's own leaves, each to change or take back, and offers another", () => {
    const html = leafCard({ leaves: ["Growth", "", "Coffee"] });
    expect(html).toContain("Growth");
    expect(html).toContain("Coffee");
    expect(html).toContain("Your leaves (2 of 5)");
    expect(html).toContain('aria-label="Change leaf: Growth"');
    expect(html).toContain('aria-label="Take back leaf: Coffee"');
    expect(html).toContain("Add another leaf");
  });

  it("lets people say they're done once they've added a leaf (so one leaf doesn't end the activity)", () => {
    expect(leafCard({})).not.toContain("all from me");
    expect(leafCard({ leaves: ["Growth"] })).toContain("all from me");
    expect(leafCard({ leaves: ["Growth"], finished: true })).not.toContain("all from me");
  });

  it("counts a board as done only at 5 leaves or when the person says so", () => {
    const src = readFileSync(new URL("../components/VoteApp.tsx", import.meta.url), "utf8");
    expect(src).toContain("v.filter((t) => t).length >= MAX_LEAVES || (v.some((t) => t) && finished.includes(g.focus.id))");
    expect(src).toMatch(/<BoardCard[\s\S]*?finished=\{finished\.includes\(group\.focus\.id\)\}[\s\S]*?onFinish=\{\(\) => onFinish\(here\.gi\)\}/);
  });

  it("stops at 5 leaves", () => {
    const html = leafCard({ leaves: ["a", "b", "c", "d", "e"] });
    expect(html).toContain("Your leaves (5 of 5)");
    expect(html).not.toContain("Add another leaf");
    expect(html).toContain("most each person can add");
  });

  it("links to the live board once a leaf is on it, when results are shared", () => {
    expect(leafCard({ seeHref: "/s/abcd/results" })).not.toContain("See the tree");
    const html = leafCard({ leaves: ["Growth"], seeHref: "/s/abcd/results" });
    expect(html).toContain('href="/s/abcd/results"');
    expect(html).toContain("See the tree");
  });

  it("is what the voter page shows for board questions, one save per leaf", () => {
    const src = readFileSync(new URL("../components/VoteApp.tsx", import.meta.url), "utf8");
    expect(src).toContain("<BoardCard");
    expect(src).toContain("leafKey(");
  });

  it("stays anonymous on a plain open answer: no name box", () => {
    const html = card({});
    expect(html).not.toContain("Sign it");
    expect(html).toContain("Your answer is anonymous.");
  });
});

describe("the board on the results screen", () => {
  it("shows sticky notes with their names", () => {
    const html = renderToStaticMarkup(createElement(BoardView, { board: "wall", answers: [t("1", "Pairing"), t("2", "Demos", "Ana")] }));
    expect(html).toContain("Pairing");
    expect(html).toContain("Demos");
    expect(html).toContain("— Ana");
  });

  it("says what will happen while the wall is empty", () => {
    const html = renderToStaticMarkup(createElement(BoardView, { board: "wall", answers: [] }));
    expect(html).toContain("Sticky notes will appear here");
  });

  it("is what the open answers show in the board view, without hidden answers", () => {
    const html = renderToStaticMarkup(
      createElement(TextAnswers, {
        code: "abcd",
        answers: [t("1", "Pairing"), { ...t("2", "rude"), hidden: true }],
        focusId: "f",
        view: "board",
        board: "wall",
        owner: false,
      }),
    );
    expect(html).toContain('aria-label="Sticky notes"');
    expect(html).toContain("Pairing");
    expect(html).not.toContain("rude");
  });

  it("is offered on the results screen through chartsFor", () => {
    const src = readFileSync(new URL("../components/DashboardApp.tsx", import.meta.url), "utf8");
    expect(src).toContain("chartsFor(group.kind, group.board)");
    expect(src).toMatch(/board=\{group\.board/);
  });
});

describe("the builder", () => {
  const src = readFileSync(new URL("../components/admin/PresentationForm.tsx", import.meta.url), "utf8");

  it("turns an activity's plan into questions with their board, view and description", async () => {
    const { draftsFromPlan } = await import("@/components/admin/PresentationForm");
    const { ACTIVITIES } = await import("@/lib/activities");
    const [leaf] = draftsFromPlan(ACTIVITIES[0].plan, 0);
    expect(leaf).toMatchObject({ kind: "text", board: "tree", chart: "board", description: "Write it on your leaf. Add your name if you like." });
    const [poll] = draftsFromPlan({ title: "x", questions: [{ kind: "poll", name: "Coffee?", options: ["Yes", "No"] }] }, 0);
    expect(poll.board).toBeNull();
  });

  it("offers the team activities when starting, next to the templates", () => {
    expect(src).toContain("ACTIVITIES.map");
    expect(src).toContain("Team activities");
  });

  it("lets an open answer question be shown as a board", () => {
    expect(src).toContain("Show answers as");
    expect(src).toContain("chartsFor(f.kind, f.board)");
  });

  it("sends the board when creating and editing, and shares results on phones for activities", () => {
    expect(src.match(/board: f\.kind === "text" \? \(f\.board \?\? null\) : null/g)?.length).toBeGreaterThanOrEqual(1);
    expect(src).toContain("showResults");
  });
});

describe("the builder's preview", () => {
  it("keeps each question's board and has sample leaves, all signed", async () => {
    const { previewQuestions, sampleBoardAnswers } = await import("@/lib/preview");
    const [q] = previewQuestions([{ kind: "text", name: "What motivates you?", options: [], board: "tree" }]);
    expect(q.board).toBe("tree");
    const samples = sampleBoardAnswers("preview-0");
    expect(samples.length).toBeGreaterThanOrEqual(6);
    expect(samples.every((s) => s.author)).toBe(true);
    expect(new Set(samples.map((s) => s.id)).size).toBe(samples.length);
  });

  it("draws the board and the leaf card", () => {
    const src = readFileSync(new URL("../components/admin/PresentationPreview.tsx", import.meta.url), "utf8");
    expect(src).toContain("<BoardView");
    expect(src).toContain("<BoardCard");
  });
});

describe("the home page", () => {
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  it("has a Team activities section listing every activity", () => {
    expect(home).toContain('aria-labelledby="activities-h"');
    expect(home).toContain("ACTIVITIES.map");
  });

  it("lists team activities in what you can do", async () => {
    const { productFeatures } = await import("@/lib/features");
    const { ACTIVITIES } = await import("@/lib/activities");
    const f = productFeatures({ ai: false }).find((x) => /team activities/i.test(x.title));
    expect(f?.title).toBe(`${ACTIVITIES.length} team activities`);
    expect(f?.body).toContain("Motivation tree");
  });
});

describe("phone wording for signed answers", () => {
  it("puts stars in the sky, not on it", () => {
    expect(leafCard({ board: "sky" })).toContain("goes in the sky");
    expect(leafCard({ board: "wall" })).toContain("goes on the wall");
  });

  it("doesn't promise anonymity in the header when answers can be signed", async () => {
    const { VoterHeader } = await import("@/components/VoterChrome");
    const head = (signable: boolean) => renderToStaticMarkup(createElement(VoterHeader, { title: "T", theme: "paper", decor: false, score: null, signable }));
    expect(head(false)).toContain("Your answers are anonymous.");
    expect(head(true)).not.toContain("Your answers are anonymous.");
    expect(head(true)).toContain("Answers on a board show your name.");
  });

  it("passes whether any question can be signed to the header", () => {
    const src = readFileSync(new URL("../components/VoteApp.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/signable=\{groups\.some\(\(g\) => g\.board\)\}/);
  });

  it("has zoom buttons on the tree and sky", () => {
    const src = readFileSync(new URL("../components/results/BoardView.tsx", import.meta.url), "utf8");
    expect(src).toContain('aria-label="Zoom in"');
    expect(src).toContain('aria-label="Zoom out"');
    expect(src).toContain("sceneSize(");
    expect(src).toContain("clampPan(");
  });

  it("opens the list of leaves on phones, where leaves are too small to read", () => {
    const src = readFileSync(new URL("../components/results/BoardView.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/useState\(\(\) => typeof window !== "undefined" && window\.innerWidth < 560\)/);
  });
});
