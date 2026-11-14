"use client";

import { useState } from "react";
import { aiOriginKey } from "@/lib/points";
import type { AiReport } from "@/lib/types";

const MESSAGES: Record<string, string> = {
  ai_off: "Turn on AI insights for this presentation first (on your presentations page).",
  ai_unavailable: "AI isn't set up on this site yet.",
  ai_limit: "You've used today's AI allowance. It resets at midnight (UTC).",
  ai_failed: "The AI couldn't do that just now. Try again in a moment.",
  too_few_answers: "Wait until at least 3 people have answered.",
  account_required: "AI features need an account.",
};

const btn = "rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[clamp(0.85rem,0.95vw,1.05rem)] font-bold hover:bg-canvas disabled:opacity-50";

/**
 * Owner only, when AI insights are on: a summary of the whole presentation (headline, overview,
 * an insight per question, next steps). The latest one is saved, so it's still here after a refresh
 * and goes into the report. Next steps can be put on the open point list in one tap.
 */
export function AiOverview({
  code,
  report,
  onReport,
  questions,
  people,
  onOpen,
  taken,
  onAddPoint,
}: {
  code: string;
  report: AiReport | null;
  onReport: (report: AiReport) => void;
  /** Every question's id and name, in order (insights link to them). */
  questions: { id: string; name: string }[];
  /** People who have answered so far. */
  people: number;
  /** Opens a question by its place in `questions`; left out when there's only one. */
  onOpen?: (index: number) => void;
  /** Origin keys already on the open point list. */
  taken: Set<string>;
  /** Puts a next step on the open point list; false when it couldn't be added. */
  onAddPoint: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(code)}/ai`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "overview" }),
      });
      const data = (await res.json().catch(() => ({}))) as AiReport & { error?: string };
      if (!res.ok) throw new Error(MESSAGES[String(data.error)] ?? "Something went wrong. Try again.");
      onReport(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addPoint(action: string) {
    setAdding(action);
    setError(null);
    const ok = await onAddPoint({ title: action.slice(0, 200), source: "ai", originKey: aiOriginKey(action) });
    if (!ok) setError("That couldn't be added to open points. It may already be there.");
    setAdding(null);
  }

  const insights = (report?.questions ?? [])
    .map((q) => ({ ...q, index: questions.findIndex((x) => x.id === q.focusId) }))
    .filter((q) => q.index !== -1)
    .sort((a, b) => a.index - b.index);
  const newAnswers = report ? people - report.people : 0;

  return (
    <section aria-label="AI summary" className="@container mb-[clamp(0.75rem,1.6vw,1.5rem)] rounded-xl border border-dashed border-line-strong bg-canvas/60 p-[clamp(0.75rem,1.2vw,1.25rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-bold text-ink-soft">AI summary</span>
        <button type="button" className={btn} onClick={() => void run()} disabled={busy}>
          {busy ? "Reading the results…" : report ? "Update the summary" : "Summarise the whole presentation"}
        </button>
        {!report && !busy && <span className="text-sm text-ink-soft">A headline, an insight for each question and next steps. The results are sent to Google Gemini.</span>}
        {report && newAnswers > 0 && !busy && (
          <span className="text-sm font-semibold text-ink-soft">
            {newAnswers} more {newAnswers === 1 ? "person has" : "people have"} answered since.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-3" aria-live="polite">
          <h3 className="font-display text-[clamp(1.3rem,2vw,2.3rem)] font-semibold leading-tight break-words">{report.headline}</h3>
          <p className="mt-1.5 max-w-[80ch] text-[clamp(1rem,1.2vw,1.35rem)] leading-snug break-words">{report.summary}</p>

          <div className="mt-4 grid grid-cols-1 gap-4 @3xl:grid-cols-2">
            {insights.length > 0 && (
              <div>
                <h4 className="font-display text-[clamp(1.05rem,1.3vw,1.5rem)] font-semibold">Question by question</h4>
                <ol className="mt-1.5 flex flex-col gap-2">
                  {insights.map((q) => (
                    <li key={q.focusId} className="rounded-lg border border-line-strong bg-white p-3">
                      {onOpen ? (
                        <button type="button" onClick={() => onOpen(q.index)} className="text-left font-bold underline decoration-primary decoration-2 underline-offset-4 break-words">
                          {q.index + 1}. {questions[q.index].name}
                        </button>
                      ) : (
                        <p className="font-bold break-words">{questions[q.index].name}</p>
                      )}
                      <p className="mt-0.5 text-[0.95rem] text-ink-soft break-words">{q.insight}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {report.actions.length > 0 && (
              <div>
                <h4 className="font-display text-[clamp(1.05rem,1.3vw,1.5rem)] font-semibold">Suggested next steps</h4>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {report.actions.map((a) => {
                    const added = taken.has(aiOriginKey(a));
                    return (
                      <li key={a} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-lg border border-line-strong bg-white p-3">
                        <span className="min-w-0 flex-[1_1_12rem] break-words">{a}</span>
                        {added ? (
                          <span className="shrink-0 text-sm font-bold text-success">✓ On the open point list</span>
                        ) : (
                          <button type="button" onClick={() => void addPoint(a)} disabled={adding !== null} className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">
                            {adding === a ? "Adding…" : "Add to open points"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            Written from {report.people} {report.people === 1 ? "person's" : "people's"} answers (hidden ones left out) on{" "}
            {new Date(report.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. AI can get things wrong, so check before you act
            on it.
          </p>
        </div>
      )}
    </section>
  );
}

/** One question's AI insight, above its results. */
export function AiInsightLine({ report, focusId }: { report: AiReport | null; focusId?: string }) {
  const insight = focusId ? report?.questions.find((q) => q.focusId === focusId)?.insight : undefined;
  if (!insight) return null;
  return (
    <p className="mb-[clamp(0.6rem,1.4vh,1.25rem)] max-w-[80ch] rounded-lg border border-dashed border-line-strong bg-canvas/60 px-3 py-2 text-[clamp(0.95rem,1.15vw,1.3rem)] leading-snug break-words">
      <span className="mr-2 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink-soft">AI insight</span>
      {insight}
    </p>
  );
}
