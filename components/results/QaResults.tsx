"use client";

import { useState } from "react";
import { qaOrder } from "@/lib/answers";
import type { QaItem } from "@/lib/types";

type Change = { hidden?: boolean; answered?: boolean };

/**
 * Audience questions on the presenter's screen. The owner can mark a question answered or hide it;
 * hidden ones never show on the big screen, only in the owner's "Hidden" list to bring back.
 */
export function QaList({ code, items, focusId, mode, owner }: { code: string; items: QaItem[]; focusId: string; mode: "top" | "new"; owner: boolean }) {
  // Changes made here show at once, before the next results refresh confirms them.
  const [changes, setChanges] = useState<Record<string, Change>>({});
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const merged = items.map((q) => ({ ...q, ...changes[q.id] }));
  const shown = qaOrder(merged, focusId, mode);
  const hidden = merged.filter((q) => q.focusId === focusId && q.hidden);

  async function change(id: string, c: Change) {
    const before = changes[id];
    setChanges((m) => ({ ...m, [id]: { ...m[id], ...c } }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(code)}/qa`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...c }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setChanges((m) => ({ ...m, [id]: before ?? {} }));
      setError("That change didn't save. Try again.");
    }
  }

  const btn = "rounded-full border border-line-strong bg-white px-3 py-1 text-[clamp(0.8rem,0.9vw,1rem)] font-bold hover:bg-canvas";

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      {shown.length === 0 ? (
        <p className="py-16 text-center text-[clamp(1.2rem,1.8vw,2rem)] font-semibold text-ink-soft">Questions from the audience will appear here.</p>
      ) : (
        <ol className="flex flex-col gap-[clamp(0.5rem,0.9vw,1rem)]" aria-label={mode === "top" ? "Questions, most votes first" : "Questions, newest first"}>
          {shown.map((q, i) => {
            const lead = i === 0 && !q.answered && mode === "top";
            return (
              <li
                key={q.id}
                className={`animate-pop flex items-start gap-[clamp(0.75rem,1.2vw,1.5rem)] rounded-xl border border-line-strong p-[clamp(0.75rem,1.2vw,1.4rem)] ${
                  q.answered ? "bg-canvas opacity-70" : lead ? "bg-sun" : "bg-white"
                }`}
              >
                <span className="flex w-[clamp(3rem,4.5vw,5rem)] shrink-0 flex-col items-center rounded-lg border border-line-strong bg-white py-1.5 tabular-nums">
                  <span aria-hidden className="text-[clamp(0.7rem,0.8vw,0.95rem)] leading-none text-primary">▲</span>
                  <span className="font-display text-[clamp(1.3rem,2vw,2.4rem)] leading-tight font-semibold">{q.votes}</span>
                  <span className="sr-only">votes</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`leading-snug font-semibold break-words ${lead ? "text-[clamp(1.25rem,2.2vw,2.6rem)]" : "text-[clamp(1.05rem,1.5vw,1.8rem)]"}`}
                  >
                    {q.text}
                  </p>
                  {(q.answered || owner) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {q.answered && <span className="rounded-full bg-mint px-2.5 py-0.5 text-[clamp(0.75rem,0.85vw,0.95rem)] font-bold">Answered</span>}
                      {owner && (
                        <>
                          <button type="button" className={btn} onClick={() => change(q.id, { answered: !q.answered })}>
                            {q.answered ? "Not answered yet" : "Mark answered"}
                          </button>
                          <button type="button" className={btn} onClick={() => change(q.id, { hidden: true })}>
                            Hide
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {owner && hidden.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <button type="button" onClick={() => setShowHidden((v) => !v)} aria-expanded={showHidden} className="text-sm font-bold text-ink-soft underline underline-offset-2">
            {showHidden ? "Close" : "Show"} hidden questions ({hidden.length})
          </button>
          {showHidden && (
            <ul className="mt-3 flex flex-col gap-2">
              {hidden.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-line-strong p-3 text-ink-soft">
                  <span className="min-w-0 break-words">{q.text}</span>
                  <button type="button" className={btn} onClick={() => change(q.id, { hidden: false })}>
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-soft">People in the audience can&apos;t see hidden questions on their phones.</p>
        </div>
      )}
    </div>
  );
}
