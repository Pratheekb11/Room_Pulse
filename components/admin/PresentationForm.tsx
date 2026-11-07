"use client";

import { useEffect, useRef, useState } from "react";
import { CHARTS, defaultChart } from "@/lib/charts";
import { topicColor } from "@/lib/colors";
import {
  hasOptions,
  MAX_ABS_NUMBER,
  MAX_CRITERIA,
  MAX_FOCUS_TOPICS,
  MAX_TOPICS_PER_FOCUS,
} from "@/lib/validation";
import { KIND_INFO } from "@/lib/kinds";
import { PRESETS, matchingPreset } from "@/lib/presets";
import { TEMPLATES, type PresentationPlan } from "@/lib/templates";
import {
  duplicateIndexes,
  filledItems,
  filledRows,
  rowsFrom,
  type Row,
} from "@/lib/list-edit";
import type { QuestionKind, SessionPayload } from "@/lib/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { ListEditor } from "./ListEditor";
import { ThemePicker } from "./ThemePicker";
import { PresentationPreview } from "./PresentationPreview";
import { isThemeId, recommendTheme, type ThemeId } from "@/lib/themes";
import { previewQuestions } from "@/lib/preview";

type Call = (path: string, init?: RequestInit) => Promise<Response>;
type Kind = QuestionKind;
type OptionKind = "rating" | "poll" | "multi" | "rank" | "quiz";

interface QuestionDraft {
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
}

export type FormMode =
  | { kind: "create" }
  | {
      kind: "edit";
      code: string;
      session: SessionPayload;
      counts: Record<string, number>;
      scaleLocked: boolean;
    };

const KINDS = KIND_INFO;

const EXAMPLES: Record<Kind, { name: string; list: string[] }> = {
  rating: {
    name: "Which project first?",
    list: ["New website", "Mobile app", "Better onboarding"],
  },
  poll: {
    name: "Where should the next offsite be?",
    list: ["Lisbon", "Kyoto", "Cape Town"],
  },
  words: { name: "One word for this year?", list: [] },
  multi: {
    name: "Which perks matter most to you?",
    list: ["Gym", "Free lunch", "Remote days", "Learning budget"],
  },
  rank: {
    name: "Put these goals in order",
    list: ["Grow revenue", "Hire 5 people", "Launch the app"],
  },
  number: { name: "How many customers will we have by December?", list: [] },
  text: { name: "What should we do differently next time?", list: [] },
  qa: { name: "What would you like to ask us?", list: [] },
  quiz: { name: "What is the capital of Japan?", list: ["Osaka", "Tokyo", "Kyoto"] },
};

const LIST_COPY: Record<OptionKind, { label: string; noun: string }> = {
  rating: { label: "Items to score", noun: "item" },
  poll: { label: "Options", noun: "option" },
  multi: { label: "Options", noun: "option" },
  rank: { label: "Options to put in order", noun: "option" },
  quiz: { label: "Answers to choose from", noun: "answer" },
};

const QUIZ_TIMES = [10, 15, 20, 30, 45, 60, 90, 120];

/** Questions that need 2 options start with two rows; scored questions with one. */
const needsTwo = (kind: Kind) => kind === "poll" || kind === "multi" || kind === "rank" || kind === "quiz";
const startRows = (kind: Kind): Row[] =>
  needsTwo(kind) ? [{ name: "" }, { name: "" }] : [{ name: "" }];
const blank = (key: number, kind: Kind = "rating"): QuestionDraft => ({
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
});

/** Builder questions for a template or AI-drafted plan. */
function draftsFromPlan(plan: PresentationPlan, firstKey: number): QuestionDraft[] {
  return plan.questions.map((q, i) => {
    const d = blank(firstKey + i, q.kind);
    const options = (q.options ?? []).map((name) => ({ name }));
    return {
      ...d,
      name: q.name,
      items: hasOptions(q.kind) && options.length ? options : d.items,
      min: q.kind === "number" ? String(q.min ?? 0) : d.min,
      max: q.kind === "number" ? String(q.max ?? 100) : d.max,
      unit: q.kind === "number" ? (q.unit ?? "") : d.unit,
      correct: q.kind === "quiz" ? (q.options?.[0] ?? "") : d.correct,
    };
  });
}

/** A typed number, or null if it isn't one. Commas are allowed as thousands separators. */
function toNumber(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= MAX_ABS_NUMBER ? n : null;
}
const field =
  "mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2";
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

