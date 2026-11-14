// The report: every question's results with a short analysis in plain words, what needs attention,
// the AI summary and the open point list. Built from what the presenter's screen shows (no hidden answers).
import { formatNumber, numberStats, pollTally, qaOrder, rankTally, visibleTexts, wordWeights } from "./answers";
import { groupByFocus, type FocusGroup } from "./focus";
import { takeaways } from "./insights";
import { kindLabel } from "./kinds";
import { rateItems } from "./rank-items";
import { resultSignals } from "./signals";
import { avg, cellKey, indexCells, topicHistograms } from "./stats";
import type { AiReport, LeaderRow, OpenPoint, QuestionKind, ResultsPayload, SessionPayload } from "./types";

export interface ReportRow {
  name: string;
  imageId?: string | null;
  description?: string | null;
  /** The headline number, ready to print: "75%", "4.5", "6 people". */
  value: string;
  /** Smaller words after it: "3 votes". */
  detail?: string;
  /** Bar length, 0 to 100; null = no bar. */
  pct: number | null;
  /** "Best", "Lowest", "Top answer", "Right answer". */
  tag?: string;
}

export interface ReportSection {
  focusId: string;
  /** 1 = the first question. */
  index: number;
  name: string;
  kind: QuestionKind;
  kindLabel: string;
  description: string | null;
  imageId: string | null;
  /** People who answered this question; null when it can't be told (word clouds). */
  people: number | null;
  /** That, as a percentage of everyone who took part. */
  share: number | null;
  /** The analysis: what the numbers say, most important first. */
  highlights: string[];
  rows: ReportRow[];
  /** What people wrote: open answers, or audience questions. */
  texts: string[];
  /** A footnote, e.g. about hidden answers. */
  note: string | null;
  /** The AI's insight for this question, when a summary was made. */
  insight: string | null;
}

export interface Report {
  title: string;
  code: string;
  people: number;
  isOpen: boolean;
  /** The whole presentation in a few lines. */
  findings: string[];
  /** Results that call for a follow-up (lib/signals.ts). */
  attention: { title: string; reason: string }[];
  sections: ReportSection[];
  /** Quiz: the top players. */
  leaderboard: LeaderRow[];
  ai: Pick<AiReport, "headline" | "summary" | "actions" | "people" | "at"> | null;
  points: OpenPoint[];
  /** ISO time the report was made (set by the server). */
  generatedAt?: string;
}

const andList = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const f1 = (v: number) => v.toFixed(1);

type Built = Pick<ReportSection, "people" | "highlights" | "rows" | "texts" | "note"> & { answered: boolean };
const NOTHING = "No answers yet.";

