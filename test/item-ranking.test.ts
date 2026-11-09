// Score items results: best and worst, sorting, and item descriptions on every results view.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bestAndWorst, defaultSort, ITEM_SORTS, rateItems, sortItems, type ItemSort } from "@/lib/rank-items";
import { indexCells, topicHistograms } from "@/lib/stats";
import type { ResultCell, ScoreBucket, TopicItem } from "@/lib/types";
import { ExecSummary } from "@/components/ExecSummary";
import { Heatmap } from "@/components/Heatmap";
import { OverallBars } from "@/components/OverallBars";
import { Breakdown } from "@/components/Breakdown";
import { TopicCard } from "@/components/TopicCard";

const criteria = [{ id: "c1", name: "Impact" }];
const item = (id: string, name: string, description: string | null = null): TopicItem => ({ id, name, description, focusId: "f" });
const topics = [
  item("a", "Dark mode", "A night theme for the whole app"),
  item("b", "Offline mode", "Works on the train"),
  item("c", "Faster search"),
  item("d", "New logo", "Nobody has scored this yet"),
].map((t, index) => ({ item: t, index }));

/** Scores per item: a = 4, 5 (avg 4.5); b = 1, 5 (avg 3, split); c = 2, 2, 2 (avg 2); d = none. */
const scores: Record<string, number[]> = { a: [4, 5], b: [1, 5], c: [2, 2, 2], d: [] };
const cellsOf = (s: Record<string, number[]>): ResultCell[] =>
  Object.entries(s)
    .filter(([, v]) => v.length)
    .map(([topicId, v]) => ({ topicId, criterionId: "c1", n: v.length, sum: v.reduce((x, y) => x + y, 0) }));
const distOf = (s: Record<string, number[]>): ScoreBucket[] =>
  Object.entries(s).flatMap(([topicId, v]) => v.map((score) => ({ topicId, criterionId: "c1", score, n: 1 })));

const cells = indexCells(cellsOf(scores));
const histograms = topicHistograms(distOf(scores), 5);
const rows = rateItems(topics, criteria, cells, histograms, 5);
const names = (sort: ItemSort) => sortItems(rows, sort).map((r) => r.item.name);

describe("rating items", () => {
  it("gives each item its average, answer count and score rank (1 = best)", () => {
    expect(rows.map((r) => [r.item.name, r.value, r.n, r.rank])).toEqual([
      ["Dark mode", 4.5, 2, 1],
      ["Offline mode", 3, 2, 2],
      ["Faster search", 2, 3, 3],
      ["New logo", null, 0, null],
    ]);
  });

  it("shares a rank between tied items", () => {
    const tied = rateItems(topics, criteria, indexCells(cellsOf({ a: [4], b: [4], c: [2] })), new Map(), 5);
    expect(tied.map((r) => r.rank)).toEqual([1, 1, 3, null]);
  });
});