// Unsaved new presentation survives a refresh (sessionStorage: kept for this browser session only,
// so it isn't left behind on a shared computer).
const DRAFT_KEY = "liverate:draft";

interface Draft {
  title: string;
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  focus: QuestionDraft[];
  criteria: Row[];
  /** Slide design picked by hand; null = use the recommended one. */
  theme: ThemeId | null;
  /** Fun illustrations on. */
  decor: boolean;
  /** How it was started (template or AI draft), so the way back survives a refresh. */
  start?: StartChoice;
}

type StartChoice = null | "blank" | { label: string; snapshot: string };

/** Older drafts kept lists as one-per-line text (topicsText / criteriaText) or plain strings. */
type StoredDraft = Omit<Draft, "focus" | "criteria"> & {
  focus: (Omit<QuestionDraft, "items"> & {
    items?: (Row | string)[];
    topicsText?: string;
  })[];
  criteria?: (Row | string)[];
  criteriaText?: string;
};

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    const d = raw ? (JSON.parse(raw) as StoredDraft) : null;
    if (!d || !Array.isArray(d.focus) || !d.focus.length) return null;
    // a draft is never a saved presentation, so it carries no ids
    const plain = (list: (Row | string)[] | string | undefined) =>
      rowsFrom(list).map((r) => ({ name: r.name }));
    return {
      ...d,
      focus: d.focus.map(({ topicsText, items, ...f }) => ({
        ...blank(f.key, f.kind),
        ...f,
        id: undefined,
        items: plain(items ?? topicsText),
      })),
      criteria: plain(d.criteria ?? d.criteriaText),
      theme: isThemeId(d.theme) ? d.theme : null,
      decor: d.decor !== false,
      start: d.start ?? null,
    };
  } catch {
    return null;
  }
}

function fromSession(s: SessionPayload): Draft {
  return {
    title: s.session.title,
    scaleMax: s.session.scaleMax,
    lowLabel: s.session.lowLabel,
    highLabel: s.session.highLabel,
    focus: s.focusTopics.map((f, i) => ({
      key: i,
      id: f.id,
      kind: f.kind,
      chart: f.chart,
      name: f.name,
      items: hasOptions(f.kind)
        ? rowsFrom(s.topics.filter((t) => t.focusId === f.id))
        : [{ name: "" }],
      maxPicks: f.maxPicks ?? null,
      min: String(f.min ?? 0),
      max: String(f.max ?? 100),
      unit: f.unit ?? "",
      correct:
        f.kind === "quiz" && typeof f.correct === "number"
          ? (s.topics.filter((t) => t.focusId === f.id)[f.correct]?.name ?? "")
          : "",
      seconds: f.seconds ?? 20,
    })),
    criteria: rowsFrom(s.criteria),
    theme: isThemeId(s.session.theme) ? s.session.theme : "paper",
    decor: s.session.decor !== false,
  };
}

const DEFAULT_CRITERIA: Row[] = [{ name: "Impact" }, { name: "Effort" }];

