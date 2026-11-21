"use client";

import { useEffect, useRef, useState } from "react";
import { ACTIVITIES } from "@/lib/activities";
import { isBoard } from "@/lib/boards";
import { topicColor } from "@/lib/colors";
import { hasOptions, MAX_FOCUS_TOPICS } from "@/lib/validation";
import { TEMPLATES, type PresentationPlan } from "@/lib/templates";
import { filledItems, filledRows, descriptionsOf, imagesOf, rowsFrom, type Row } from "@/lib/list-edit";
import {
  blank,
  DEFAULT_CRITERIA,
  duplicateQuestion,
  fromPreset,
  moveQuestion,
  presentationProblems,
  removeQuestion,
  toNumber,
  type QuestionDraft,
} from "@/lib/builder";
import type { SessionPayload } from "@/lib/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { PresentationPreview } from "./PresentationPreview";
import { isThemeId, recommendTheme, type ThemeId } from "@/lib/themes";
import { previewQuestions } from "@/lib/preview";
import { scoringHost } from "@/lib/scoring";
import { HowToDialog } from "./HowToDialog";
import { Words } from "@/components/home/Words";
import { useMedia } from "../useMedia";
import { QuestionRail } from "./builder/QuestionRail";
import { QuestionEditor, field } from "./builder/QuestionEditor";
import { TypePicker, type TypeChoice } from "./builder/TypePicker";
import { LivePreview } from "./builder/LivePreview";
import { DesignSettings } from "./builder/DesignSettings";
import type { ScoringProps } from "./builder/ScoringSettings";

type Call = (path: string, init?: RequestInit) => Promise<Response>;

export type FormMode =
  | { kind: "create" }
  | {
      kind: "edit";
      code: string;
      session: SessionPayload;
      counts: Record<string, number>;
      scaleLocked: boolean;
    };

/** Builder questions for a template, activity or AI-drafted plan. */
export function draftsFromPlan(plan: PresentationPlan, firstKey: number): QuestionDraft[] {
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
      description: q.description ?? null,
      board: q.kind === "text" && isBoard(q.board) ? q.board : null,
      maxLeaves: q.kind === "text" && isBoard(q.board) ? (q.maxLeaves ?? null) : null,
      chart: q.kind === "text" && isBoard(q.board) ? "board" : d.chart,
    };
  });
}

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
  /** Voters see the results on their phones from the start (team activities turn it on). */
  showResults?: boolean;
  /** Names on: phones ask for a name once and results show who answered (team activities turn it on). */
  named?: boolean;
}

