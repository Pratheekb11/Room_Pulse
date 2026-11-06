"use client";

import { useEffect, useRef, useState } from "react";
import { CHARTS, defaultChart } from "@/lib/charts";
import { topicColor } from "@/lib/colors";
import { MAX_CRITERIA, MAX_FOCUS_TOPICS, MAX_TOPICS_PER_FOCUS } from "@/lib/validation";
import { duplicateIndexes, filledItems, toItems } from "@/lib/list-edit";
import { ListEditor } from "./ListEditor";

type Call = (path: string, init?: RequestInit) => Promise<Response>;
type Kind = "rating" | "poll" | "words";

interface FocusDraft {
  key: number;
  kind: Kind;
  chart: string;
  name: string;
  items: string[];
}

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "rating", label: "Rate topics", hint: "People score each topic on your criteria." },
  { id: "poll", label: "Poll", hint: "People pick one option." },
  { id: "words", label: "Word cloud", hint: "People answer in up to 3 words or short phrases." },
];

const PLACEHOLDER: Record<Kind, { name: string; list: string[] }> = {
  rating: { name: "Growth bets", list: ["Self-serve onboarding", "Usage-based pricing", "Mobile app"] },
  poll: { name: "Where should the next offsite be?", list: ["Lisbon", "Kyoto", "Cape Town"] },
  words: { name: "One word for 2027?", list: [] },
};

/** Polls start with two option rows (the minimum); rated topics with one. */
const startRows = (kind: Kind) => (kind === "poll" ? ["", ""] : [""]);
const blank = (key: number, kind: Kind = "rating"): FocusDraft => ({ key, kind, chart: defaultChart(kind), name: "", items: startRows(kind) });
const field = "mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2";

// Unsaved form survives a refresh (sessionStorage: kept for this browser session only,
// so it isn't left behind on a shared computer).
const DRAFT_KEY = "liverate:draft";

interface Draft {
  title: string;
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  focus: FocusDraft[];
  criteria: string[];
}

/** Older drafts kept lists as one-per-line text (topicsText / criteriaText). */
type StoredDraft = Omit<Draft, "focus" | "criteria"> & {
  focus: (Omit<FocusDraft, "items"> & { items?: string[]; topicsText?: string })[];
  criteria?: string[];
  criteriaText?: string;
};

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    const d = raw ? (JSON.parse(raw) as StoredDraft) : null;
    if (!d || !Array.isArray(d.focus) || !d.focus.length) return null;
    return {
      ...d,
      focus: d.focus.map(({ topicsText, items, ...f }) => ({ ...f, items: toItems(items ?? topicsText) })),
      criteria: toItems(d.criteria ?? d.criteriaText),
    };
  } catch {
    return null;
  }
}

