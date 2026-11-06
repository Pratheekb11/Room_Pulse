import type { NamedItem, PollCount, WordCount } from "./types";

export interface PollTally {
  total: number;
  rows: { id: string; name: string; n: number; pct: number; index: number }[];
  /** Option with the most votes, or null on a tie / no votes. */
  leader: { id: string; name: string; n: number } | null;
}

export function pollTally(options: NamedItem[], polls: PollCount[], focusId: string): PollTally {
  const counts = new Map(polls.filter((p) => p.focusId === focusId).map((p) => [p.topicId, p.n]));
  const total = options.reduce((s, o) => s + (counts.get(o.id) ?? 0), 0);
  const rows = options.map((o, index) => {
    const n = counts.get(o.id) ?? 0;
    return { id: o.id, name: o.name, n, pct: total ? Math.round((n / total) * 100) : 0, index };
  });
  const max = Math.max(0, ...rows.map((r) => r.n));
  const top = rows.filter((r) => r.n === max);
  return { total, rows, leader: max > 0 && top.length === 1 ? { id: top[0].id, name: top[0].name, n: max } : null };
}

/** Words for one focus topic, most-said first, with weight 0…1 for sizing. */
export function wordWeights(words: WordCount[], focusId: string): { word: string; n: number; weight: number }[] {
  const mine = words.filter((w) => w.focusId === focusId).sort((a, b) => b.n - a.n || a.word.localeCompare(b.word));
  if (mine.length === 0) return [];
  const max = mine[0].n;
  const min = mine[mine.length - 1].n;
  return mine.map((w) => ({ word: w.word, n: w.n, weight: max === min ? 1 : (w.n - min) / (max - min) }));
}