function build(g: FocusGroup, info: SessionPayload, r: ResultsPayload, cells: ReturnType<typeof indexCells>, histograms: Map<string, number[]>): Built {
  const id = g.focus.id;
  const options = g.topics.map((t) => t.item);
  const respondents = r.respondents.find((x) => x.focusId === id)?.n ?? 0;
  const empty: Built = { people: 0, highlights: [NOTHING], rows: [], texts: [], note: null, answered: false };

  switch (g.kind) {
    case "rating": {
      const scaleMax = info.session.scaleMax;
      const criteria = info.criteria;
      const measures = Math.max(1, criteria.length);
      const rated = rateItems(g.topics, criteria, cells, histograms, scaleMax);
      const sorted = [...rated].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.index - b.index);
      const scored = sorted.filter((x) => x.value !== null);
      const hi = scored[0]?.value ?? null;
      const lo = scored[scored.length - 1]?.value ?? null;
      const tiedTop = scored.filter((x) => x.value === hi).length > 1;
      const rows: ReportRow[] = sorted.map((x) => {
        const per = criteria.map((c) => ({ name: c.name, v: avg(cells.get(cellKey(x.item.id, c.id))) }));
        const answers = count(Math.round(x.n / measures), "answer");
        const row: ReportRow = {
          name: x.item.name,
          imageId: x.item.imageId ?? null,
          description: x.item.description ?? null,
          value: x.value === null ? "–" : f1(x.value),
          detail: criteria.length > 1 ? `${per.map((p) => `${p.name} ${p.v === null ? "–" : f1(p.v)}`).join(" · ")} · ${answers}` : answers,
          pct: x.value === null ? 0 : Math.round((x.value / scaleMax) * 100),
        };
        if (x.value !== null && hi !== null && lo !== null && lo < hi) {
          if (x.value === hi) row.tag = tiedTop ? "Tied for best" : "Best";
          else if (x.value === lo) row.tag = "Lowest";
        }
        return row;
      });
      const highlights = takeaways(
        rated.map((x) => ({
          name: x.item.name,
          overall: x.value,
          perCriterion: criteria.map((c) => avg(cells.get(cellKey(x.item.id, c.id)))),
          agreement: x.agree,
        })),
        criteria.map((c) => c.name),
        scaleMax,
      );
      const answered = scored.length > 0;
      return { people: respondents, highlights: answered ? highlights : [NOTHING], rows, texts: [], note: `Scores are from 1 (${info.session.lowLabel}) to ${scaleMax} (${info.session.highLabel}).`, answered };
    }

    case "poll":
    case "multi": {
      const multi = g.kind === "multi";
      const tally = pollTally(options, r.polls, id, multi ? respondents : undefined);
      const people = multi ? respondents : tally.total;
      if (!tally.total) return { ...empty, rows: tally.rows.map((x) => ({ name: x.name, imageId: x.imageId ?? null, value: "0%", detail: multi ? "0 picks" : "0 votes", pct: 0 })) };
      const sorted = [...tally.rows].sort((a, b) => b.n - a.n || a.index - b.index);
      const top = sorted.filter((x) => x.n === sorted[0].n);
      const rows = sorted.map((x): ReportRow => ({
        name: x.name,
        imageId: x.imageId ?? null,
        value: `${x.pct}%`,
        detail: multi ? count(x.n, "pick") : count(x.n, "vote"),
        pct: Math.min(100, x.pct),
        ...(top.length === 1 && x.id === top[0].id ? { tag: multi ? "Most picked" : "Top answer" } : {}),
      }));
      const names = andList(top.map((x) => x.name));
      const highlights = multi
        ? [top.length === 1 ? `${names} was picked most: by ${top[0].pct}% of the ${count(people, "person", "people")} who answered.` : `${names} were picked most (${top[0].pct}% each).`]
        : [top.length === 1 ? `${names} is the top answer with ${top[0].pct}% (${top[0].n} of ${count(tally.total, "vote")}).` : `${names} are tied at ${top[0].pct}% each.`];
      return { people, highlights, rows, texts: [], note: multi ? "Each person could pick several, so the shares can add up to more than 100%." : null, answered: true };
    }

    case "rank": {
      const tally = rankTally(options, r.ranks, id);
      const ranked = tally.rows.filter((x) => x.average !== null);
      const rows = tally.rows.map((x, i): ReportRow => ({
        name: x.name,
        imageId: x.imageId ?? null,
        value: x.average === null ? "–" : f1(x.average),
        detail: "average place",
        pct: x.average === null ? 0 : Math.max(4, Math.round(x.score * 100)),
        ...(i === 0 && x.average !== null ? { tag: "First" } : {}),
      }));
      if (!ranked.length) return { ...empty, rows };
      const first = ranked[0];
      const last = ranked[ranked.length - 1];
      const highlights = [`${first.name} comes first, with an average place of ${f1(first.average!)}.`];
      if (last !== first) highlights.push(`${last.name} comes last (${f1(last.average!)}).`);
      return { people: tally.people, highlights, rows, texts: [], note: "1 is the best place. A lower average place means people put it higher.", answered: true };
    }

    case "number": {
      const s = numberStats(r.numbers, id, g.min ?? 0, g.max ?? 100);
      if (!s.n) return empty;
      const unit = (v: number | null) => `${formatNumber(v)}${g.unit ? ` ${g.unit}` : ""}`;
      return {
        people: s.n,
        highlights: [`The average is ${unit(s.mean)} and the middle value is ${unit(s.median)}.`, `Answers run from ${formatNumber(s.low)} to ${formatNumber(s.high)}.`],
        rows: [
          { name: "Average", value: unit(s.mean), pct: null },
          { name: "Middle value", value: unit(s.median), pct: null },
          { name: "Lowest", value: unit(s.low), pct: null },
          { name: "Highest", value: unit(s.high), pct: null },
        ],
        texts: [],
        note: null,
        answered: true,
      };
    }

    case "words": {
      const words = wordWeights(r.words, id);
      if (!words.length) return { ...empty, people: null };
      const max = words[0].n;
      return {
        people: null,
        highlights: [`Most said: ${andList(words.slice(0, 3).map((w) => `${w.word} (${w.n})`))}.`],
        rows: words.slice(0, 30).map((w) => ({ name: w.word, value: String(w.n), pct: Math.round((w.n / max) * 100) })),
        texts: [],
        note: words.length > 30 ? `The 30 most said of ${words.length} words.` : null,
        answered: true,
      };
    }

    case "text": {
      const mine = r.texts.filter((t) => t.focusId === id);
      const shown = visibleTexts(r.texts, id);
      const hidden = mine.length - shown.length;
      const note = hidden ? `${count(hidden, "answer")} hidden by the presenter ${hidden === 1 ? "is" : "are"} left out.` : null;
      if (!shown.length) return { ...empty, people: respondents, note };
      return { people: respondents, highlights: [`${count(shown.length, "answer")}.`], rows: [], texts: shown.map((t) => t.text), note, answered: true };
    }

    case "qa": {
      const shown = qaOrder(r.questions, id, "top");
      if (!shown.length) return { ...empty, people: respondents };
      const done = shown.filter((q) => q.answered).length;
      const open = shown.find((q) => !q.answered);
      const highlights = [`${count(shown.length, "question")}, ${done === 0 ? "none" : done === shown.length ? "all" : done} answered${done === 0 ? " yet" : ""}.`];
      if (open && open.votes > 0) highlights.push(`Most upvoted and still open: “${open.text}” (${count(open.votes, "upvote")}).`);
      return {
        people: respondents,
        highlights,
        rows: [],
        texts: shown.map((q) => `${q.answered ? "✓ Answered: " : ""}${q.text} (${count(q.votes, "upvote")})`),
        note: null,
        answered: true,
      };
    }

    case "quiz": {
      const right = r.quizRevealed.find((x) => x.focusId === id)?.topicId ?? null;
      const counts = new Map(r.quizCounts.filter((c) => c.focusId === id).map((c) => [c.topicId, c.n]));
      const total = options.reduce((n, o) => n + (counts.get(o.id) ?? 0), 0);
      const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
      const rows = options.map((o): ReportRow => {
        const n = counts.get(o.id) ?? 0;
        return { name: o.name, imageId: o.imageId ?? null, value: `${pct(n)}%`, detail: count(n, "answer"), pct: pct(n), ...(o.id === right ? { tag: "Right answer" } : {}) };
      });
      if (!total || !right) return { ...empty, highlights: ["Not played yet."], rows };
      const got = counts.get(right) ?? 0;
      const name = options.find((o) => o.id === right)?.name ?? "";
      return { people: total, highlights: [`${pct(got)}% got it right (${got} of ${total}). The right answer is ${name}.`], rows, texts: [], note: null, answered: true };
    }
  }
}

