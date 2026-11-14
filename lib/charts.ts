import type { QuestionKind } from "./types";
import { boardInfo, type BoardId } from "./boards";

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
    // only for questions shown as a board (lib/boards.ts); labelled with the board's name
    { id: "board", label: "Board" },
  ],
  rank: [
    { id: "ranking", label: "Ranking" },
    { id: "places", label: "Places grid" },
  ],
  number: [
    { id: "histogram", label: "Spread" },
    { id: "summary", label: "Big numbers" },
  ],
  qa: [
    { id: "top", label: "Most votes" },
    { id: "new", label: "Newest" },
  ],
  quiz: [
    { id: "answers", label: "Answers" },
    { id: "leaderboard", label: "Leaderboard" },
  ],
} as const satisfies Record<QuestionKind, readonly { id: string; label: string }[]>;

export type ChartId<K extends QuestionKind = QuestionKind> = (typeof CHARTS)[K][number]["id"];

export const defaultChart = (kind: QuestionKind): string => CHARTS[kind][0].id;

export const isChartFor = (kind: QuestionKind, chart: string): boolean => CHARTS[kind].some((c) => c.id === chart);

/** Charts to offer for one question: the board view only on board questions, first and named after the board. */
export function chartsFor(kind: QuestionKind, board: BoardId | null | undefined): { id: string; label: string }[] {
  const list: { id: string; label: string }[] = CHARTS[kind].map((c) => ({ id: c.id, label: c.label }));
  if (kind !== "text") return list;
  const rest = list.filter((c) => c.id !== "board");
  return board ? [{ id: "board", label: boardInfo(board).label }, ...rest] : rest;
}