export function NewSessionForm({ call, onCreated, locked = false }: { call: Call; onCreated: () => Promise<void>; locked?: boolean }) {
  // Rendered only in the browser (after the sign-in check), so reading storage here is safe.
  const [initial] = useState(readDraft);
  const nextKey = useRef(initial ? Math.max(...initial.focus.map((f) => f.key)) + 1 : 1);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [scaleMax, setScaleMax] = useState(initial?.scaleMax ?? 5);
  const [lowLabel, setLowLabel] = useState(initial?.lowLabel ?? "Low");
  const [highLabel, setHighLabel] = useState(initial?.highLabel ?? "High");
  const [focus, setFocus] = useState<FocusDraft[]>(initial?.focus ?? [blank(0)]);
  const [criteriaRows, setCriteriaRows] = useState<string[]>(initial?.criteria ?? ["Impact", "Effectiveness", "Feasibility"]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, scaleMax, lowLabel, highLabel, focus, criteria: criteriaRows }));
    } catch {
      /* storage unavailable */
    }
  }, [title, scaleMax, lowLabel, highLabel, focus, criteriaRows]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const parsed = focus.map((f) => ({ ...f, topics: f.kind === "words" ? [] : filledItems(f.items) }));
  const hasRating = parsed.some((f) => f.kind === "rating");
  const criteria = hasRating ? filledItems(criteriaRows) : [];
  const ratingTopics = parsed.filter((f) => f.kind === "rating").reduce((n, f) => n + f.topics.length, 0);
  const otherQuestions = parsed.filter((f) => f.kind !== "rating").length;

  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title.");
  parsed.forEach((f, i) => {
    const label = f.name.trim() || `Focus topic ${i + 1}`;
    if (!f.name.trim()) problems.push(`Name focus topic ${i + 1}.`);
    if (f.kind === "rating" && f.topics.length === 0) problems.push(`Add at least 1 topic to “${label}”.`);
    if (f.kind === "poll" && f.topics.length < 2) problems.push(`Give the poll “${label}” at least 2 options.`);
    if (f.kind !== "words" && duplicateIndexes(f.items).size)
      problems.push(`“${label}” has the same ${f.kind === "poll" ? "option" : "topic"} twice.`);
  });
  const names = parsed.map((f) => f.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) problems.push("Give each focus topic a different name.");
  if (hasRating && criteria.length < 1) problems.push("Add at least 1 criterion.");
  if (hasRating && duplicateIndexes(criteriaRows).size) problems.push("The same criterion is listed twice.");
  if (hasRating && (!lowLabel.trim() || !highLabel.trim())) problems.push("Both scale labels are needed.");

  const update = (key: number, patch: Partial<FocusDraft>) =>
    setFocus((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (problems.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await call("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify({
          title,
          scaleMax,
          lowLabel,
          highLabel,
          focusTopics: parsed.map((f) => ({ name: f.name, kind: f.kind, chart: f.chart, topics: f.topics })),
          criteria,
        }),
      });
      const body = (await res.json()) as { code: string };
      setCreated(body.code);
      setTitle("");
      setFocus([blank(nextKey.current++)]);
      setTouched(false);
      await onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="slab h-fit min-w-0 rounded-xl bg-white p-5 sm:p-6" noValidate>
      <h2 className="font-display text-3xl font-semibold">New presentation</h2>

      <label className="mt-5 block font-semibold">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="2027 planning offsite" className={field} />
      </label>

      <fieldset className="mt-6 min-w-0">
        <legend className="flex w-full items-baseline justify-between font-semibold">
          <span>Focus topics</span>
          <span className="text-sm font-normal text-ink-soft">
            {focus.length} of {MAX_FOCUS_TOPICS}
          </span>
        </legend>
        <p className="text-sm text-ink-soft">
          Each focus topic is one question: rate up to {MAX_TOPICS_PER_FOCUS} topics, run a poll, or collect a word cloud.
        </p>

        <ol className="mt-3 flex flex-col gap-4">
          {parsed.map((f, i) => {
            const kind = KINDS.find((k) => k.id === f.kind)!;
            return (
              <li key={f.key} className="rounded-xl border border-line-strong p-4 pl-6" style={{ boxShadow: `inset 6px 0 0 ${topicColor(i)}` }}>
                <div role="radiogroup" aria-label={`Question type for focus topic ${i + 1}`} className="flex flex-wrap gap-1.5">
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
                          items: k.id === "poll" && f.items.length < 2 ? [...f.items, ""] : f.items,
                        })
                      }
                      className={`rounded-full border border-line-strong px-3 py-1 text-sm font-bold ${f.kind === k.id ? "bg-ink text-white" : "bg-white hover:bg-canvas"}`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">{kind.hint}</p>

                <div className="mt-3 flex items-end gap-2">
                  <label className="block flex-1 text-sm font-semibold">
                    {f.kind === "rating" ? `Focus topic ${i + 1}` : "Question"}
                    <input
                      value={f.name}
                      onChange={(e) => update(f.key, { name: e.target.value })}
                      maxLength={120}
                      placeholder={PLACEHOLDER[f.kind].name}
                      className={`${field} text-base`}
                    />
                  </label>
                  {focus.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFocus((list) => list.filter((x) => x.key !== f.key))}
                      className="mb-0.5 rounded-lg border border-line-strong px-3 py-2 text-sm font-bold"
                      aria-label={`Remove focus topic ${i + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3">
                  <p id={`chart-${f.key}`} className="text-sm font-semibold">
                    Show results as
                  </p>
                  <div role="radiogroup" aria-labelledby={`chart-${f.key}`} className="mt-1 flex flex-wrap gap-1.5">
                    {CHARTS[f.kind].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={f.chart === c.id}
                        onClick={() => update(f.key, { chart: c.id })}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          f.chart === c.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {f.kind !== "words" && (
                  <ListEditor
                    label={f.kind === "poll" ? "Options" : "Topics to rate"}
                    noun={f.kind === "poll" ? "option" : "topic"}
                    items={f.items}
                    onChange={(items) => update(f.key, { items })}
                    max={MAX_TOPICS_PER_FOCUS}
                    maxLength={120}
                    placeholders={PLACEHOLDER[f.kind].list}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          disabled={focus.length >= MAX_FOCUS_TOPICS}
          onClick={() => setFocus((list) => [...list, blank(nextKey.current++)])}
          className="mt-3 w-full rounded-xl border border-dashed border-line-strong py-3 font-bold hover:bg-canvas disabled:opacity-40"
        >
          + Add focus topic
        </button>
      </fieldset>

      {hasRating && (
        <>
          <div className="mt-6 rounded-xl border border-line-strong p-4">
            <ListEditor
              label="Criteria"
              hint="Every rated topic is scored on each of these."
              noun="criterion"
              items={criteriaRows}
              onChange={setCriteriaRows}
              max={MAX_CRITERIA}
              maxLength={60}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <label className="block font-semibold">
              Scale 1 to
              <input
                type="number"
                min={3}
                max={10}
                value={scaleMax}
                onChange={(e) => setScaleMax(Math.min(10, Math.max(3, Number(e.target.value) || 5)))}
                className={field}
              />
            </label>
            <label className="block font-semibold">
              Low label
              <input value={lowLabel} onChange={(e) => setLowLabel(e.target.value)} maxLength={30} className={field} />
            </label>
            <label className="block font-semibold">
              High label
              <input value={highLabel} onChange={(e) => setHighLabel(e.target.value)} maxLength={30} className={field} />
            </label>
          </div>
        </>
      )}

      <p className="font-display mt-5 rounded-lg bg-canvas px-3 py-2 text-lg font-bold" aria-live="polite">
        {hasRating && `${ratingTopics * criteria.length} ratings`}
        {hasRating && otherQuestions > 0 && " + "}
        {otherQuestions > 0 && `${otherQuestions} ${otherQuestions === 1 ? "question" : "questions"}`} per person
      </p>

      {touched && problems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm font-semibold text-error">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      {created && !error && (
        <p role="status" className="mt-3 text-sm font-semibold text-success">
          Created presentation {created}. Its links and QR code are in the list.
        </p>
      )}

      <button type="submit" disabled={busy || locked} className="key font-display mt-5 w-full rounded-lg bg-primary py-3 text-xl font-bold text-white">
        {busy ? "Creating…" : "Create presentation"}
      </button>
      {locked && <p className="mt-2 text-center text-sm font-semibold text-ink-soft">Verify your email to create presentations.</p>}
    </form>
  );
}
