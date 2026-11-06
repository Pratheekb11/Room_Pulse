"use client";

import { useEffect, useRef, useState } from "react";
import { CHARTS, defaultChart } from "@/lib/charts";
import { topicColor } from "@/lib/colors";
import {
  MAX_CRITERIA,
  MAX_FOCUS_TOPICS,
  MAX_TOPICS_PER_FOCUS,
} from "@/lib/validation";
import {
  duplicateIndexes,
  filledItems,
  filledRows,
  rowsFrom,
  type Row,
} from "@/lib/list-edit";
import type { SessionPayload } from "@/lib/types";
import { ConfirmDialog } from "../ConfirmDialog";
import { ListEditor } from "./ListEditor";

type Call = (path: string, init?: RequestInit) => Promise<Response>;
type Kind = "rating" | "poll" | "words";

interface QuestionDraft {
  key: number;
  /** Set for questions that are already saved (edit mode). */
  id?: string;
  kind: Kind;
  chart: string;
  name: string;
  items: Row[];
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

export const KINDS: { id: Kind; label: string; hint: string }[] = [
  {
    id: "rating",
    label: "Score items",
    hint: "People give each item a score, like 1 to 5.",
  },
  { id: "poll", label: "Poll", hint: "People pick one option." },
  {
    id: "words",
    label: "Word cloud",
    hint: "People type up to 3 words. Popular words show bigger.",
  },
];

const EXAMPLES: Record<Kind, { name: string; list: string[] }> = {
  rating: {
    name: "Which project should we do first?",
    list: ["New website", "Mobile app", "Better onboarding"],
  },
  poll: {
    name: "Where should the next offsite be?",
    list: ["Lisbon", "Kyoto", "Cape Town"],
  },
  words: { name: "Describe this year in one word", list: [] },
};

const LIST_COPY: Record<
  Exclude<Kind, "words">,
  { label: string; noun: string }
> = {
  rating: { label: "Items to score", noun: "item" },
  poll: { label: "Options", noun: "option" },
};

/** Polls start with two option rows (the minimum); scored questions with one. */
const startRows = (kind: Kind): Row[] =>
  kind === "poll" ? [{ name: "" }, { name: "" }] : [{ name: "" }];
const blank = (key: number, kind: Kind = "rating"): QuestionDraft => ({
  key,
  kind,
  chart: defaultChart(kind),
  name: "",
  items: startRows(kind),
});
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
}

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
        ...f,
        id: undefined,
        items: plain(items ?? topicsText),
      })),
      criteria: plain(d.criteria ?? d.criteriaText),
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
      items:
        f.kind === "words"
          ? [{ name: "" }]
          : rowsFrom(s.topics.filter((t) => t.focusId === f.id)),
    })),
    criteria: rowsFrom(s.criteria),
  };
}

const DEFAULT_CRITERIA: Row[] = [{ name: "Impact" }, { name: "Effort" }];

export function PresentationForm({
  call,
  mode,
  onDone,
  onCancel,
  locked = false,
}: {
  call: Call;
  mode: FormMode;
  onDone: (code: string) => Promise<void> | void;
  onCancel?: () => void;
  locked?: boolean;
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
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [editing, title, scaleMax, lowLabel, highLabel, focus, criteriaRows]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [confirmLoss, setConfirmLoss] = useState<string | null>(null);

  const parsed = focus.map((f) => ({
    ...f,
    topics: f.kind === "words" ? [] : filledItems(f.items),
  }));
  const hasRating = parsed.some((f) => f.kind === "rating");
  const criteria = hasRating ? filledItems(criteriaRows) : [];
  const scoreCount =
    parsed
      .filter((f) => f.kind === "rating")
      .reduce((n, f) => n + f.topics.length, 0) * criteria.length;
  const otherQuestions = parsed.filter((f) => f.kind !== "rating").length;

  const problems: string[] = [];
  if (!title.trim()) problems.push("Give your presentation a name.");
  parsed.forEach((f, i) => {
    const label = f.name.trim() ? `“${f.name.trim()}”` : `question ${i + 1}`;
    if (!f.name.trim()) problems.push(`Write question ${i + 1}.`);
    if (f.kind === "rating" && f.topics.length === 0)
      problems.push(`Add at least 1 item to score in ${label}.`);
    if (f.kind === "poll" && f.topics.length < 2)
      problems.push(`Add at least 2 options to ${label}.`);
    if (f.kind !== "words" && duplicateIndexes(f.items).size)
      problems.push(`${label} has the same ${LIST_COPY[f.kind].noun} twice.`);
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
          f.kind === "words" ? [] : filledRows(f.items).map((r) => r.id),
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
            focusTopics: focus.map((f) => ({
              id: f.id,
              name: f.name,
              kind: f.kind,
              chart: f.chart,
              topics: f.kind === "words" ? [] : filledRows(f.items),
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
          focusTopics: parsed.map((f) => ({
            name: f.name,
            kind: f.kind,
            chart: f.chart,
            topics: f.topics,
          })),
          criteria,
        }),
      });
      const body = (await res.json()) as { code: string };
      setCreated(body.code);
      setTitle("");
      setFocus([blank(nextKey.current++)]);
      setTouched(false);
      await onDone(body.code);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problems.length) return;
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
        className="slab h-fit min-w-0 rounded-xl bg-white p-5 sm:p-6"
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

        <label className="mt-5 block font-semibold">
          Presentation name
          <input
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
                  className="rounded-xl border border-line-strong p-4 pl-6"
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
                                // a poll needs 2 options: give it a second empty row when switching
                                items:
                                  k.id === "poll" && f.items.length < 2
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

                  {f.kind !== "words" && (
                    <ListEditor
                      label={LIST_COPY[f.kind].label}
                      noun={LIST_COPY[f.kind].noun}
                      items={f.items}
                      onChange={(items) => update(f.key, { items })}
                      max={MAX_TOPICS_PER_FOCUS}
                      maxLength={120}
                      placeholders={EXAMPLES[f.kind].list}
                      answers={counts}
                    />
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

        <div className="mt-5 flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-line-strong px-5 py-3 font-semibold hover:bg-canvas"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={busy || locked}
            className="key font-display flex-1 rounded-lg bg-primary py-3 text-xl font-bold text-white"
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create presentation"}
          </button>
        </div>
        {locked && (
          <p className="mt-2 text-center text-sm font-semibold text-ink-soft">
            Confirm your email address to create presentations.
          </p>
        )}
      </form>

      {/* Outside the form, so its buttons can't submit it */}
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
