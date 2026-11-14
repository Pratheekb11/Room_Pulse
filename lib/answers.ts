import type { NamedItem, NumberCount, PollCount, PublicQaItem, RankCount, ResultsPayload, WordCount } from "./types";

export interface PollTally {
  total: number;
  rows: { id: string; name: string; n: number; pct: number; index: number; imageId?: string | null }[];
  /** Option with the most votes, or null on a tie / no votes. */
  leader: { id: string; name: string; n: number } | null;
}

/**
 * Counts per option. Percentages are shares of all choices, or, for pick-several questions
 * (pass `people`), shares of the people who answered, so they can add up to more than 100%.
 */
type Option = NamedItem & { imageId?: string | null };

export function pollTally(options: Option[], polls: PollCount[], focusId: string, people?: number): PollTally {
  const counts = new Map(polls.filter((p) => p.focusId === focusId).map((p) => [p.topicId, p.n]));
  const total = options.reduce((s, o) => s + (counts.get(o.id) ?? 0), 0);
  const base = people ?? total;
  const rows = options.map((o, index) => {
    const n = counts.get(o.id) ?? 0;
    return { id: o.id, name: o.name, n, pct: base ? Math.round((n / base) * 100) : 0, index, imageId: o.imageId ?? null };
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

export interface RankTally {
  /** People who ranked the options. */
  people: number;
  /** Best average place first; options nobody ranked go last. */
  rows: {
    id: string;
    name: string;
    imageId?: string | null;
    /** Position in the presenter's list (drives the colour). */
    index: number;
    /** Average place, 1 = first. */
    average: number | null;
    /** 1 when everyone put it first, 0 when everyone put it last. */
    score: number;
    /** How many people put it in each place: places[0] = first. */
    places: number[];
  }[];
}

export function rankTally(options: Option[], ranks: RankCount[], focusId: string): RankTally {
  const k = options.length;
  const mine = ranks.filter((r) => r.focusId === focusId);
  const rows = options.map((o, index) => {
    const places = Array.from({ length: k }, () => 0);
    let n = 0;
    let sum = 0;
    for (const r of mine)
      if (r.topicId === o.id && r.rank >= 1 && r.rank <= k) {
        places[r.rank - 1] += r.n;
        n += r.n;
        sum += r.rank * r.n;
      }
    const average = n ? sum / n : null;
    const score = average === null || k < 2 ? 0 : (k - average) / (k - 1);
    return { id: o.id, name: o.name, imageId: o.imageId ?? null, index, average, score, places };
  });
  const people = Math.max(0, ...rows.map((r) => r.places.reduce((a, b) => a + b, 0)));
  rows.sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity) || a.index - b.index);
  return { people, rows };
}

export interface NumberStats {
  n: number;
  mean: number | null;
  /** Middle value (median). */
  median: number | null;
  low: number | null;
  high: number | null;
  /** Equal-width ranges across the question's range; the last one includes its upper end. */
  bins: { from: number; to: number; n: number }[];
}

export function numberStats(numbers: NumberCount[], focusId: string, min: number, max: number, maxBins = 10): NumberStats {
  const mine = numbers.filter((x) => x.focusId === focusId && x.n > 0).sort((a, b) => a.value - b.value);
  const n = mine.reduce((s, x) => s + x.n, 0);

  // Small whole-number ranges (like 1 to 5) get one bar per number.
  const whole = Number.isInteger(min) && Number.isInteger(max) && max - min + 1 <= maxBins;
  const count = whole ? max - min + 1 : maxBins;
  const width = whole ? 1 : (max - min) / count;
  const bins = Array.from({ length: count }, (_, i) => ({ from: min + i * width, to: whole ? min + i : min + (i + 1) * width, n: 0 }));
  for (const x of mine) {
    const i = whole ? Math.round(x.value) - min : Math.floor((x.value - min) / width);
    bins[Math.max(0, Math.min(count - 1, i))].n += x.n;
  }

  if (n === 0) return { n, mean: null, median: null, low: null, high: null, bins };
  const mean = mine.reduce((s, x) => s + x.value * x.n, 0) / n;
  const at = (pos: number) => {
    let seen = 0;
    for (const x of mine) {
      seen += x.n;
      if (pos < seen) return x.value;
    }
    return mine[mine.length - 1].value;
  };
  const median = n % 2 ? at((n - 1) / 2) : (at(n / 2 - 1) + at(n / 2)) / 2;
  return { n, mean, median, low: mine[0].value, high: mine[mine.length - 1].value, bins };
}

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** "1,234.5"; up to 2 decimals. A dash when there's no value. */
export function formatNumber(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "–" : numberFormat.format(v);
}

/**
 * Audience questions for one Q&A question, in the order the presenter's screen shows them:
 * "top" = most votes first (newer first on a tie), "new" = newest first.
 * Answered ones always go last; hidden ones are left out unless asked for.
 */
export function qaOrder<T extends { focusId: string; votes: number; answered: boolean; at: string; hidden?: boolean }>(
  items: T[],
  focusId: string,
  mode: "top" | "new",
  opts: { includeHidden?: boolean } = {},
): T[] {
  const newer = (a: T, b: T) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
  return items
    .filter((q) => q.focusId === focusId && (opts.includeHidden || !q.hidden))
    .sort((a, b) => Number(a.answered) - Number(b.answered) || (mode === "top" ? b.votes - a.votes : 0) || newer(a, b));
}

/** What a voter's phone remembers about one Q&A question. */
export interface QaLocal {
  /** Questions this voter sent, kept so they show before the (cached) list catches up. */
  asked: { id: string; text: string; at: string }[];
  /** Questions this voter upvoted. */
  voted: string[];
  /** Upvote changes not yet in the server count: the count when the change was made, and +1/-1. */
  adjust: Record<string, { base: number; delta: number }>;
}

const JUST_SENT_MS = 60_000;

/** The list a voter sees: server questions plus their own just-sent ones, their votes counted, most votes first. */
export function qaVoterView(
  server: PublicQaItem[],
  focusId: string,
  local: QaLocal,
  now: number,
): (PublicQaItem & { mine: boolean; voted: boolean })[] {
  const mine = new Set(local.asked.map((q) => q.id));
  const voted = new Set(local.voted);
  const listed = server.filter((q) => q.focusId === focusId);
  const seen = new Set(listed.map((q) => q.id));
  const pending = local.asked
    .filter((q) => !seen.has(q.id) && now - Date.parse(q.at) < JUST_SENT_MS)
    .map((q) => ({ ...q, focusId, votes: 0, answered: false }));
  const items = [...listed, ...pending].map((q) => {
    const adj = local.adjust[q.id];
    // the server count still equals the count when the voter changed their vote: add their change
    const votes = adj && q.votes === adj.base ? Math.max(0, q.votes + adj.delta) : q.votes;
    return { ...q, votes, mine: mine.has(q.id), voted: voted.has(q.id) };
  });
  return qaOrder(items, focusId, "top");
}

/** Open answers to show on the big screen: one question's, hidden ones left out. */
export function visibleTexts<T extends { focusId: string; hidden?: boolean }>(texts: T[], focusId: string): T[] {
  return texts.filter((t) => t.focusId === focusId && !t.hidden);
}

/**
 * Results as voters may see them on their phones: hidden answers and questions left out,
 * and nothing about quizzes (right answers, scores and nicknames stay on the presenter's screen).
 */
export function audienceResults(r: ResultsPayload, quizFocusIds: Set<string>): ResultsPayload {
  return {
    ...r,
    texts: r.texts.filter((t) => !t.hidden),
    questions: r.questions.filter((q) => !q.hidden),
    respondents: r.respondents.filter((x) => !quizFocusIds.has(x.focusId)),
    quizCounts: [],
    quizRevealed: [],
    leaderboard: [],
    quiz: null,
    openPoints: 0,
  };
}