export function buildReport(info: SessionPayload, r: ResultsPayload, extra: { points?: OpenPoint[]; ai?: AiReport | null } = {}): Report {
  const cells = indexCells(r.cells);
  const histograms = topicHistograms(r.dist, info.session.scaleMax);
  const groups = groupByFocus(info.focusTopics, info.topics).filter((g) => g.focus.id);
  const people = r.voterCount;
  const ai = extra.ai ?? null;

  const answered: boolean[] = [];
  const sections = groups.map((g, i): ReportSection => {
    const b = build(g, info, r, cells, histograms);
    answered.push(b.answered);
    return {
      focusId: g.focus.id,
      index: i + 1,
      name: g.focus.name,
      kind: g.kind,
      kindLabel: kindLabel(g.kind),
      description: g.focus.description,
      imageId: g.focus.imageId ?? null,
      people: b.people,
      share: b.people !== null && people > 0 ? Math.min(100, Math.round((b.people / people) * 100)) : null,
      highlights: b.highlights,
      rows: b.rows,
      texts: b.texts,
      note: b.note,
      insight: ai?.questions.find((q) => q.focusId === g.focus.id)?.insight ?? null,
    };
  });

  const findings = [`${count(people, "person", "people")} took part in ${count(sections.length, "question")}.`];
  sections.forEach((s, i) => {
    if (answered[i]) findings.push(`${s.name}: ${s.highlights[0]}`);
  });
  // a question far fewer people answered than the rest
  const thin = sections
    .filter((s, i) => answered[i] && s.people !== null && s.share !== null && s.share < 60)
    .sort((a, b) => a.share! - b.share!)[0];
  if (thin) findings.push(`Fewest answers: “${thin.name}” (${thin.people} of ${count(people, "person", "people")}).`);
  sections.forEach((s, i) => {
    if (!answered[i]) findings.push(`Nobody answered “${s.name}”.`);
  });

  return {
    title: info.session.title,
    code: info.session.code,
    people,
    isOpen: r.isOpen,
    findings,
    attention: resultSignals(groups, info.criteria, cells, histograms, r, info.session.scaleMax).map((s) => ({ title: s.title, reason: s.reason })),
    sections,
    leaderboard: r.leaderboard,
    ai: ai ? { headline: ai.headline, summary: ai.summary, actions: ai.actions, people: ai.people, at: ai.at } : null,
    points: extra.points ?? [],
  };
}
