// Smaller things from the 2026-11-09 sweep: question picker on phones, ties for best and lowest, overview card title.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuestionList, QuestionTabs } from "@/components/ScreenChrome";
import { ExecSummary } from "@/components/ExecSummary";
import { ChipList, VoterProgress } from "@/components/VoterChrome";
import { readFileSync } from "node:fs";
import { FocusOverview } from "@/components/FocusOverview";
import { bestAndWorst, rateItems } from "@/lib/rank-items";
import { indexCells } from "@/lib/stats";
import { toMarkdown } from "@/lib/markdown";
import type { ResultCell, ResultsPayload, TopicItem } from "@/lib/types";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const names = ["Rate the ideas", "Best day?", "Order these"].map((name, i) => ({ key: `k${i}`, name }));

describe("picking a question on the presenter's phone", () => {
  const tabs = html(createElement(QuestionTabs, { names, active: 2, onPick: () => {} }));

  it("shows one button with the current question instead of a row that scrolls sideways", () => {
    expect(tabs).not.toMatch(/overflow-x-auto/);
    // container queries: the builder's preview draws the big screen at 1280px even on a phone
    expect(tabs).toMatch(/class="@container/);
    expect(tabs).toMatch(/<nav[^>]*aria-label="Questions"[^>]*class="[^"]*@max-xl:hidden/);
    expect(tabs).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*class="[^"]*@xl:hidden/);
    expect(text(tabs)).toContain("Question 3 of 3: Order these");
  });

  it("says All questions on the overview", () => {
    expect(text(html(createElement(QuestionTabs, { names, active: null, onPick: () => {} })))).toContain("All questions (3)");
  });

  it("opens a full-screen list of every question, the current one marked", () => {
    const list = html(createElement(QuestionList, { names, active: 1, onPick: () => {}, onClose: () => {} }));
    expect(list).toMatch(/role="dialog"/);
    expect(list).toMatch(/fixed inset-0/);
    expect(text(list)).toMatch(/All questions .*Rate the ideas .*Best day\? .*Order these/);
    expect(list).toMatch(/aria-current="page"[^>]*>(?:(?!<\/button>).)*Best day\?/);
  });
});

const criteria = [{ id: "c1", name: "Impact" }];
const item = (id: string, name: string, description: string | null = null): TopicItem => ({ id, name, description, focusId: "f" });
const topics = [item("a", "Dark mode", "Night theme"), item("b", "Offline"), item("c", "Search"), item("d", "Logo")].map((t, index) => ({ item: t, index }));
const cellsOf = (s: Record<string, number[]>): ResultCell[] =>
  Object.entries(s).filter(([, v]) => v.length).map(([id, v]) => ({ topicId: id, criterionId: "c1", n: v.length, sum: v.reduce((a, b) => a + b, 0) }));
const rated = (s: Record<string, number[]>) => rateItems(topics, criteria, indexCells(cellsOf(s)), new Map(), 5);

describe("ties for best and lowest", () => {
  it("lists every item tied for best and for lowest", () => {
    const r = bestAndWorst(rated({ a: [4], b: [4], c: [2], d: [2] }));
    expect(r.bestTies.map((x) => x.item.name)).toEqual(["Dark mode", "Offline"]);
    expect(r.worstTies.map((x) => x.item.name)).toEqual(["Search", "Logo"]);
    expect(r.best?.item.name).toBe("Dark mode");
  });

  it("the Summary names them all and tags each one", () => {
    const rows = rated({ a: [4], b: [4], c: [2] });
    const out = text(html(createElement(ExecSummary, { rows, sort: "top", criteria, cells: indexCells(cellsOf({ a: [4], b: [4], c: [2] })), scaleMax: 5, voterCount: 1 })));
    expect(out).toMatch(/Tied for best Dark mode and Offline 4\.0 \/ 5/);
    expect(out).toMatch(/Lowest rated Search 2\.0 \/ 5/);
    expect(out).toMatch(/1 Dark mode Best/);
    expect(out).toMatch(/1 Offline Best/);
  });

  it("everything tied: best names them all and there is no lowest", () => {
    const rows = rated({ a: [3], b: [3] });
    const out = text(html(createElement(ExecSummary, { rows, sort: "top", criteria, cells: indexCells(cellsOf({ a: [3], b: [3] })), scaleMax: 5, voterCount: 1 })));
    expect(out).toMatch(/Tied for best Dark mode and Offline 3\.0/);
    expect(out).not.toMatch(/Lowest/);
  });

  it("the Markdown names them all too", () => {
    const row = (topic: string, sum: number, pos: number) => ({ focus: "Q", topic, description: null, criterion: "Impact", n: sum ? 1 : 0, sum, topicPosition: pos });
    const md = toMarkdown("T", [row("A", 4, 0), row("B", 4, 1), row("C", 2, 2), row("D", 2, 3)], []);
    expect(md).toContain("- Best rated: A and B (4.0)\n- Lowest rated: C and D (2.0)");
  });
});

describe("Score items card on the All questions screen", () => {
  it("gives the title the card's full width, not a column beside the score", () => {
    const empty = { polls: [], words: [], respondents: [], ranks: [], numbers: [], texts: [], questions: [], quizCounts: [], quizRevealed: [], leaderboard: [] } as unknown as ResultsPayload;
    const group = { focus: { id: "f", name: "Rate the ideas", description: null }, kind: "rating" as const, chart: "heatmap", maxPicks: null, min: null, max: null, unit: null, seconds: null, topics };
    const out = html(createElement(FocusOverview, { groups: [group], criteria, cells: indexCells(cellsOf({ a: [4] })), scaleMax: 5, results: empty, onOpen: () => {} }));
    // the header row (type and score) closes before the title starts
    expect(out).toMatch(/4\.0<\/span><\/div><h2/);
  });
});

describe("nothing scrolls sideways on the phone", () => {
  const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const chips = ["Rate the ideas", "Best day?", "Order these"].map((label, i) => ({ key: `c${i}`, label, active: i === 1, finished: i === 0, progress: i === 2 ? "0/3" : undefined }));

  it("the voter's question chips are one button that opens a vertical list", () => {
    const bar = html(createElement(VoterProgress, { done: 1, total: 5, chips, onChip: () => {} }));
    expect(bar).not.toMatch(/overflow-x-auto/);
    expect(bar).toMatch(/aria-haspopup="dialog"/);
    expect(text(bar)).toContain("Question 2 of 3: Best day?");
  });

  it("the list shows every question with what's done, the current one marked", () => {
    const list = html(createElement(ChipList, { chips, onChip: () => {}, onClose: () => {} }));
    expect(list).toMatch(/role="dialog"/);
    expect(text(list)).toMatch(/✓ Rate the ideas .*Best day\? .*Order these 0\/3/);
    expect(list).toMatch(/aria-current="step"[^>]*>(?:(?!<\/button>).)*Best day\?/);
  });

  it("the chart switcher and the design picker wrap instead of scrolling", () => {
    expect(src("components/DashboardApp.tsx")).not.toMatch(/aria-label="Chart" className="[^"]*overflow-x-auto/);
    expect(src("components/DashboardApp.tsx")).toMatch(/aria-label="Chart" className="[^"]*flex-wrap/);
    expect(src("components/admin/ThemePicker.tsx")).not.toMatch(/overflow-x-auto/);
  });
});
