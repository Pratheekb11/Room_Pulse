import { defaultChart } from "./charts";
import { duplicateIndexes, filledItems, type Row } from "./list-edit";
import { PRESETS } from "./presets";
import type { BoardId } from "./boards";
import type { QuestionKind } from "./types";
import { hasOptions, MAX_ABS_NUMBER } from "./validation";

/**
 * The builder's questions as they're being written (components/admin/PresentationForm.tsx), and the pure
 * operations behind the slide editor: add, move, duplicate, remove, and each question's own problems.
 */

export type Kind = QuestionKind;
export type OptionKind = "rating" | "poll" | "multi" | "rank" | "quiz";

export interface QuestionDraft {
  key: number;
  /** Set for questions that are already saved (edit mode). */
  id?: string;
  kind: Kind;
  chart: string;
  name: string;
  items: Row[];
  /** Pick several: most picks (null = any). */
  maxPicks: number | null;
  /** Number questions, as typed. */
  min: string;
  max: string;
  unit: string;
  /** Quiz: the right option's text, and seconds to answer. */
  correct: string;
  seconds: number;
  /** Optional extra words under the question; `null` = the box is closed. */
  description: string | null;
  /** Optional picture shown with the question (an uploaded picture's id). */
  image?: string | null;
  /** Open answers: shown as a board (tree, sticky notes, sky); null = a plain list. */
  board?: BoardId | null;
  /** Boards: how many leaves each person may add; null = the usual 5. */
  maxLeaves?: number | null;
}

export const EXAMPLES: Record<Kind, { name: string; list: string[] }> = {
  rating: { name: "Which project first?", list: ["New website", "Mobile app", "Better onboarding"] },
  poll: { name: "Where should the next offsite be?", list: ["Lisbon", "Kyoto", "Cape Town"] },
  words: { name: "One word for this year?", list: [] },
  multi: { name: "Which perks matter most to you?", list: ["Gym", "Free lunch", "Remote days", "Learning budget"] },
  rank: { name: "Put these goals in order", list: ["Grow revenue", "Hire 5 people", "Launch the app"] },
  number: { name: "How many customers will we have by December?", list: [] },
  text: { name: "What should we do differently next time?", list: [] },
  qa: { name: "What would you like to ask us?", list: [] },
  quiz: { name: "What is the capital of Japan?", list: ["Osaka", "Tokyo", "Kyoto"] },
};

export const LIST_COPY: Record<OptionKind, { label: string; noun: string }> = {
  rating: { label: "Items to score", noun: "item" },
  poll: { label: "Options", noun: "option" },
  multi: { label: "Options", noun: "option" },
  rank: { label: "Options to put in order", noun: "option" },
  quiz: { label: "Answers to choose from", noun: "answer" },
};

export const QUIZ_TIMES = [10, 15, 20, 30, 45, 60, 90, 120];

/** Score items is scored on one thing unless the presenter adds more (two by default made every question a grid). */
export const DEFAULT_CRITERIA: Row[] = [{ name: "Score" }];

/** Questions that need 2 options. */
export const needsTwo = (kind: Kind) => kind === "poll" || kind === "multi" || kind === "rank" || kind === "quiz";
/** Questions with options start with two rows, so it's clear you can list several. */
export const startRows = (kind: Kind): Row[] => (needsTwo(kind) || kind === "rating" ? [{ name: "" }, { name: "" }] : [{ name: "" }]);

export const blank = (key: number, kind: Kind = "rating"): QuestionDraft => ({
  key,
  kind,
  chart: defaultChart(kind),
  name: "",
  items: startRows(kind),
  maxPicks: null,
  min: "0",
  max: "100",
  unit: "",
  correct: "",
  seconds: 20,
  description: null,
  board: null,
});

/** A new question from a one-tap shortcut (e.g. Yes / No / Not sure). */
export function fromPreset(id: string, key: number): QuestionDraft {
  const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
  return { ...blank(key, p.kind), items: p.options.map((name) => ({ name })) };
}

