// Score items: each item's average and rank, the sort orders on the results screen, best and worst.
import { agreement, type AgreementLabel } from "./insights";
import { avg, cellKey, sumAggs, type Agg } from "./stats";
import type { NamedItem } from "./types";

export type ItemSort = "order" | "top" | "bottom" | "split" | "answers";

export const ITEM_SORTS: { id: ItemSort; label: string }[] = [
  { id: "order", label: "Your order" },
  { id: "top", label: "Top rated first" },
  { id: "bottom", label: "Bottom rated first" },
  { id: "split", label: "Most divided first" },
  { id: "answers", label: "Most answers first" },
];

export const isItemSort = (v: string | null): v is ItemSort => ITEM_SORTS.some((s) => s.id === v);

/** The sort a results view opens on until the presenter picks one. */
export const defaultSort = (view: string): ItemSort => (view === "ranking" || view === "summary" ? "top" : "order");

export interface RatedItem {
  item: NamedItem & { description?: string | null };
  /** Position in the whole presentation (drives its colour). */
  index: number;
  /** Average over every measure; null before anyone scores it. */
  value: number | null;
  /** Scores given. */
  n: number;
  /** Spread of its scores; null with fewer than 2. */
  sd: number | null;
  agree: AgreementLabel | null;
  /** By average, 1 = best; tied items share a rank. null when unscored. */
  rank: number | null;
}

export function rateItems(
  topics: { item: RatedItem["item"]; index: number }[],
  criteria: NamedItem[],
  cells: Map<string, Agg>,
  histograms: Map<string, number[]>,
  scaleMax: number,
): RatedItem[] {
  const rows = topics.map(({ item, index }) => {
    const agg = sumAggs(criteria.map((c) => cells.get(cellKey(item.id, c.id))));
    const a = agreement(histograms.get(item.id) ?? [], scaleMax);
    return { item, index, value: avg(agg), n: agg.n, sd: a?.sd ?? null, agree: a?.label ?? null, rank: null as number | null };
  });
  for (const r of rows) if (r.value !== null) r.rank = 1 + rows.filter((o) => o.value !== null && o.value > r.value!).length;
  return rows;
}

/** Items with no value always go last; ties keep the presenter's order. */
function by(key: (r: RatedItem) => number | null, dir: 1 | -1) {
  return (a: RatedItem, b: RatedItem) => {
    const x = key(a);
    const y = key(b);
    if (x === null || y === null) return x === y ? a.index - b.index : x === null ? 1 : -1;
    return (x - y) * dir || a.index - b.index;
  };
}

export function sortItems(rows: RatedItem[], sort: ItemSort): RatedItem[] {
  const out = [...rows];
  switch (sort) {
    case "top":
      return out.sort(by((r) => r.value, -1));
    case "bottom":
      return out.sort(by((r) => r.value, 1));
    case "split":
      return out.sort(by((r) => r.sd, -1));
    case "answers":
      return out.sort(by((r) => (r.n ? r.n : null), -1));
    default:
      return out.sort((a, b) => a.index - b.index);
  }
}

/**
 * The highest and lowest rated items; no worst until two items score differently.
 * `bestTies` / `worstTies` are every item sharing that score, in the presenter's order
 * (`best` / `worst` are the first of them).
 */
export function bestAndWorst(rows: RatedItem[]): { best: RatedItem | null; worst: RatedItem | null; bestTies: RatedItem[]; worstTies: RatedItem[] } {
  const scored = sortItems(rows, "order").filter((r) => r.value !== null);
  if (scored.length === 0) return { best: null, worst: null, bestTies: [], worstTies: [] };
  const hi = Math.max(...scored.map((r) => r.value!));
  const lo = Math.min(...scored.map((r) => r.value!));
  const bestTies = scored.filter((r) => r.value === hi);
  const worstTies = lo < hi ? scored.filter((r) => r.value === lo) : [];
  return { best: bestTies[0], worst: worstTies[0] ?? null, bestTies, worstTies };
}
