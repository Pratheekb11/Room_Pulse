// Signals: results that call for a follow-up, offered to the presenter as ready-made open points.
import type { Agg } from "./stats";
import type { FocusGroup } from "./focus";
import { rateItems } from "./rank-items";
import type { NamedItem, ResultsPayload } from "./types";

export interface Signal {
  /** Names the result it came from (stored as the point's originKey, so it's offered once). */
  key: string;
  focusId: string;
  /** Ready to use as the open point's text. */
  title: string;
  /** Why it's flagged, in plain words. */
  reason: string;
}

/** An item is "low" in the bottom 40% of the scale: 2.6 or less on 1 to 5, 4.6 or less on 1 to 10. */
const LOW = 0.4;
const MAX_QA = 3;
const MAX_SIGNALS = 8;

const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * What the presenter may want to act on: items scored low, items people disagree about,
 * and audience questions with upvotes that nobody has answered. Lowest scores first.
 */
export function resultSignals(
  groups: FocusGroup[],
  criteria: NamedItem[],
  cells: Map<string, Agg>,
  histograms: Map<string, number[]>,
  results: Pick<ResultsPayload, "questions">,
  scaleMax: number,
): Signal[] {
  const low: (Signal & { value: number })[] = [];
  const split: Signal[] = [];
  const qa: (Signal & { votes: number })[] = [];
  const measures = Math.max(1, criteria.length);

  for (const g of groups) {
    if (g.kind === "rating" && g.focus.id) {
      for (const r of rateItems(g.topics, criteria, cells, histograms, scaleMax)) {
        if (r.value === null) continue;
        const people = Math.round(r.n / measures);
        if (people >= 2 && (r.value - 1) / Math.max(1, scaleMax - 1) <= LOW)
          low.push({
            key: `low:${r.item.id}`,
            focusId: g.focus.id,
            title: cut(`Low score: ${r.item.name}`, 200),
            reason: `Scored ${r.value.toFixed(1)} out of ${scaleMax} in “${g.focus.name}” (${people} answers).`,
            value: r.value,
          });
        else if (people >= 3 && r.agree === "People disagree")
          split.push({
            key: `split:${r.item.id}`,
            focusId: g.focus.id,
            title: cut(`People disagree about ${r.item.name}`, 200),
            reason: `Scores in “${g.focus.name}” are far apart (average ${r.value.toFixed(1)} out of ${scaleMax}). Worth talking through.`,
          });
      }
    } else if (g.kind === "qa") {
      for (const q of results.questions ?? []) {
        if (q.focusId !== g.focus.id || q.hidden || q.answered || q.votes < 2) continue;
        qa.push({
          key: `qa:${q.id}`,
          focusId: g.focus.id,
          title: cut(`Unanswered: ${q.text}`, 200),
          reason: `${q.votes} people upvoted this question and it isn't marked answered.`,
          votes: q.votes,
        });
      }
    }
  }
  low.sort((a, b) => a.value - b.value);
  qa.sort((a, b) => b.votes - a.votes);
  return [...low, ...split, ...qa.slice(0, MAX_QA)].slice(0, MAX_SIGNALS).map(({ key, focusId, title, reason }) => ({ key, focusId, title, reason }));
}