describe("sorting items", () => {
  it("offers top rated, bottom rated and more", () => {
    expect(ITEM_SORTS.map((s) => s.label)).toEqual([
      "Your order",
      "Top rated first",
      "Bottom rated first",
      "Most divided first",
      "Most answers first",
    ]);
  });

  it("sorts each way, with unscored items always last", () => {
    expect(names("order")).toEqual(["Dark mode", "Offline mode", "Faster search", "New logo"]);
    expect(names("top")).toEqual(["Dark mode", "Offline mode", "Faster search", "New logo"]);
    expect(names("bottom")).toEqual(["Faster search", "Offline mode", "Dark mode", "New logo"]);
    expect(names("split")).toEqual(["Offline mode", "Dark mode", "Faster search", "New logo"]);
    expect(names("answers")).toEqual(["Faster search", "Dark mode", "Offline mode", "New logo"]);
  });

  it("keeps your order between ties", () => {
    const tied = rateItems(topics, criteria, indexCells(cellsOf({ a: [3], b: [3], c: [3] })), new Map(), 5);
    expect(sortItems(tied, "bottom").map((r) => r.item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not change the list it is given", () => {
    const copy = rows.map((r) => r.item.id);
    sortItems(rows, "bottom");
    expect(rows.map((r) => r.item.id)).toEqual(copy);
  });

  it("opens Ranking and Summary on top rated, the others on your order", () => {
    expect(defaultSort("ranking")).toBe("top");
    expect(defaultSort("summary")).toBe("top");
    expect(defaultSort("heatmap")).toBe("order");
    expect(defaultSort("breakdown")).toBe("order");
  });
});

describe("best and worst", () => {
  it("picks the highest and lowest average", () => {
    const { best, worst } = bestAndWorst(rows);
    expect(best?.item.name).toBe("Dark mode");
    expect(worst?.item.name).toBe("Faster search");
  });

  it("has no worst with only one scored item, or when every item scores the same", () => {
    const one = rateItems(topics, criteria, indexCells(cellsOf({ a: [4] })), new Map(), 5);
    expect(bestAndWorst(one).best?.item.name).toBe("Dark mode");
    expect(bestAndWorst(one).worst).toBeNull();
    const same = rateItems(topics, criteria, indexCells(cellsOf({ a: [3], b: [3] })), new Map(), 5);
    expect(bestAndWorst(same).worst).toBeNull();
  });

  it("has neither before anyone scores", () => {
    const none = rateItems(topics, criteria, new Map(), new Map(), 5);
    expect(bestAndWorst(none)).toEqual({ best: null, worst: null, bestTies: [], worstTies: [] });
  });
});

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the Summary view", () => {
  const summary = (sort: ItemSort = "top") =>
    text(html(createElement(ExecSummary, { rows, sort, criteria, cells, scaleMax: 5, voterCount: 3 })));

  it("shows the best and the lowest rated item, with their descriptions", () => {
    const out = summary();
    expect(out).toMatch(/Best rated Dark mode A night theme for the whole app 4\.5 \/ 5/);
    expect(out).toMatch(/Lowest rated Faster search 2\.0 \/ 5/);
  });

  it("lists every item by rank with its description", () => {
    const out = summary();
    expect(out).toMatch(/1 Dark mode Best A night theme for the whole app 4\.5/);
    expect(out).toMatch(/2 Offline mode Works on the train 3\.0/);
    expect(out).toMatch(/3 Faster search Lowest 2\.0/);
    expect(out).toMatch(/– New logo Nobody has scored this yet —/);
  });

  it("follows the sort but keeps each item's real rank", () => {
    const out = summary("bottom");
    expect(out.indexOf("3 Faster search")).toBeGreaterThan(-1);
    expect(out.indexOf("3 Faster search")).toBeLessThan(out.indexOf("1 Dark mode Best"));
  });
});

describe("item descriptions on the results screen", () => {
  it("are under each item in the colour grid", () => {
    const out = text(html(createElement(Heatmap, { topics: topics.map((t) => t.item), criteria, cells, scaleMax: 5, flash: {} })));
    expect(out).toContain("Dark mode A night theme for the whole app");
    expect(out).toContain("Offline mode Works on the train");
  });

  it("are under each bar in the ranking, which shows each item's real rank", () => {
    const data = sortItems(rows, "bottom").map((r) => ({ id: r.item.id, name: r.item.name, description: r.item.description, value: r.value, n: r.n, index: r.index, rank: r.rank }));
    const out = text(html(createElement(OverallBars, { data, scaleMax: 5, size: "large", ranked: true })));
    expect(out).toMatch(/3 Faster search .*2 Offline mode Works on the train .*1 Dark mode A night theme for the whole app/);
  });

  it("are on each score spread card", () => {
    const out = text(html(createElement(Breakdown, { topics, criteria, cells, histograms, scaleMax: 5, onOpen: () => {} })));
    expect(out).toContain("Dark mode A night theme for the whole app");
  });

  it("are on the phone while answering", () => {
    const out = text(
      html(
        createElement(TopicCard, {
          topic: topics[0].item,
          index: 0,
          total: 4,
          color: "#ffcc00",
          criteria,
          session: { code: "X", title: "T", scaleMax: 5, lowLabel: "Low", highLabel: "High", isOpen: true, revision: 0, theme: "paper", decor: true },
          ratings: {},
          statuses: {},
          disabled: false,
          onRate: () => {},
        }),
      ),
    );
    expect(out).toContain("Dark mode A night theme for the whole app");
  });
});