/** For an activity, `steps` is how to run it, shown to the host under "Started from". */
type StartChoice = null | "blank" | { label: string; snapshot: string; steps?: string[] };

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
      rowsFrom(list).map((r): Row => ({ name: r.name, ...(r.description ? { description: r.description } : {}), ...(r.image ? { image: r.image } : {}) }));
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
      description: f.description ?? null,
      image: f.imageId ?? null,
      board: f.board ?? null,
      maxLeaves: f.maxLeaves ?? null,
    })),
    criteria: rowsFrom(s.criteria),
    theme: isThemeId(s.session.theme) ? s.session.theme : "paper",
    decor: s.session.decor !== false,
    named: s.session.named === true,
  };
}

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
  const [showResults, setShowResults] = useState(initial?.showResults === true);
  const [named, setNamed] = useState(initial?.named === true);
  /**
   * How this presentation was started: null while choosing, "blank", or the template / AI draft used
   * (with a snapshot, so going back can tell whether anything was changed since).
   */
  const [start, setStart] = useState<StartChoice>(initial?.start ?? null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  /** The question being edited (its key); falls back to the first one. */
  const [selected, setSelected] = useState(focus[0]?.key ?? 0);
  /** Picking the kind of a new question: "first" replaces the empty first question, "add" adds one. */
  const [adding, setAdding] = useState<null | "first" | "add">(null);
  /** On the start screen: the three choices, or the list of templates or of activities. */
  const [startView, setStartView] = useState<null | "templates" | "activities">(null);
  // a laptop: the list beside the editor; a wide one: the live preview too
  const wide = useMedia("(min-width: 1024px)");
  const wider = useMedia("(min-width: 1280px)");
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
          showResults,
          named,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [editing, title, scaleMax, lowLabel, highLabel, focus, criteriaRows, themeChoice, decor, start, showResults, named]);
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
    description: f.description?.trim() || null,
    itemDescriptions: f.kind === "rating" ? descriptionsOf(f.items) : null,
    image: f.image ?? null,
    itemImages: hasOptions(f.kind) ? imagesOf(f.items) : null,
    board: f.kind === "text" ? (f.board ?? null) : null,
    maxLeaves: f.kind === "text" && f.board ? (f.maxLeaves ?? null) : null,
  });
  const hasRating = parsed.some((f) => f.kind === "rating");

  // Shared by every Score items question; shown inside the first one, where people look for it.
  const scoringKey = scoringHost(parsed);
  const scoringNumber = parsed.findIndex((f) => f.key === scoringKey) + 1;
  const scoring: ScoringProps = {
    scaleMax,
    setScaleMax,
    lowLabel,
    setLowLabel,
    highLabel,
    setHighLabel,
    criteria: criteriaRows,
    setCriteria: setCriteriaRows,
    locked: scaleLocked,
    counts,
    shared: parsed.filter((f) => f.kind === "rating").length > 1,
  };
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
        description: f.description?.trim() || null,
        itemDescriptions: f.kind === "rating" ? descriptionsOf(f.items) : undefined,
        image: f.image ?? null,
        itemImages: hasOptions(f.kind) ? imagesOf(f.items) : undefined,
        board: f.kind === "text" ? (f.board ?? null) : null,
        maxLeaves: f.kind === "text" && f.board ? (f.maxLeaves ?? null) : null,
      })),
    );

  const { all: problems, byKey: problemsByKey } = presentationProblems({ title, questions: focus, criteria: criteriaRows, lowLabel, highLabel });

  /** Nothing typed yet, so a template can fill the form without losing anything. */
  const pristine =
    !editing &&
    !title.trim() &&
    focus.every((f) => !f.name.trim() && f.items.every((it) => !it.name.trim()));
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Keys differ between renders of the same questions, so leave them out of the comparison.
  const snapshotOf = (t: string, f: QuestionDraft[]) => JSON.stringify([t, f.map((q) => ({ ...q, key: 0 }))]);
  function applyPlan(plan: PresentationPlan, label: string, shareResults = false, steps?: string[]) {
    const drafts = draftsFromPlan(plan, nextKey.current);
    setTitle(plan.title);
    setFocus(drafts);
    setSelected(drafts[0].key);
    setAdding(null);
    nextKey.current += plan.questions.length;
    setStart({ label, snapshot: snapshotOf(plan.title, drafts), ...(steps?.length ? { steps } : {}) });
    // activities are watched together: everyone sees the tree fill up on their phone,
    // and team building needs names: who is on which side
    setShowResults(shareResults);
    setNamed(shareResults);
  }
  /** Back to the start choices with an empty form. */
  function restart() {
    setTitle("");
    setFocus([blank(nextKey.current++)]);
    setCriteriaRows(DEFAULT_CRITERIA);
    setThemeChoice(null);
    setStart(null);
    setShowResults(false);
    setNamed(false);
    setConfirmRestart(false);
    setAdding(null);
    setStartView(null);
  }
  const changedSinceStart = start !== null && start !== "blank" && snapshotOf(title, focus) !== start.snapshot;

  // "Write questions with AI": closed until asked for, so nothing changes for people who don't want it.
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  /** Guests are asked to save their account first (AI is for accounts only). */
  function askAi() {
    if (guest) {
      setAiOpen(true);
      return;
    }
    void draftWithAi();
  }
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
            named,
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
          showResults,
          named,
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
      setShowResults(false);
      setNamed(false);
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
    setAdding(null);
    if (problems.length) {
      // open the first question that needs fixing, so its problems show where they're fixed
      const firstBad = focus.find((f) => problemsByKey.has(f.key));
      if (firstBad) setSelected(firstBad.key);
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

  const selectedQuestion = focus.find((f) => f.key === selected) ?? focus[0];
  const selectedIndex = focus.indexOf(selectedQuestion);
  /** Still choosing how to start: only the choices show, with no empty form underneath. */
  const choosing = pristine && start === null;

  function pickType(choice: TypeChoice) {
    const key = nextKey.current++;
    const q = "preset" in choice ? fromPreset(choice.preset, key) : blank(key, choice.kind);
    setFocus((list) => (adding === "first" ? [q] : [...list, q]));
    setSelected(key);
    setAdding(null);
    // straight into the question box
    requestAnimationFrame(() => document.getElementById(`question-${key}`)?.focus({ preventScroll: true }));
  }
  const typePicker = (
    <TypePicker
      title={adding === "first" ? "What's your first question?" : "Add a question: what kind?"}
      onPick={pickType}
      onCancel={() => setAdding(null)}
    />
  );
  const editor = (
    <QuestionEditor
      key={selectedQuestion.key}
      question={selectedQuestion}
      index={selectedIndex}
      total={focus.length}
      onChange={(patch) => update(selectedQuestion.key, patch)}
      onRemove={() => {
        const out = removeQuestion(focus, selectedQuestion.key);
        setFocus(out.list);
        setSelected(out.selected);
      }}
      onDuplicate={() => {
        const key = nextKey.current++;
        setFocus((list) => duplicateQuestion(list, selectedQuestion.key, key));
        setSelected(key);
      }}
      canDuplicate={focus.length < MAX_FOCUS_TOPICS}
      answered={selectedQuestion.id ? (counts[selectedQuestion.id] ?? 0) : 0}
      counts={counts}
      problems={touched ? (problemsByKey.get(selectedQuestion.key) ?? []) : []}
      scoring={selectedQuestion.key === scoringKey ? scoring : null}
      scoringNumber={scoringNumber}
      scaleMax={scaleMax}
      lowLabel={lowLabel}
      highLabel={highLabel}
      criteria={criteria}
      compact={!wide}
    />
  );

  return (
    <>
      <form
        onSubmit={submit}
        className="slab h-fit min-w-0 rounded-xl bg-white p-4 sm:p-6"
        noValidate
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-3xl font-semibold">
            <Words text={editing ? "Edit presentation" : "New presentation"} />
          </h2>
          <span className="flex flex-wrap gap-x-4 text-sm font-semibold">
            <button type="button" onClick={() => setHowOpen(true)} className="underline underline-offset-4">
              Need help? Show me how
            </button>
            {onCancel && !wide && (
              <button type="button" onClick={onCancel} className="underline underline-offset-4">
                Cancel
              </button>
            )}
          </span>
        </div>
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
        {/* An activity: how to run it, for the host (kept with the start, so a refresh keeps it). */}
        {!editing && start !== null && start !== "blank" && start.steps && (
          <details className="mt-2 rounded-lg border border-line px-3 py-2 text-sm">
            <summary className="cursor-pointer font-semibold">How to run it</summary>
            <ol className="mt-2 mb-1 list-decimal space-y-1 pl-5">
              {start.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        )}
        {!editing && start === "blank" && pristine && (
          <p className="mt-4 text-sm text-ink-soft">
            Writing your own questions.{" "}
            <button type="button" onClick={() => setStart(null)} className="font-semibold text-ink underline underline-offset-4">
              Pick a template instead
            </button>
          </p>
        )}

        {choosing ? (
          <section aria-labelledby="templates-heading" className="enter mt-6">
            {startView === null ? (
              <>
                {aiAvailable && (
                  <div className="rounded-2xl border border-line-strong bg-canvas p-3.5">
                    <label htmlFor="ai-prompt" className="flex items-center gap-2 font-bold">
                      <span aria-hidden style={{ color: topicColor(3) }}>✦</span>
                      Write questions with AI
                    </label>
                    <div className="mt-2 flex items-end gap-2">
                      <textarea
                        id="ai-prompt"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && aiPrompt.trim().length >= 3 && !aiBusy) {
                            e.preventDefault();
                            askAi();
                          }
                        }}
                        maxLength={500}
                        rows={2}
                        placeholder="What's it for? e.g. Retro for sprint 12 of the payments team"
                        className="min-w-0 flex-1 resize-none rounded-xl border border-line-strong bg-white px-3 py-2 text-base"
                      />
                      <button
                        type="button"
                        onClick={askAi}
                        disabled={aiBusy || aiPrompt.trim().length < 3}
                        aria-label="Write questions"
                        className="key grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-lg text-white"
                      >
                        {aiBusy ? "…" : "↑"}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["Sprint retro", "Team icebreaker", "Event feedback", "Quick quiz"].map((idea) => (
                        <button
                          key={idea}
                          type="button"
                          onClick={() => setAiPrompt(idea)}
                          className="rounded-full border border-line-strong bg-white px-3 py-1 text-sm font-semibold hover:border-ink"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                    {aiOpen && guest && (
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
                    )}
                    {aiError && <p role="alert" className="mt-2 text-sm font-semibold text-error">{aiError}</p>}
                    <p className="mt-2 text-xs text-ink-soft">Sent to Google Gemini. Check the questions before you use them.</p>
                  </div>
                )}
                <h3 id="templates-heading" className={`font-display text-2xl ${aiAvailable ? "mt-6" : ""}`}>
                  How do you want to start?
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {(
                    [
                      { id: "blank", label: "Write your own", sub: "Begin with an empty question", icon: "M5 19l3.5-.8L18.3 8.4a1.8 1.8 0 0 0-2.6-2.6L5.9 15.6zM14 7.5l2.5 2.5" },
                      { id: "templates", label: "Pick a template", sub: `${TEMPLATES.length} ready-made: retro, standup, feedback…`, icon: "M4 5h16v14H4zM4 10h16M10 10v9" },
                      { id: "activities", label: "Team activity", sub: `${ACTIVITIES.length} activities for the room and online`, icon: "M12 21v-6M12 15c-4 0-7-2.5-7-6a7 7 0 0 1 14 0c0 3.5-3 6-7 6zM9 9.5h.01M15 9.5h.01" },
                    ] as const
                  ).map((t, n) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (t.id === "blank") {
                          setStart("blank");
                          // pick the kind of the first question straight away
                          setAdding("first");
                        } else setStartView(t.id);
                      }}
                      className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white px-3 py-5 text-center transition-[border-color,transform] duration-150 hover:border-ink active:scale-[0.98] max-sm:min-h-0 max-sm:flex-row max-sm:justify-start max-sm:text-left"
                    >
                      <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" fill="none" stroke="currentColor" style={{ color: topicColor(n) }} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d={t.icon} />
                      </svg>
                      <span>
                        <span className="block text-lg font-bold">{t.label}</span>
                        <span className="block text-sm text-ink-soft">{t.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setStartView(null)} className="-ml-2 shrink-0 rounded-lg px-2 py-1 font-semibold whitespace-nowrap hover:bg-canvas">
                    ← Back
                  </button>
                  <h3 id="templates-heading" className="font-display text-2xl">
                    {startView === "templates" ? "Templates" : "Team activities"}
                  </h3>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {startView === "templates" ? "You can change everything afterwards." : "For people in the room and online alike. Names show on answers."}
                </p>
                {startView === "templates" && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyPlan(t.plan, `the “${t.label}” template`)}
                        className="rounded-xl border border-line-strong bg-white px-3.5 py-3 text-left transition-colors duration-150 hover:border-ink"
                      >
                        <span className="block font-bold">{t.label}</span>
                        <span className="block text-sm text-ink-soft">{t.blurb}</span>
                      </button>
                    ))}
                  </div>
                )}
                {startView === "activities" && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ACTIVITIES.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => applyPlan(a.plan, `the “${a.label}” activity`, true, a.steps)}
                        className="rounded-xl border border-line-strong bg-white px-3.5 py-3 text-left transition-colors duration-150 hover:border-ink"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-bold">{a.label}</span>
                          <span className="shrink-0 text-xs font-semibold text-ink-soft tabular-nums">{a.minutes} min</span>
                        </span>
                        <span className="block text-sm text-ink-soft">{a.blurb}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
                ) : (
          <>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="block min-w-0 flex-1 basis-64 font-semibold">
                Presentation name
                <input
                  id="presentation-name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Team offsite 2027"
                  className={`${field} text-lg`}
                />
              </label>
              <button
                type="button"
                onClick={() => setDesignOpen(true)}
                className="key flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 font-semibold"
              >
                <span aria-hidden className="h-4 w-4 rounded-full border border-line-strong" style={{ background: "var(--color-primary)" }} />
                Design &amp; settings
              </button>
            </div>
            {touched && problemsByKey.size === 0 && !title.trim() && (
              <p className="mt-1 text-sm font-semibold text-error">Give your presentation a name.</p>
            )}

            {/* The slide editor: the questions, the one being edited, and how it looks (from 1280px) */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_21rem]">
              <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                {!wide && adding ? (
                  typePicker
                ) : (
                  <QuestionRail
                    questions={focus}
                    selected={selectedQuestion.key}
                    problems={problemsByKey}
                    showProblems={touched}
                    onSelect={(key) => {
                      setAdding(null);
                      setSelected(key);
                    }}
                    onMove={(key, by) => setFocus((list) => moveQuestion(list, key, by))}
                    onAdd={() => setAdding("add")}
                    max={MAX_FOCUS_TOPICS}
                    renderSelected={wide ? undefined : adding ? undefined : () => editor}
                  />
                )}
              </div>
              {wide && <div className="min-w-0">{adding ? typePicker : editor}</div>}
              {wider && (
                <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
                  <LivePreview
                    title={title}
                    questions={preview()}
                    selected={selectedIndex}
                    onPick={(i) => {
                      setAdding(null);
                      setSelected(focus[i]?.key ?? selectedQuestion.key);
                    }}
                    theme={theme}
                    decor={decor}
                    criteria={criteria}
                    scaleMax={scaleMax}
                    lowLabel={lowLabel}
                    highLabel={highLabel}
                    onOpenFull={() => setPreviewOpen(true)}
                    onDesign={() => setDesignOpen(true)}
                  />
                </div>
              )}
            </div>

          <p
            className="mt-6 rounded-lg bg-canvas px-3 py-2 text-sm"
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
            {onCancel && wide && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-line-strong px-3 py-3 font-semibold hover:bg-canvas sm:px-5"
              >
                Cancel
              </button>
            )}
            {wide ? (
              <button type="button" onClick={() => setPreviewOpen(true)} className="key rounded-lg bg-white px-3 py-3 font-semibold sm:px-5">
                Preview
              </button>
            ) : (
              // a phone: preview, the main button and add a question, all within thumb's reach
              <button type="button" onClick={() => setPreviewOpen(true)} aria-label="Preview" className="key grid w-12 shrink-0 place-items-center rounded-full bg-white">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="2.8" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={busy || locked}
              className="key font-display min-w-0 flex-1 rounded-lg bg-primary px-2 py-3 text-lg font-bold whitespace-nowrap text-white sm:text-xl"
            >
              {busy
                ? "Saving…"
                : editing
                  ? (
                      <>
                        Save<span className="max-sm:hidden"> changes</span>
                      </>
                    )
                  : (
                      <>
                        Create<span className="max-sm:hidden"> presentation</span>
                      </>
                    )}
            </button>
            {!wide && (
              <button
                type="button"
                onClick={() => {
                  setAdding("add");
                  requestAnimationFrame(() => document.getElementById("type-picker-h")?.scrollIntoView({ block: "start", behavior: "smooth" }));
                }}
                disabled={focus.length >= MAX_FOCUS_TOPICS}
                aria-label="Add question"
                className="key grid w-12 shrink-0 place-items-center rounded-full bg-white text-2xl leading-none disabled:opacity-40"
              >
                +
              </button>
            )}
          </div>
          {locked && (
            <p className="mt-2 text-center text-sm font-semibold text-ink-soft">
              Confirm your email address to create presentations.
            </p>
          )}
          </>
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
      {howOpen && <HowToDialog kind={focus[focus.length - 1]?.kind ?? "rating"} onClose={() => setHowOpen(false)} />}
      {designOpen && (
        <DesignSettings
          theme={theme}
          onTheme={setThemeChoice}
          recommended={recommended}
          title={title}
          decor={decor}
          setDecor={setDecor}
          showResults={editing ? null : showResults}
          setShowResults={setShowResults}
          named={named}
          setNamed={setNamed}
          onClose={() => setDesignOpen(false)}
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
