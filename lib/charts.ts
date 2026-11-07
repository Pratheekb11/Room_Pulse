import type { QuestionKind } from "./types";

/** Charts a presenter can pick for each question type. The first is the default. */
export const CHARTS = {
  rating: [
    { id: "heatmap", label: "Colour grid" },
    { id: "ranking", label: "Ranking" },
    { id: "breakdown", label: "Score spread" },
    { id: "summary", label: "Summary" },
  ],
  poll: [
    { id: "bars", label: "Bars" },
    { id: "columns", label: "Columns" },
    { id: "pie", label: "Pie" },
    { id: "donut", label: "Donut" },
  ],
  words: [
    { id: "cloud", label: "Word cloud" },
    { id: "list", label: "Ranked list" },
  ],
  multi: [
    { id: "bars", label: "Bars" },
    { id: "columns", label: "Columns" },
  ],
  text: [
    { id: "wall", label: "Answer wall" },
    { id: "spotlight", label: "One at a time" },
  ],
  rank: [
    { id: "ranking", label: "Ranking" },
    { id: "places", label: "Places grid" },
  ],
  number: [
    { id: "histogram", label: "Spread" },
    { id: "summary", label: "Big numbers" },
  ],
} as const satisfies Record<QuestionKind, readonly { id: string; label: string }[]>;

export type ChartId<K extends QuestionKind = QuestionKind> = (typeof CHARTS)[K][number]["id"];

export const defaultChart = (kind: QuestionKind): string => CHARTS[kind][0].id;

export const isChartFor = (kind: QuestionKind, chart: string): boolean => CHARTS[kind].some((c) => c.id === chart);
