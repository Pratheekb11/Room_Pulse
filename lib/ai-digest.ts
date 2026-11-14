// What the AI is given to summarise a whole presentation: each question's results in numbers,
// plus the words people typed. Only what's on the presenter's screen: no hidden answers or
// hidden audience questions, no quiz nicknames, no voter ids.
import { numberStats, pollTally, qaOrder, rankTally, visibleTexts, wordWeights } from "./answers";
import { groupByFocus } from "./focus";
import { rateItems } from "./rank-items";
import { indexCells, topicHistograms } from "./stats";
import type { QuestionKind, ResultsPayload, SessionPayload } from "./types";

export const DIGEST_TYPES: Record<QuestionKind, string> = {
  rating: "score items",
  poll: "pick one",
  multi: "pick several",
  rank: "put in order",
  number: "number",
  text: "open answer",
  qa: "audience questions",
  words: "word cloud",
  quiz: "quiz",
};

export interface DigestQuestion {
  /** 1 = the first question. The AI's insights name questions by this. */
  index: number;
  focusId: string;
  question: string;
  type: string;
  results: Record<string, unknown>;
}

export interface Digest {
  title: string;
  /** People who answered anything. */
  people: number;
  questions: DigestQuestion[];
}

const MAX_TEXTS = 60;
const MAX_QUESTIONS = 40;
const MAX_WORDS = 20;
const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

export function buildDigest(info: SessionPayload, r: ResultsPayload): Digest {
  const cells = indexCells(r.cells);
  const histograms = topicHistograms(r.dist, info.session.scaleMax);
  const measures = Math.max(1, info.criteria.length);
  const questions = groupByFocus(info.focusTopics, info.topics)
    .filter((g) => g.focus.id)
    .map((g, i): DigestQuestion => {
      const id = g.focus.id;
      const options = g.topics.map((t) => t.item);
      let results: Record<string, unknown>;
      switch (g.kind) {
        case "rating":
          results = {
            scale: `1 to ${info.session.scaleMax}`,
            ...(info.criteria.length > 1 ? { scoredOn: info.criteria.map((c) => c.name) } : {}),
            items: rateItems(g.topics, info.criteria, cells, histograms, info.session.scaleMax).map((x) => ({
              item: x.item.name,
              average: round1(x.value),
              answers: Math.round(x.n / measures),
              ...(x.agree ? { agreement: x.agree.toLowerCase() } : {}),
            })),
          };
          break;
        case "poll":
          results = { options: pollTally(options, r.polls, id).rows.map((x) => ({ option: x.name, votes: x.n, percent: x.pct })) };
          break;
        case "multi": {
          const people = r.respondents.find((x) => x.focusId === id)?.n ?? 0;
          results = { people, options: pollTally(options, r.polls, id, people).rows.map((x) => ({ option: x.name, picks: x.n, percent: x.pct })) };
          break;
        }
        case "rank": {
          const tally = rankTally(options, r.ranks, id);
          results = { people: tally.people, options: tally.rows.map((x) => ({ option: x.name, averagePlace: round1(x.average) })) };
          break;
        }
        case "number": {
          const s = numberStats(r.numbers, id, g.min ?? 0, g.max ?? 100);
          results = { answers: s.n, average: round2(s.mean), middle: round2(s.median), lowest: s.low, highest: s.high, ...(g.unit ? { unit: g.unit } : {}) };
          break;
        }
        case "words":
          results = { words: wordWeights(r.words, id).slice(0, MAX_WORDS).map((w) => ({ word: w.word, count: w.n })) };
          break;
        case "text":
          results = { answers: visibleTexts(r.texts, id).slice(0, MAX_TEXTS).map((t) => t.text) };
          break;
        case "qa":
          results = {
            questions: qaOrder(r.questions, id, "top")
              .slice(0, MAX_QUESTIONS)
              .map((q) => ({ question: q.text, upvotes: q.votes, answered: q.answered })),
          };
          break;
        case "quiz": {
          const right = r.quizRevealed.find((x) => x.focusId === id)?.topicId;
          const counts = new Map(r.quizCounts.filter((c) => c.focusId === id).map((c) => [c.topicId, c.n]));
          results = {
            answers: options.reduce((n, o) => n + (counts.get(o.id) ?? 0), 0),
            options: options.map((o) => ({ option: o.name, picked: counts.get(o.id) ?? 0, ...(o.id === right ? { right: true } : {}) })),
          };
          break;
        }
      }
      return { index: i + 1, focusId: id, question: g.focus.name, type: DIGEST_TYPES[g.kind], results };
    });
  return { title: info.session.title, people: r.voterCount, questions };
}