export function PresentationForm({
  call,
  mode,
  onDone,
  onCancel,
  locked = false,
  guest = false,
  aiAvailable = false,
  onNeedAccount,
}: {
  call: Call;
  mode: FormMode;
  onDone: (code: string) => Promise<void> | void;
  onCancel?: () => void;
  locked?: boolean;
  /** Guests can't use AI: opening "Write questions with AI" asks them to save their account. */
  guest?: boolean;
  /** The site has a Gemini key; without one the AI box doesn't show. */
  aiAvailable?: boolean;
  onNeedAccount?: () => void;
}) {
  const editing = mode.kind === "edit";
  // Rendered only in the browser (after the sign-in check), so reading storage here is safe.
  const [initial] = useState(() =>
    mode.kind === "edit" ? fromSession(mode.session) : readDraft(),
  );
  const nextKey = useRef(
    initial ? Math.max(0, ...initial.focus.map((f) => f.key)) + 1 : 1,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [scaleMax, setScaleMax] = useState(initial?.scaleMax ?? 5);
  const [lowLabel, setLowLabel] = useState(initial?.lowLabel ?? "Low");
  const [highLabel, setHighLabel] = useState(initial?.highLabel ?? "High");
  const [focus, setFocus] = useState<QuestionDraft[]>(
    initial?.focus ?? [blank(0)],
  );
  const [criteriaRows, setCriteriaRows] = useState<Row[]>(
    initial?.criteria ?? DEFAULT_CRITERIA,
  );
  const [themeChoice, setThemeChoice] = useState<ThemeId | null>(initial?.theme ?? null);
  const [decor, setDecor] = useState(initial?.decor ?? true);
  /**
   * How this presentation was started: null while choosing, "blank", or the template / AI draft used
   * (with a snapshot, so going back can tell whether anything was changed since).
   */
  const [start, setStart] = useState<StartChoice>(initial?.start ?? null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const counts = mode.kind === "edit" ? mode.counts : {};
  const scaleLocked = mode.kind === "edit" && mode.scaleLocked;

  useEffect(() => {
    if (editing) return;
    try {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          title,
          scaleMax,
          lowLabel,
          highLabel,
          focus,
          criteria: criteriaRows,
          theme: themeChoice,
          decor,
          start,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [editing, title, scaleMax, lowLabel, highLabel, focus, criteriaRows, themeChoice, decor, start]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  // The problem list and save errors sit at the bottom of a long form, under the sticky Create
  // button: on a phone, a failed tap would otherwise look like nothing happened.
  const [failedTries, setFailedTries] = useState(0);
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!failedTries) return;
    const el = feedbackRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, [failedTries]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [confirmLoss, setConfirmLoss] = useState<string | null>(null);

  const parsed = focus.map((f) => ({
    ...f,
    topics: hasOptions(f.kind) ? filledItems(f.items) : [],
  }));
  /** Settings sent to the server for each type (null where they don't apply). */
  const settings = (f: QuestionDraft) => ({
    maxPicks: f.kind === "multi" ? f.maxPicks : null,
    min: f.kind === "number" ? toNumber(f.min) : null,
    max: f.kind === "number" ? toNumber(f.max) : null,
    unit: f.kind === "number" && f.unit.trim() ? f.unit.trim() : null,
    correct: f.kind === "quiz" && f.correct.trim() ? f.correct.trim() : null,
    seconds: f.kind === "quiz" ? f.seconds : null,
  });
  const hasRating = parsed.some((f) => f.kind === "rating");
  const criteria = hasRating ? filledItems(criteriaRows) : [];
  const scoreCount =
    parsed
      .filter((f) => f.kind === "rating")
      .reduce((n, f) => n + f.topics.length, 0) * criteria.length;
  const otherQuestions = parsed.filter((f) => f.kind !== "rating").length;

  const recommended = recommendTheme({ title, kinds: focus.map((f) => f.kind) });
  /** The design that will be saved: the presenter's pick, or the recommendation. */
  const theme: ThemeId = themeChoice ?? recommended.id;
  const preview = () =>
    previewQuestions(
      focus.map((f) => ({
        kind: f.kind,
        name: f.name,
        options: f.items.map((it) => it.name),
        min: toNumber(f.min) ?? 0,
        max: toNumber(f.max) ?? 100,
        unit: f.unit.trim() || null,
        maxPicks: f.maxPicks,
      })),
    );

  const problems: string[] = [];
  if (!title.trim()) problems.push("Give your presentation a name.");
  parsed.forEach((f, i) => {
    const label = f.name.trim() ? `“${f.name.trim()}”` : `question ${i + 1}`;
    if (!f.name.trim()) problems.push(`Write question ${i + 1}.`);
    if (f.kind === "rating" && f.topics.length === 0)
      problems.push(`Add at least 1 item to score in ${label}.`);
    if (needsTwo(f.kind) && f.topics.length < 2)
      problems.push(`Add at least 2 options to ${label}.`);
    if (hasOptions(f.kind) && duplicateIndexes(f.items).size)
      problems.push(
        `${label} has the same ${LIST_COPY[f.kind as OptionKind].noun} twice.`,
      );
    if (f.kind === "quiz" && f.topics.length >= 2 && !f.topics.some((t) => t.trim() === f.correct.trim()))
      problems.push(`Pick the right answer for ${label}.`);
    if (f.kind === "number") {
      const lo = toNumber(f.min);
      const hi = toNumber(f.max);
      if (lo === null || hi === null)
        problems.push(`Give ${label} a lowest and a highest number.`);
      else if (lo >= hi)
        problems.push(
          `In ${label}, the lowest number must be below the highest.`,
        );
    }
  });
  const names = parsed.map((f) => f.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length)
    problems.push("Two questions have the same wording. Change one of them.");
  if (hasRating && criteria.length < 1)
    problems.push("Add at least 1 thing to score on, like Impact.");
  if (hasRating && duplicateIndexes(criteriaRows).size)
    problems.push("“Score each item on” lists the same thing twice.");
  if (hasRating && (!lowLabel.trim() || !highLabel.trim()))
    problems.push("Say what the lowest and highest scores mean.");

  /** Nothing typed yet, so a template can fill the form without losing anything. */
  const pristine =
    !editing &&
    !title.trim() &&
    focus.every((f) => !f.name.trim() && f.items.every((it) => !it.name.trim()));
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Keys differ between renders of the same questions, so leave them out of the comparison.
  const snapshotOf = (t: string, f: QuestionDraft[]) => JSON.stringify([t, f.map((q) => ({ ...q, key: 0 }))]);
  function applyPlan(plan: PresentationPlan, label: string) {
    const drafts = draftsFromPlan(plan, nextKey.current);
    setTitle(plan.title);
    setFocus(drafts);
    nextKey.current += plan.questions.length;
    setStart({ label, snapshot: snapshotOf(plan.title, drafts) });
  }
  /** Back to the start choices with an empty form. */
  function restart() {
    setTitle("");
    setFocus([blank(nextKey.current++)]);
    setCriteriaRows(DEFAULT_CRITERIA);
    setThemeChoice(null);
    setStart(null);
    setConfirmRestart(false);
  }
  const changedSinceStart = start !== null && start !== "blank" && snapshotOf(title, focus) !== start.snapshot;

  // "Write questions with AI": closed until asked for, so nothing changes for people who don't want it.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  async function draftWithAi(e?: React.FormEvent) {
    e?.preventDefault();
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await call("/api/admin/ai/questions", { method: "POST", body: JSON.stringify({ prompt: aiPrompt }) });
      const { plan } = (await res.json()) as { plan: PresentationPlan };
      applyPlan(plan, "questions written by AI");
      setAiOpen(false);
    } catch (err) {
      setAiError((err as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  const update = (key: number, patch: Partial<QuestionDraft>) =>
    setFocus((list) =>
      list.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    );

  /** Saved items this edit removes that already have answers. */
  function answersLost(): { names: string[]; total: number } {
    if (mode.kind !== "edit") return { names: [], total: 0 };
    const s = mode.session;
    const keptQuestions = new Set(focus.map((f) => f.id).filter(Boolean));
    const keptItems = new Set(
      focus
        .flatMap((f) =>
          hasOptions(f.kind) ? filledRows(f.items).map((r) => r.id) : [],
        )
        .filter(Boolean),
    );
    const keptCriteria = new Set(
      hasRating ? filledRows(criteriaRows).map((r) => r.id) : [],
    );
    const lost: { name: string; n: number }[] = [];
    for (const f of s.focusTopics) {
      if (!keptQuestions.has(f.id)) {
        lost.push({ name: `“${f.name}”`, n: counts[f.id] ?? 0 });
        continue;
      }
      for (const t of s.topics.filter((t) => t.focusId === f.id))
        if (!keptItems.has(t.id))
          lost.push({ name: `“${t.name}”`, n: counts[t.id] ?? 0 });
    }
    for (const c of s.criteria)
      if (!keptCriteria.has(c.id))
        lost.push({ name: `“${c.name}”`, n: counts[c.id] ?? 0 });
    const withAnswers = lost.filter((l) => l.n > 0);
    return {
      names: withAnswers.map((l) => l.name),
      total: withAnswers.reduce((t, l) => t + l.n, 0),
    };
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === "edit") {
        await call(`/api/admin/sessions/${mode.code}`, {
          method: "PUT",
          body: JSON.stringify({
            title,
            scaleMax,
            lowLabel,
            highLabel,
            theme,
            decor,
            focusTopics: focus.map((f) => ({
              id: f.id,
              name: f.name,
              kind: f.kind,
              chart: f.chart,
              ...settings(f),
              topics: hasOptions(f.kind) ? filledRows(f.items) : [],
            })),
            criteria: hasRating ? filledRows(criteriaRows) : [],
          }),
        });
        await onDone(mode.code);
        return;
      }
      const res = await call("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify({
          title,
          scaleMax,
          lowLabel,
          highLabel,
          theme,
          decor,
          focusTopics: parsed.map((f) => ({
            name: f.name,
            kind: f.kind,
            chart: f.chart,
            ...settings(f),
            topics: f.topics,
          })),
          criteria,
        }),
      });
      const body = (await res.json()) as { code: string };
      setCreated(body.code);
      setTitle("");
      setFocus([blank(nextKey.current++)]);
      setThemeChoice(null);
      setStart(null);
      setTouched(false);
      await onDone(body.code);
    } catch (err) {
      setError((err as Error).message);
      setFailedTries((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problems.length) {
      setFailedTries((n) => n + 1);
      return;
    }
    const lost = answersLost();
    if (lost.total > 0) {
      setConfirmLoss(
        `You removed ${lost.names.join(", ")}. Saving deletes ${plural(lost.total, "answer")} people already gave. This can't be undone.`,
      );
      return;
    }
    void save();
  }

  return (
    <>
      <form
        onSubmit={submit}
        className="slab h-fit min-w-0 rounded-xl bg-white p-4 sm:p-6"
        noValidate
      >
        <h2 className="font-display text-3xl font-semibold">
          {editing ? "Edit presentation" : "New presentation"}
        </h2>
        {editing && (
          <p className="mt-1 text-sm text-ink-soft">
            Changes reach people&rsquo;s phones within about 15 seconds. Answers
            to anything you keep are kept.
          </p>
        )}

        {/* After a template or AI draft: say so, and offer the way back. */}
        {!editing && start !== null && start !== "blank" && (
          <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg bg-canvas px-3 py-2.5 text-sm">
            <span>
              Started from <span className="font-semibold">{start.label}</span>. Change anything you like.
            </span>
            <button
              type="button"
              onClick={() => (changedSinceStart ? setConfirmRestart(true) : restart())}
              className="font-semibold underline underline-offset-4"
            >
              Choose a different start
            </button>
          </div>
        )}
        {!editing && start === "blank" && pristine && (
          <p className="mt-4 text-sm text-ink-soft">
            Writing your own questions.{" "}
            <button type="button" onClick={() => setStart(null)} className="font-semibold text-ink underline underline-offset-4">
              Use a template instead
            </button>
          </p>
        )}

        {pristine && start === null && (
          <section aria-labelledby="templates-heading" className="mt-5">
            <h3 id="templates-heading" className="font-semibold">How do you want to start?</h3>
            <button
              type="button"
              onClick={() => {
                setStart("blank");
                requestAnimationFrame(() => document.getElementById("presentation-name")?.focus());
              }}
              className="mt-2 flex w-full items-center gap-3 rounded-lg border-2 border-ink bg-white px-3 py-3 text-left hover:bg-canvas"
            >
              <span aria-hidden className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-xl text-white">+</span>
              <span>
                <span className="block font-bold">Start blank</span>
                <span className="block text-sm text-ink-soft">Write your own questions from scratch</span>
              </span>
            </button>
            <p className="mt-4 text-sm font-semibold">
              Or use a template <span className="font-normal text-ink-soft">(optional, you can change everything)</span>
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyPlan(t.plan, `the “${t.label}” template`)}
                  className="rounded-lg border border-line-strong bg-white px-3 py-2.5 text-left hover:bg-canvas"
                >
                  <span className="block font-bold">{t.label}</span>
                  <span className="block text-sm text-ink-soft">{t.blurb}</span>
                </button>
              ))}
            </div>

            {!aiAvailable ? null : !aiOpen ? (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                aria-expanded={false}
                className="mt-3 rounded-lg border border-dashed border-line-strong bg-white px-3 py-2 text-sm font-bold hover:bg-canvas"
              >
                Write questions with AI
              </button>
            ) : guest ? (
              <div role="alert" className="mt-3 rounded-lg bg-sun px-4 py-3 text-sm">
                <p className="font-semibold">AI features need an account.</p>
                <p className="mt-0.5">Save your guest account with an email and password (it&rsquo;s free and keeps your presentations), or log in to an account you already have.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiOpen(false);
                      onNeedAccount?.();
                    }}
                    className="key rounded-lg bg-white px-3 py-1.5 font-bold"
                  >
                    Save my account
                  </button>
                  <button type="button" onClick={() => setAiOpen(false)} className="rounded-lg px-3 py-1.5 font-semibold underline underline-offset-4">
                    Not now
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-line-strong p-3">
                <label className="block text-sm font-semibold">
                  What&rsquo;s it for?
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && aiPrompt.trim().length >= 3 && !aiBusy) {
                        e.preventDefault();
                        void draftWithAi();
                      }
                    }}
                    maxLength={500}
                    rows={2}
                    autoFocus
                    placeholder="e.g. Retro for sprint 12 of the payments team"
                    className={`${field} text-base`}
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void draftWithAi()}
                    disabled={aiBusy || aiPrompt.trim().length < 3}
                    className="key rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                  >
                    {aiBusy ? "Writing…" : "Write questions"}
                  </button>
                  <button type="button" onClick={() => setAiOpen(false)} className="px-2 py-2 text-sm font-semibold underline underline-offset-4">
                    Cancel
                  </button>
                </div>
                {aiError && <p role="alert" className="mt-2 text-sm font-semibold text-error">{aiError}</p>}
                <p className="mt-2 text-xs text-ink-soft">Your description is sent to Google Gemini. Check the questions before you use them.</p>
              </div>
            )}
          </section>
        )}

        <label className="mt-5 block font-semibold">
          Presentation name
          <input
            id="presentation-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Team offsite 2027"
            className={field}
          />
        </label>

        <fieldset className="mt-6 min-w-0">
          <legend className="flex w-full items-baseline justify-between font-semibold">
            <span>Questions</span>
            <span className="text-sm font-normal text-ink-soft">
              {focus.length} of {MAX_FOCUS_TOPICS}
            </span>
          </legend>
          <p className="text-sm text-ink-soft">
            People answer these one at a time on their phones.
          </p>

          <ol className="mt-3 flex flex-col gap-4">
            {parsed.map((f, i) => {
              const kind = KINDS.find((k) => k.id === f.kind)!;
              const answered = f.id ? (counts[f.id] ?? 0) : 0;
              return (
                <li
                  key={f.key}
                  className="rounded-xl border border-line-strong p-3 pl-5 sm:p-4 sm:pl-6"
                  style={{ boxShadow: `inset 6px 0 0 ${topicColor(i)}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg">Question {i + 1}</p>
                    {focus.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setFocus((list) =>
                            list.filter((x) => x.key !== f.key),
                          )
                        }
                        className="rounded-lg px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-canvas hover:text-error"
                        aria-label={`Remove question ${i + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {f.id ? (
                    <p className="mt-1 text-sm text-ink-soft">
                      <span className="mr-1 rounded-full bg-canvas px-2.5 py-0.5 font-semibold text-ink">
                        {kind.label}
                      </span>
                      {answered > 0
                        ? `${plural(answered, "answer")} so far. `
                        : ""}
                      To use a different type, remove this question and add a
                      new one.
                    </p>
                  ) : (
                    <>
                      <div
                        role="radiogroup"
                        aria-label={`Type of question ${i + 1}`}
                        className="mt-2 flex flex-wrap gap-1.5"
                      >
                        {KINDS.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            role="radio"
                            aria-checked={f.kind === k.id}
                            onClick={() =>
                              update(f.key, {
                                kind: k.id,
                                chart: defaultChart(k.id),
                                // these need 2 options: give them a second empty row when switching
                                items:
                                  needsTwo(k.id) && f.items.length < 2
                                    ? [...f.items, { name: "" }]
                                    : f.items,
                              })
                            }
                            className={`rounded-full border border-line-strong px-3 py-1 text-sm font-bold ${f.kind === k.id ? "bg-ink text-white" : "bg-white hover:bg-canvas"}`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-xs font-semibold text-ink-soft">Shortcut:</span>
                        {PRESETS.map((p) => {
                          const on = matchingPreset(f.kind, f.items.map((it) => it.name))?.id === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                update(f.key, {
                                  kind: p.kind,
                                  chart: defaultChart(p.kind),
                                  items: p.options.map((name) => ({ name })),
                                })
                              }
                              className={`rounded-full border border-dashed border-line-strong px-3 py-1 font-bold ${on ? "bg-mint" : "bg-white hover:bg-canvas"}`}
                            >
                              {on ? "✓ " : "+ "}
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-xs text-ink-soft">
                        {kind.hint}
                      </p>
                    </>
                  )}

                  <label className="mt-3 block text-sm font-semibold">
                    What do you want to ask?
                    <input
                      value={f.name}
                      onChange={(e) => update(f.key, { name: e.target.value })}
                      maxLength={120}
                      placeholder={`e.g. ${EXAMPLES[f.kind].name}`}
                      className={`${field} text-base`}
                    />
                  </label>

                  {hasOptions(f.kind) && (
                    <ListEditor
                      label={LIST_COPY[f.kind as OptionKind].label}
                      noun={LIST_COPY[f.kind as OptionKind].noun}
                      items={f.items}
                      onChange={(items) => update(f.key, { items })}
                      max={MAX_TOPICS_PER_FOCUS}
                      maxLength={120}
                      placeholders={EXAMPLES[f.kind].list}
                      answers={counts}
                    />
                  )}

                  {f.kind === "multi" && (
                    <label className="mt-3 block text-sm font-semibold">
                      Each person can pick
                      <select
                        value={f.maxPicks ?? ""}
                        onChange={(e) =>
                          update(f.key, {
                            maxPicks: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        className={`${field} text-base`}
                      >
                        <option value="">As many as they like</option>
                        {Array.from(
                          { length: MAX_TOPICS_PER_FOCUS - 1 },
                          (_, n) => n + 1,
                        ).map((n) => (
                          <option key={n} value={n}>
                            Up to {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {f.kind === "quiz" && (
                    <div className="mt-3">
                      <p id={`right-${f.key}`} className="text-sm font-semibold">
                        Right answer
                      </p>
                      <div role="radiogroup" aria-labelledby={`right-${f.key}`} className="mt-1 flex flex-wrap gap-1.5">
                        {filledItems(f.items).map((name) => {
                          const on = name.trim() === f.correct.trim();
                          return (
                            <button
                              key={name}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              onClick={() => update(f.key, { correct: name })}
                              className={`rounded-full border border-line-strong px-3 py-1 text-sm font-bold ${on ? "bg-mint" : "bg-white hover:bg-canvas"}`}
                            >
                              {on ? "✓ " : ""}
                              {name}
                            </button>
                          );
                        })}
                        {filledItems(f.items).length === 0 && <span className="text-sm text-ink-soft">Type the answers above first.</span>}
                      </div>
                      <label className="mt-3 block text-sm font-semibold">
                        Time to answer
                        <select
                          value={f.seconds}
                          onChange={(e) => update(f.key, { seconds: Number(e.target.value) })}
                          className={`${field} text-base`}
                        >
                          {QUIZ_TIMES.map((t) => (
                            <option key={t} value={t}>
                              {t < 60 ? `${t} seconds` : t === 60 ? "1 minute" : `${t / 60} minutes`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-1.5 text-xs text-ink-soft">
                        On the results screen you start each quiz question. Everyone&apos;s phone jumps to it, and the right answer shows when time is up.
                      </p>
                    </div>
                  )}

                  {f.kind === "number" && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <label className="block text-sm font-semibold">
                        Lowest answer
                        <input
                          inputMode="decimal"
                          value={f.min}
                          onChange={(e) =>
                            update(f.key, { min: e.target.value })
                          }
                          className={`${field} text-base`}
                        />
                      </label>
                      <label className="block text-sm font-semibold">
                        Highest answer
                        <input
                          inputMode="decimal"
                          value={f.max}
                          onChange={(e) =>
                            update(f.key, { max: e.target.value })
                          }
                          className={`${field} text-base`}
                        />
                      </label>
                      <label className="col-span-2 block text-sm font-semibold sm:col-span-1">
                        Unit <span className="font-normal text-ink-soft">(optional)</span>
                        <input
                          value={f.unit}
                          maxLength={20}
                          onChange={(e) =>
                            update(f.key, { unit: e.target.value })
                          }
                          placeholder="e.g. %, users, km"
                          className={`${field} text-base`}
                        />
                      </label>
                    </div>
                  )}

                  <div className="mt-3">
                    <p id={`chart-${f.key}`} className="text-sm font-semibold">
                      Show results as
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby={`chart-${f.key}`}
                      className="mt-1 flex flex-wrap gap-1.5"
                    >
                      {CHARTS[f.kind].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          role="radio"
                          aria-checked={f.chart === c.id}
                          onClick={() => update(f.key, { chart: c.id })}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                            f.chart === c.id
                              ? "border-ink bg-ink text-white"
                              : "border-line-strong bg-white hover:border-ink"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      You can switch charts on the results screen too.
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            disabled={focus.length >= MAX_FOCUS_TOPICS}
            onClick={() =>
              setFocus((list) => [...list, blank(nextKey.current++)])
            }
            className="mt-3 w-full rounded-xl border border-dashed border-line-strong py-3 font-bold hover:bg-canvas disabled:opacity-40"
          >
            + Add another question
          </button>
        </fieldset>

        <section className="mt-6" aria-labelledby="design-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="design-h" className="font-semibold">
              Slide design
            </h3>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="text-sm font-semibold underline underline-offset-4"
            >
              Preview how it looks
            </button>
          </div>
          <p className="text-sm text-ink-soft">
            Colours and lettering on the big screen and on people&rsquo;s phones.
          </p>
          <div className="mt-2">
            <ThemePicker value={theme} onChange={setThemeChoice} recommended={recommended} title={title} />
          </div>
          <label className="mt-3 flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={decor} onChange={(e) => setDecor(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
            <span>
              <span className="font-semibold">Fun illustrations</span>
              <span className="block text-ink-soft">Cheerful doodle characters next to the title on the big screen and on phones, picked to match the design.</span>
            </span>
          </label>
        </section>

        {hasRating && (
          <section
            className="mt-6 rounded-xl border border-line-strong p-4"
            aria-labelledby="scoring-h"
          >
            <h3 id="scoring-h" className="font-semibold">
              How people score items
            </h3>
            <p className="text-sm text-ink-soft">
              This applies to every &ldquo;Score items&rdquo; question.
            </p>
            <ListEditor
              label="Score each item on"
              hint="For example Impact or Effort. People give every item a score for each of these."
              noun="measure"
              items={criteriaRows}
              onChange={setCriteriaRows}
              max={MAX_CRITERIA}
              maxLength={60}
              answers={counts}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-semibold">
                Scores go from 1 to
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={scaleMax}
                  disabled={scaleLocked}
                  onChange={(e) =>
                    setScaleMax(
                      Math.min(10, Math.max(3, Number(e.target.value) || 5)),
                    )
                  }
                  className={`${field} disabled:bg-canvas disabled:text-ink-soft`}
                />
              </label>
              <label className="block text-sm font-semibold">
                1 means
                <input
                  value={lowLabel}
                  onChange={(e) => setLowLabel(e.target.value)}
                  maxLength={30}
                  placeholder="Low"
                  className={field}
                />
              </label>
              <label className="block text-sm font-semibold">
                {scaleMax} means
                <input
                  value={highLabel}
                  onChange={(e) => setHighLabel(e.target.value)}
                  maxLength={30}
                  placeholder="High"
                  className={field}
                />
              </label>
            </div>
            {scaleLocked && (
              <p className="mt-2 text-xs text-ink-soft">
                People have already given scores, so the range is locked. Reset
                the votes to change it.
              </p>
            )}
          </section>
        )}

        <p
          className="mt-5 rounded-lg bg-canvas px-3 py-2 text-sm"
          aria-live="polite"
        >
          Each person will {hasRating && `give ${plural(scoreCount, "score")}`}
          {hasRating && otherQuestions > 0 && " and "}
          {otherQuestions > 0 && `answer ${plural(otherQuestions, "question")}`}
          .
        </p>

        <div ref={feedbackRef} tabIndex={-1} className="scroll-mb-28 outline-none">
        {touched && problems.length > 0 && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-error/40 px-4 py-3 text-sm text-error"
          >
            <p className="font-semibold">Fix these first:</p>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-error">
            {error}
          </p>
        )}
        {created && !error && (
          <p role="status" className="mt-3 text-sm font-semibold text-success">
            Done. Your presentation is ready under &ldquo;Your
            presentations&rdquo;.
          </p>
        )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line-strong px-3 py-3 font-semibold hover:bg-canvas sm:px-5"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="key rounded-lg bg-white px-3 py-3 font-semibold sm:px-5"
          >
            Preview
          </button>
          <button
            type="submit"
            disabled={busy || locked}
            className="key font-display min-w-0 flex-1 rounded-lg bg-primary px-2 py-3 text-lg font-bold whitespace-nowrap text-white sm:text-xl"
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save changes"
                : (
                    <>
                      Create<span className="max-sm:hidden"> presentation</span>
                    </>
                  )}
          </button>
        </div>
        {locked && (
          <p className="mt-2 text-center text-sm font-semibold text-ink-soft">
            Confirm your email address to create presentations.
          </p>
        )}
      </form>

      {/* Outside the form, so its buttons can't submit it */}
      {confirmRestart && (
        <ConfirmDialog
          title="Start over?"
          body="This clears the questions in the form, including your changes, so you can pick a different template or start blank."
          confirmLabel="Start over"
          onConfirm={restart}
          onCancel={() => setConfirmRestart(false)}
        />
      )}
      {previewOpen && (
        <PresentationPreview
          title={title}
          questions={preview()}
          theme={theme}
          onTheme={setThemeChoice}
          decor={decor}
          onDecor={setDecor}
          recommended={recommended}
          criteria={criteria}
          scaleMax={scaleMax}
          lowLabel={lowLabel}
          highLabel={highLabel}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      {confirmLoss && (
        <ConfirmDialog
          title="Delete these answers?"
          body={confirmLoss}
          confirmLabel="Save and delete answers"
          danger
          onConfirm={() => {
            setConfirmLoss(null);
            void save();
          }}
          onCancel={() => setConfirmLoss(null)}
        />
      )}
    </>
  );
}