/** A typed number, or null if it isn't one. Commas are allowed as thousands separators. */
export function toNumber(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= MAX_ABS_NUMBER ? n : null;
}

/** What the question list shows for a question. */
export const railLabel = (q: QuestionDraft) => q.name.trim() || "Untitled question";

/** Removes a question and says which one to edit next (the next one, or the one before if it was last). */
export function removeQuestion(list: QuestionDraft[], key: number): { list: QuestionDraft[]; selected: number } {
  if (list.length <= 1) return { list, selected: list[0]?.key ?? key };
  const at = list.findIndex((x) => x.key === key);
  if (at < 0) return { list, selected: list[0].key };
  const next = list.filter((x) => x.key !== key);
  return { list: next, selected: next[Math.min(at, next.length - 1)].key };
}

export function moveQuestion(list: QuestionDraft[], key: number, by: -1 | 1): QuestionDraft[] {
  const at = list.findIndex((x) => x.key === key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** A copy right after the question: unsaved, with its own options (saved ids are never shared). */
export function duplicateQuestion(list: QuestionDraft[], key: number, newKey: number): QuestionDraft[] {
  const at = list.findIndex((x) => x.key === key);
  if (at < 0) return list;
  const src = list[at];
  const copy: QuestionDraft = {
    ...src,
    key: newKey,
    id: undefined,
    name: src.name.trim() ? `${src.name.trim()} (copy)`.slice(0, 120) : "",
    items: src.items.map(({ id: _id, key: _key, ...r }) => {
      void _id;
      void _key;
      return r;
    }),
  };
  return [...list.slice(0, at + 1), copy, ...list.slice(at + 1)];
}

/** Each question's own problems (keyed by question), and every problem in the order to show them. */
export function presentationProblems({
  title,
  questions,
  criteria,
  lowLabel,
  highLabel,
}: {
  title: string;
  questions: QuestionDraft[];
  criteria: Row[];
  lowLabel: string;
  highLabel: string;
}): { all: string[]; byKey: Map<number, string[]> } {
  const all: string[] = [];
  const byKey = new Map<number, string[]>();
  if (!title.trim()) all.push("Give your presentation a name.");
  questions.forEach((f, i) => {
    const mine: string[] = [];
    const topics = hasOptions(f.kind) ? filledItems(f.items) : [];
    const label = f.name.trim() ? `“${f.name.trim()}”` : `question ${i + 1}`;
    if (!f.name.trim()) mine.push(`Write question ${i + 1}.`);
    if (f.kind === "rating" && topics.length === 0) mine.push(`Add at least 1 item to score in ${label}.`);
    if (needsTwo(f.kind) && topics.length < 2) mine.push(`Add at least 2 options to ${label}.`);
    if (hasOptions(f.kind) && duplicateIndexes(f.items).size) mine.push(`${label} has the same ${LIST_COPY[f.kind as OptionKind].noun} twice.`);
    if (f.kind === "quiz" && topics.length >= 2 && !topics.some((t) => t.trim() === f.correct.trim())) mine.push(`Pick the right answer for ${label}.`);
    if (f.kind === "number") {
      const lo = toNumber(f.min);
      const hi = toNumber(f.max);
      if (lo === null || hi === null) mine.push(`Give ${label} a lowest and a highest number.`);
      else if (lo >= hi) mine.push(`In ${label}, the lowest number must be below the highest.`);
    }
    if (mine.length) byKey.set(f.key, mine);
    all.push(...mine);
  });
  const names = questions.map((f) => f.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) all.push("Two questions have the same wording. Change one of them.");
  const hasRating = questions.some((f) => f.kind === "rating");
  if (hasRating && filledItems(criteria).length < 1) all.push("Add at least 1 thing to score on, like Impact.");
  if (hasRating && duplicateIndexes(criteria).size) all.push("“Score each item on” lists the same thing twice.");
  if (hasRating && (!lowLabel.trim() || !highLabel.trim())) all.push("Say what the lowest and highest scores mean.");
  return { all, byKey };
}
