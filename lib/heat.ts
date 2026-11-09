// The "All questions" heatmap: every question's results as tiles, heat 0 (weakest) to 1 (strongest).
import { pollTally, rankTally, wordWeights } from "./answers";
import type { FocusGroup } from "./focus";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "./stats";
import type { NamedItem, QuestionKind, ResultsPayload } from "./types";

export interface HeatTile {
  id: string;
  name: string;
  description: string | null;
  /** 0 = weakest, 1 = strongest; null = no answers yet. */
  heat: number | null;
  /** Big number on the tile: "4.2", "75%", "#1". */
  label: string;
  /** Small line under it: "12 scores", "3 votes". */
  detail: string;
  /** The strongest tile of its question. */
  best: boolean;
}

export interface HeatRow {
  focusId: string;
  /** Position in the question list, to open its full results. */
  groupIndex: number;
  name: string;
  kind: QuestionKind;
  tiles: HeatTile[];
}

/** Question types with options or words to compare; the others (open answers, Q&A, numbers) are listed as left out. */
const SHOWN = new Set<QuestionKind>(["rating", "poll", "multi", "rank", "words", "quiz"]);
const MAX_WORDS = 12;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Strongest first; tiles with no answers keep their order at the end. */
const strongestFirst = (tiles: HeatTile[]) =>
  tiles.map((tile, i) => ({ tile, i })).sort((a, b) => (b.tile.heat ?? -1) - (a.tile.heat ?? -1) || a.i - b.i).map((x) => x.tile);

function markBest(tiles: HeatTile[]): HeatTile[] {
  const max = Math.max(-1, ...tiles.map((t) => t.heat ?? -1));
  const top = tiles.filter((t) => t.heat === max);
  return tiles.map((t) => ({ ...t, best: max > 0 && top.length === 1 && t === top[0] }));
}

/** Choices (poll, quiz, pick several): heat compared with the top answer of the question. */
function choiceTiles(rows: { id: string; name: string; n: number; pct: number }[], noun: [string, string]): HeatTile[] {
  const max = Math.max(0, ...rows.map((r) => r.n));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: null,
    heat: max ? r.n / max : null,
    label: `${r.pct}%`,
    detail: plural(r.n, ...noun),
    best: false,
  }));
}

export function heatRows(
  groups: FocusGroup[],
  criteria: NamedItem[],
  cells: Map<string, Agg>,
  results: ResultsPayload,
  scaleMax: number,
): { rows: HeatRow[]; skipped: string[] } {
  const rows: HeatRow[] = [];
  const skipped: string[] = [];
  groups.forEach((g, groupIndex) => {
    if (!SHOWN.has(g.kind)) {
      skipped.push(g.focus.name);
      return;
    }
    const options = g.topics.map((t) => t.item);
    const people = results.respondents.find((x) => x.focusId === g.focus.id)?.n ?? 0;
    let tiles: HeatTile[];
    switch (g.kind) {
      case "rating":
        tiles = g.topics.map(({ item }) => {
          const agg = sumAggs(criteria.map((c) => cells.get(cellKey(item.id, c.id))));
          const v = avg(agg);
          return {
            id: item.id,
            name: item.name,
            description: item.description ?? null,
            heat: v === null ? null : (v - 1) / Math.max(1, scaleMax - 1),
            label: fmt1(v),
            detail: plural(agg.n, "score", "scores"),
            best: false,
          };
        });
        break;
      case "poll":
        tiles = choiceTiles(pollTally(options, results.polls, g.focus.id).rows, ["vote", "votes"]);
        break;
      case "quiz":
        tiles = choiceTiles(
          pollTally(
            options,
            results.quizCounts.map((c) => ({ focusId: c.focusId, topicId: c.topicId, n: c.n })),
            g.focus.id,
          ).rows,
          ["answer", "answers"],
        );
        break;
      case "multi":
        tiles = choiceTiles(pollTally(options, results.polls, g.focus.id, people).rows, ["person", "people"]);
        break;
      case "rank":
        tiles = rankTally(options, results.ranks, g.focus.id).rows.map((r, pos) => ({
          id: r.id,
          name: r.name,
          description: null,
          heat: r.average === null ? null : r.score,
          label: r.average === null ? "—" : `#${pos + 1}`,
          detail: r.average === null ? "not placed yet" : `average place ${r.average.toFixed(1)}`,
          best: false,
        }));
        break;
      default: {
        const words = wordWeights(results.words, g.focus.id).slice(0, MAX_WORDS);
        const max = words[0]?.n ?? 0;
        tiles = words.map((w) => ({
          id: w.word,
          name: w.word,
          description: null,
          heat: max ? w.n / max : null,
          label: String(w.n),
          detail: w.n === 1 ? "said once" : `said ${w.n} times`,
          best: false,
        }));
      }
    }
    rows.push({ focusId: g.focus.id, groupIndex, name: g.focus.name, kind: g.kind, tiles: markBest(strongestFirst(tiles)) });
  });
  return { rows, skipped };
}
