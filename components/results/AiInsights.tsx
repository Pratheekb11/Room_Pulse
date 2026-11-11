"use client";

import { useState } from "react";
import type { QaItem } from "@/lib/types";

type Summary = { themes: { title: string; summary: string; count: number }[]; actions: string[]; answers: number };

const MESSAGES: Record<string, string> = {
  ai_off: "Turn on AI insights for this presentation first (on your presentations page).",
  ai_unavailable: "AI isn't set up on this site yet.",
  ai_limit: "You've used today's AI allowance. It resets at midnight (UTC).",
  ai_failed: "The AI couldn't do that just now. Try again in a moment.",
  too_few_answers: "Wait for at least 3 answers first.",
  account_required: "AI features need an account.",
};

async function post(code: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/sessions/${encodeURIComponent(code)}/ai`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(MESSAGES[String(data.error)] ?? "Something went wrong. Try again.");
  return data;
}

const btn = "rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[clamp(0.85rem,0.95vw,1.05rem)] font-bold hover:bg-canvas disabled:opacity-50";

/**
 * Owner only, when AI insights are on: themes and next steps from open answers or audience
 * questions, and (for Q&A) questions that ask the same thing, with a one-tap "hide the repeats".
 */
export function AiInsights({ code, focusId, kind, questions = [] }: { code: string; focusId: string; kind: "text" | "qa"; questions?: QaItem[] }) {
  const [busy, setBusy] = useState<"summary" | "duplicates" | "hide" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<string[][] | null>(null);

  async function run(action: "summary" | "duplicates") {
    setBusy(action);
    setError(null);
    try {
      const data = await post(code, { action, focusId });
      if (action === "summary") setSummary(data as unknown as Summary);
      else setGroups((data.groups as string[][]) ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  // In each group keep the most-voted question; hide the others.
  async function hideRepeats() {
    if (!groups) return;
    setBusy("hide");
    setError(null);
    try {
      for (const g of groups) {
        const live = g.map((id) => byId.get(id)).filter((q): q is QaItem => Boolean(q && !q.hidden));
        live.sort((a, b) => b.votes - a.votes);
        for (const q of live.slice(1)) {
          const res = await fetch(`/api/admin/sessions/${encodeURIComponent(code)}/qa`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: q.id, hidden: true }),
          });
          if (!res.ok) throw new Error("Some questions couldn't be hidden. Try again.");
        }
      }
      setGroups([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="AI insights" className="mb-[clamp(0.75rem,1.6vw,1.5rem)] rounded-xl border border-dashed border-line-strong bg-canvas/60 p-[clamp(0.75rem,1.2vw,1.25rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-bold text-ink-soft">AI insights</span>
        <button type="button" className={btn} onClick={() => void run("summary")} disabled={busy !== null}>
          {busy === "summary" ? "Reading answers…" : summary ? "Summarise again" : "Summarise answers"}
        </button>
        {kind === "qa" && (
          <button type="button" className={btn} onClick={() => void run("duplicates")} disabled={busy !== null}>
            {busy === "duplicates" ? "Looking…" : "Find repeated questions"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {error}
        </p>
      )}

      {summary && (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2" aria-live="polite">
          <div>
            <h3 className="font-display text-[clamp(1.05rem,1.3vw,1.5rem)] font-semibold">Themes</h3>
            <ol className="mt-1.5 flex flex-col gap-2">
              {summary.themes.map((t) => (
                <li key={t.title} className="rounded-lg border border-line-strong bg-white p-3">
                  <p className="font-bold">
                    {t.title} <span className="font-semibold text-ink-soft">· {t.count}</span>
                  </p>
                  <p className="text-[0.95rem] text-ink-soft">{t.summary}</p>
                </li>
              ))}
            </ol>
          </div>
          {summary.actions.length > 0 && (
            <div>
              <h3 className="font-display text-[clamp(1.05rem,1.3vw,1.5rem)] font-semibold">Suggested next steps</h3>
              <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5">
                {summary.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-ink-soft md:col-span-2">
            From {summary.answers} {summary.answers === 1 ? "answer" : "answers"} (hidden ones left out). AI can get things wrong, so check before you act on it.
          </p>
        </div>
      )}

      {groups && (
        <div className="mt-3" aria-live="polite">
          {groups.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">No repeated questions found.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {groups.map((g) => (
                  <li key={g.join()} className="rounded-lg border border-line-strong bg-white p-3">
                    <p className="text-xs font-bold text-ink-soft">These ask the same thing</p>
                    <ul className="mt-1 list-disc pl-5">
                      {g.map((id) => (
                        <li key={id}>
                          {byId.get(id)?.text ?? "(question removed)"}{" "}
                          <span className="text-ink-soft">({byId.get(id)?.votes ?? 0} votes)</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <button type="button" className={`${btn} mt-2`} onClick={() => void hideRepeats()} disabled={busy !== null}>
                {busy === "hide" ? "Hiding…" : "Hide the repeats (keep the most-voted)"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
