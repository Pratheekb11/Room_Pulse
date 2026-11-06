"use client";

import { useState } from "react";
import { splitLines } from "@/lib/validation";

type Call = (path: string, init?: RequestInit) => Promise<Response>;

const field = "mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-2";

export function NewSessionForm({ call, onCreated }: { call: Call; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [scaleMax, setScaleMax] = useState(5);
  const [lowLabel, setLowLabel] = useState("Low");
  const [highLabel, setHighLabel] = useState("High");
  const [topicsText, setTopicsText] = useState("");
  const [criteriaText, setCriteriaText] = useState("Impact\nEffectiveness\nFeasibility");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const topics = splitLines(topicsText);
  const criteria = splitLines(criteriaText);
  const problems: string[] = [];
  if (!title.trim()) problems.push("Add a title.");
  if (topics.length < 1) problems.push("Add at least 1 topic.");
  if (topics.length > 50) problems.push("Use at most 50 topics.");
  if (criteria.length < 1) problems.push("Add at least 1 criterion.");
  if (criteria.length > 10) problems.push("Use at most 10 criteria.");
  if (!lowLabel.trim() || !highLabel.trim()) problems.push("Both scale labels are needed.");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problems.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await call("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify({ title, scaleMax, lowLabel, highLabel, topics, criteria }),
      });
      const body = (await res.json()) as { code: string };
      setCreated(body.code);
      setTitle("");
      setTopicsText("");
      await onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="slab h-fit rounded-[24px] bg-white p-6 lg:sticky lg:top-6" noValidate>
      <h2 className="font-display text-3xl font-extrabold">New session</h2>

      <label className="mt-5 block font-semibold">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Q3 roadmap review" className={field} />
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

      <label className="mt-4 block font-semibold">
        Topics <span className="font-normal text-ink-soft">(one per line)</span>
        <textarea
          value={topicsText}
          onChange={(e) => setTopicsText(e.target.value)}
          rows={6}
          placeholder={"Self-serve onboarding\nUsage-based pricing\nMobile app"}
          className={field}
        />
      </label>

      <label className="mt-4 block font-semibold">
        Criteria <span className="font-normal text-ink-soft">(one per line)</span>
        <textarea value={criteriaText} onChange={(e) => setCriteriaText(e.target.value)} rows={4} className={field} />
      </label>

      <p className="font-display mt-4 rounded-xl bg-canvas px-3 py-2 text-lg font-bold" aria-live="polite">
        {topics.length} {topics.length === 1 ? "topic" : "topics"} × {criteria.length}{" "}
        {criteria.length === 1 ? "criterion" : "criteria"} = {topics.length * criteria.length} ratings per person
      </p>

      {problems.length > 0 && (title || topicsText) && (
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
          Created session {created}. Its links and QR code are in the list.
        </p>
      )}

      <button
        type="submit"
        disabled={busy || problems.length > 0}
        className="key font-display mt-5 w-full rounded-xl bg-violet py-3 text-xl font-bold text-white"
      >
        {busy ? "Creating…" : "Create session"}
      </button>
    </form>
  );
}
