"use client";

import { useRef, useState } from "react";
import { topicColor } from "@/lib/colors";
import { MAX_CRITERIA, MAX_FOCUS_TOPICS, MAX_TOPICS_PER_FOCUS, splitLines } from "@/lib/validation";

type Call = (path: string, init?: RequestInit) => Promise<Response>;
type Kind = "rating" | "poll" | "words";

interface FocusDraft {
  key: number;
  kind: Kind;
  name: string;
  topicsText: string;
}

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "rating", label: "Rate topics", hint: "People score each topic on your criteria." },
  { id: "poll", label: "Poll", hint: "People pick one option." },
  { id: "words", label: "Word cloud", hint: "People answer in up to 3 words or short phrases." },
];

const PLACEHOLDER: Record<Kind, { name: string; list: string }> = {
  rating: { name: "Growth bets", list: "Self-serve onboarding\nUsage-based pricing\nMobile app" },
  poll: { name: "Where should the next offsite be?", list: "Lisbon\nKyoto\nCape Town" },
  words: { name: "One word for 2027?", list: "" },
};

const blank = (key: number, kind: Kind = "rating"): FocusDraft => ({ key, kind, name: "", topicsText: "" });
const field = "mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-2";

export function NewSessionForm({ call, onCreated }: { call: Call; onCreated: () => Promise<void> }) {
  const nextKey = useRef(1);
  const [title, setTitle] = useState("");
  const [scaleMax, setScaleMax] = useState(5);
  const [lowLabel, setLowLabel] = useState("Low");
  const [highLabel, setHighLabel] = useState("High");
  const [focus, setFocus] = useState<FocusDraft[]>([blank(0)]);
  const [criteriaText, setCriteriaText] = useState("Impact\nEffectiveness\nFeasibility");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const parsed = focus.map((f) => ({ ...f, topics: f.kind === "words" ? [] : splitLines(f.topicsText) }));
  const hasRating = parsed.some((f) => f.kind === "rating");
  const criteria = hasRating ? splitLines(criteriaText) : [];
  const ratingTopics = parsed.filter((f) => f.kind === "rating").reduce((n, f) => n + f.topics.length, 0);
  const otherQuestions = parsed.filter((f) => f.kind !== "rating").length;

  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title.");
  parsed.forEach((f, i) => {
    const label = f.name.trim() || `Focus topic ${i + 1}`;
    if (!f.name.trim()) problems.push(`Name focus topic ${i + 1}.`);
    if (f.kind === "rating" && f.topics.length === 0) problems.push(`Add at least 1 topic to “${label}”.`);
    if (f.kind === "poll" && f.topics.length < 2) problems.push(`Give the poll “${label}” at least 2 options.`);
    if (f.topics.length > MAX_TOPICS_PER_FOCUS) problems.push(`“${label}” has more than ${MAX_TOPICS_PER_FOCUS} lines.`);
  });
  const names = parsed.map((f) => f.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) problems.push("Give each focus topic a different name.");
  if (hasRating && criteria.length < 1) problems.push("Add at least 1 criterion.");
  if (criteria.length > MAX_CRITERIA) problems.push(`Use at most ${MAX_CRITERIA} criteria.`);
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
          focusTopics: parsed.map((f) => ({ name: f.name, kind: f.kind, topics: f.topics })),
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
    <form onSubmit={submit} className="slab h-fit rounded-[24px] bg-white p-6" noValidate>
      <h2 className="font-display text-3xl font-extrabold">New presentation</h2>

      <label className="mt-5 block font-semibold">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="2027 planning offsite" className={field} />
      </label>

      <fieldset className="mt-6">
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
            const over = f.topics.length > MAX_TOPICS_PER_FOCUS;
            const kind = KINDS.find((k) => k.id === f.kind)!;
            return (
              <li key={f.key} className="rounded-2xl border-2 border-ink p-4 pl-6" style={{ boxShadow: `inset 6px 0 0 ${topicColor(i)}` }}>
                <div role="radiogroup" aria-label={`Question type for focus topic ${i + 1}`} className="flex flex-wrap gap-1.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      role="radio"
                      aria-checked={f.kind === k.id}
                      onClick={() => update(f.key, { kind: k.id })}
                      className={`rounded-full border-2 border-ink px-3 py-1 text-sm font-bold ${f.kind === k.id ? "bg-ink text-white" : "bg-white hover:bg-canvas"}`}
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
                      className="mb-0.5 rounded-xl border-2 border-ink px-3 py-2 text-sm font-bold"
                      aria-label={`Remove focus topic ${i + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {f.kind !== "words" && (
                  <label className="mt-3 block text-sm font-semibold">
                    <span className="flex justify-between">
                      <span>
                        {f.kind === "poll" ? "Options" : "Topics"} <span className="font-normal text-ink-soft">(one per line)</span>
                      </span>
                      <span className={over ? "font-bold text-[#c2193f]" : "font-normal text-ink-soft"}>
                        {f.topics.length}/{MAX_TOPICS_PER_FOCUS}
                      </span>
                    </span>
                    <textarea
                      value={f.topicsText}
                      onChange={(e) => update(f.key, { topicsText: e.target.value })}
                      rows={4}
                      placeholder={PLACEHOLDER[f.kind].list}
                      className={`${field} text-base`}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          disabled={focus.length >= MAX_FOCUS_TOPICS}
          onClick={() => setFocus((list) => [...list, blank(nextKey.current++)])}
          className="mt-3 w-full rounded-2xl border-2 border-dashed border-ink py-3 font-bold hover:bg-canvas disabled:opacity-40"
        >
          + Add focus topic
        </button>
      </fieldset>

      {hasRating && (
        <>
          <label className="mt-6 block font-semibold">
            Criteria <span className="font-normal text-ink-soft">(one per line, used for every rated topic)</span>
            <textarea value={criteriaText} onChange={(e) => setCriteriaText(e.target.value)} rows={3} className={field} />
          </label>

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

      <p className="font-display mt-5 rounded-xl bg-canvas px-3 py-2 text-lg font-bold" aria-live="polite">
        {hasRating && `${ratingTopics * criteria.length} ratings`}
        {hasRating && otherQuestions > 0 && " + "}
        {otherQuestions > 0 && `${otherQuestions} ${otherQuestions === 1 ? "question" : "questions"}`} per person
      </p>

      {touched && problems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm font-semibold text-[#c2193f]">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#c2193f]">
          {error}
        </p>
      )}
      {created && !error && (
        <p role="status" className="mt-3 text-sm font-semibold text-[#0b7a59]">
          Created presentation {created}. Its links and QR code are in the list.
        </p>
      )}

      <button type="submit" disabled={busy} className="key font-display mt-5 w-full rounded-xl bg-violet py-3 text-xl font-bold text-white">
        {busy ? "Creating…" : "Create presentation"}
      </button>
    </form>
  );
}
