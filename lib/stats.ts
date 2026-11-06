import type { ResultCell, ScoreBucket } from "./types";

export const cellKey = (topicId: string, criterionId: string) => `${topicId}:${criterionId}`;

export interface Agg {
  n: number;
  sum: number;
}

export const avg = (a: Agg | undefined): number | null => (a && a.n > 0 ? a.sum / a.n : null);

export function indexCells(cells: ResultCell[]): Map<string, Agg> {
  const m = new Map<string, Agg>();
  for (const c of cells) m.set(cellKey(c.topicId, c.criterionId), { n: c.n, sum: c.sum });
  return m;
}

export function sumAggs(aggs: (Agg | undefined)[]): Agg {
  let n = 0;
  let sum = 0;
  for (const a of aggs) {
    if (!a) continue;
    n += a.n;
    sum += a.sum;
  }
  return { n, sum };
}

/** Score histogram per topic: topicId → counts[score - 1]. */
export function topicHistograms(dist: ScoreBucket[], scaleMax: number): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const b of dist) {
    let h = m.get(b.topicId);
    if (!h) {
      h = new Array<number>(scaleMax).fill(0);
      m.set(b.topicId, h);
    }
    if (b.score >= 1 && b.score <= scaleMax) h[b.score - 1] += b.n;
  }
  return m;
}

export const fmt1 = (v: number | null) => (v === null ? "—" : v.toFixed(1));
