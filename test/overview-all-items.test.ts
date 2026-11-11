// The All questions screen lists every item or option of a question, not just the top 3.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FocusOverview } from "@/components/FocusOverview";
import { indexCells } from "@/lib/stats";
import type { ResultCell, ResultsPayload, TopicItem } from "@/lib/types";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const criteria = [{ id: "c1", name: "Impact" }];
const empty = { polls: [], words: [], respondents: [], ranks: [], numbers: [], texts: [], questions: [], quizCounts: [], quizRevealed: [], leaderboard: [] } as unknown as ResultsPayload;
const itemsOf = (n: number) =>
  Array.from({ length: n }, (_, index) => ({ item: { id: `t${index}`, name: `Item ${index + 1}`, description: null, focusId: "f" } as TopicItem, index }));
const group = (kind: string, n: number) =>
  ({ focus: { id: "f", name: "Question", description: null }, kind, chart: "heatmap", maxPicks: null, min: null, max: null, unit: null, seconds: null, topics: itemsOf(n) }) as never;
const render = (kind: string, n: number, cells: ResultCell[] = [], results: ResultsPayload = empty, scaleMax = 5) =>
  html(createElement(FocusOverview, { groups: [group(kind, n)], criteria, cells: indexCells(cells), scaleMax, results, onOpen: () => {} }));
const rows = (out: string) => out.match(/<li /g)?.length ?? 0;

describe("All questions: every item of a question is on its card", () => {
  it("Score items shows all 7 items, best first, items without scores last", () => {
    const cells = [
      { topicId: "t5", criterionId: "c1", n: 1, sum: 5 },
      { topicId: "t1", criterionId: "c1", n: 2, sum: 6 },
    ];
    const out = render("rating", 7, cells);
    expect(rows(out)).toBe(7);
    const order = [...text(out.slice(out.indexOf("<ol"))).matchAll(/Item (\d)/g)].map((m) => m[1]);
    expect(order).toEqual(["6", "2", "1", "3", "4", "5", "7"]);
    expect(text(out)).toMatch(/Item 6 5\.0 Item 2 3\.0 Item 1 —/);
  });

  it("shows the most items a question can have", () => {
    expect(rows(render("rating", 10))).toBe(10);
  });

  it.each(["poll", "multi", "rank"])("%s shows every option", (kind) => {
    const out = render(kind, 6);
    expect(rows(out)).toBe(6);
    for (let i = 1; i <= 6; i++) expect(text(out)).toContain(`Item ${i} `);
  });

  it("names wrap instead of being cut off, and a 10.0 fits its column", () => {
    const out = render("rating", 4, [{ topicId: "t0", criterionId: "c1", n: 1, sum: 10 }], empty, 10);
    expect(out).not.toMatch(/<li[^>]*>\s*<span[^>]*truncate/);
    expect(out).toMatch(/w-\[4ch\][^>]*>10\.0</);
  });

  it("in a very narrow card the name gets a line to itself, with the bar and number under it", () => {
    // 4 cards per row beside the QR code leaves ~200px: 42% of that split "Documentation" mid-word
    const out = render("rating", 3);
    expect(out).toMatch(/<li[^>]*class="[^"]*flex-wrap/);
    expect(out).toMatch(/<li[^>]*><span class="w-full @\[17rem\]:w-\[42%\]/);
  });

  it("a long list goes in two columns where the card is wide enough, never sideways", () => {
    const long = render("rating", 8);
    expect(long).toMatch(/@container/);
    expect(long).toMatch(/<ol[^>]*class="[^"]*@2xl:columns-2/);
    expect(long).toMatch(/<li[^>]*class="[^"]*break-inside-avoid/);
    expect(long).not.toMatch(/overflow-x/);
    expect(render("rating", 4)).not.toMatch(/columns-2/);
  });
});
