// "All questions" heatmap: every question's results as coloured tiles, darker = stronger.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { heatRows } from "@/lib/heat";
import { groupByFocus } from "@/lib/focus";
import { indexCells } from "@/lib/stats";
import type { FocusItem, ResultsPayload, TopicItem } from "@/lib/types";
import { ResultsHeatmap } from "@/components/ResultsHeatmap";

const focus: FocusItem[] = [
  { id: "r", name: "Score the ideas", kind: "rating", chart: "heatmap" },
  { id: "p", name: "How did it feel?", kind: "poll", chart: "bars" },
  { id: "m", name: "What helped?", kind: "multi", chart: "bars" },
  { id: "k", name: "Order these", kind: "rank", chart: "ranking" },
  { id: "w", name: "One word", kind: "words", chart: "cloud" },
  { id: "t", name: "Anything else?", kind: "text", chart: "wall" },
  { id: "q", name: "Capital of France?", kind: "quiz", chart: "answers" },
  { id: "e", name: "Nothing yet", kind: "poll", chart: "bars" },
];
const t = (id: string, name: string, focusId: string, description: string | null = null): TopicItem => ({ id, name, focusId, description });
const topics = [
  t("a", "Dark mode", "r", "A night theme"),
  t("b", "Offline mode", "r"),
  t("c", "New logo", "r"),
  t("g", "Great", "p"),
  t("o", "OK", "p"),
  t("x", "Rough", "p"),
  t("m1", "Pairing", "m"),
  t("m2", "Docs", "m"),
  t("k1", "Speed", "k"),
  t("k2", "Price", "k"),
  t("q1", "Paris", "q"),
  t("q2", "Lyon", "q"),
  t("e1", "Yes", "e"),
  t("e2", "No", "e"),
];
const criteria = [{ id: "c1", name: "Impact" }];

const results: ResultsPayload = {
  isOpen: true,
  voterCount: 4,
  // Dark mode 5.0, Offline mode 3.0, New logo unscored
  cells: [
    { topicId: "a", criterionId: "c1", n: 2, sum: 10 },
    { topicId: "b", criterionId: "c1", n: 2, sum: 6 },
  ],
  dist: [],
  polls: [
    { focusId: "p", topicId: "g", n: 3 },
    { focusId: "p", topicId: "o", n: 1 },
    { focusId: "m", topicId: "m1", n: 2 },
    { focusId: "m", topicId: "m2", n: 1 },
  ],
  words: [
    { focusId: "w", word: "calm", n: 4 },
    { focusId: "w", word: "busy", n: 2 },
  ],
  ranks: [
    { focusId: "k", topicId: "k1", rank: 1, n: 2 },
    { focusId: "k", topicId: "k2", rank: 2, n: 2 },
  ],
  numbers: [],
  texts: [],
  respondents: [
    { focusId: "m", n: 2 },
    { focusId: "k", n: 2 },
  ],
  questions: [],
  quizCounts: [
    { focusId: "q", topicId: "q1", n: 3 },
    { focusId: "q", topicId: "q2", n: 1 },
  ],
  quizRevealed: [],
  leaderboard: [],
  quiz: null,
  revision: 0,
};

const groups = groupByFocus(focus, topics);
const { rows, skipped } = heatRows(groups, criteria, indexCells(results.cells), results, 5);
const row = (name: string) => rows.find((r) => r.name === name)!;
const tiles = (name: string) => row(name).tiles.map((x) => [x.name, x.heat === null ? null : Number(x.heat.toFixed(2)), x.label]);

describe("heatRows", () => {
  it("has one row per question with options to compare, in order, and names the rest", () => {
    expect(rows.map((r) => r.name)).toEqual([
      "Score the ideas",
      "How did it feel?",
      "What helped?",
      "Order these",
      "One word",
      "Capital of France?",
      "Nothing yet",
    ]);
    expect(skipped).toEqual(["Anything else?"]);
    expect(row("How did it feel?").groupIndex).toBe(1);
  });

  it("scores use the score scale, strongest first, unscored last", () => {
    expect(tiles("Score the ideas")).toEqual([
      ["Dark mode", 1, "5.0"],
      ["Offline mode", 0.5, "3.0"],
      ["New logo", null, "—"],
    ]);
    expect(row("Score the ideas").tiles[0].description).toBe("A night theme");
    expect(row("Score the ideas").tiles[0].detail).toBe("2 scores");
  });

  it("choices compare with the top answer of their question", () => {
    expect(tiles("How did it feel?")).toEqual([
      ["Great", 1, "75%"],
      ["OK", 0.33, "25%"],
      ["Rough", 0, "0%"],
    ]);
    expect(tiles("What helped?")).toEqual([
      ["Pairing", 1, "100%"],
      ["Docs", 0.5, "50%"],
    ]);
    expect(tiles("Capital of France?")).toEqual([
      ["Paris", 1, "75%"],
      ["Lyon", 0.33, "25%"],
    ]);
  });

  it("orders by average place and shows words by how often they were said", () => {
    expect(tiles("Order these")).toEqual([
      ["Speed", 1, "#1"],
      ["Price", 0, "#2"],
    ]);
    expect(tiles("One word")).toEqual([
      ["calm", 1, "4"],
      ["busy", 0.5, "2"],
    ]);
  });

  it("marks the strongest tile, and leaves a question with no answers cold", () => {
    expect(row("How did it feel?").tiles.map((x) => x.best)).toEqual([true, false, false]);
    expect(row("Nothing yet").tiles.map((x) => [x.heat, x.best])).toEqual([
      [null, false],
      [null, false],
    ]);
  });
});

describe("ResultsHeatmap", () => {
  const html = renderToStaticMarkup(createElement(ResultsHeatmap, { rows, skipped, scaleMax: 5, onOpen: () => {} }));
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("draws every question with its tiles and descriptions", () => {
    expect(text).toMatch(/Score the ideas .*Dark mode A night theme 5\.0 2 scores/);
    expect(text).toMatch(/How did it feel\? .*Great 75% 3 votes/);
  });

  it("explains the colours and lists what it leaves out", () => {
    expect(text).toContain("Darker = stronger");
    expect(text).toContain("Not shown here: “Anything else?”.");
  });

  it("lets each question open its full results", () => {
    expect(html).toContain('aria-label="Open the results of How did it feel?"');
  });
});
