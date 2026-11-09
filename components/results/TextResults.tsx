"use client";

import { useEffect, useState } from "react";
import { visibleTexts } from "@/lib/answers";
import { onSurface, topicColor } from "@/lib/colors";
import type { TextAnswer } from "@/lib/types";

const EMPTY = <p className="py-16 text-center text-[clamp(1.2rem,1.8vw,2rem)] font-semibold text-ink-soft">Answers will appear here.</p>;

const pill = "rounded-full border border-line-strong bg-white px-3 py-1 text-[clamp(0.8rem,0.9vw,1rem)] font-bold hover:bg-canvas";

/**
 * Open answers on the presenter's screen, as a wall or a spotlight. The owner can hide one;
 * hidden ones never show on the big screen, only in the owner's "Hidden" list to bring back.
 */
export function TextAnswers({
  code,
  answers,
  focusId,
  view,
  owner,
}: {
  code: string;
  answers: TextAnswer[];
  focusId: string;
  view: "wall" | "spotlight";
  owner: boolean;
}) {
  // Changes made here show at once, before the next results refresh confirms them.
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const merged = answers.map((a) => (a.id in changes ? { ...a, hidden: changes[a.id] } : a));
  const shown = visibleTexts(merged, focusId);
  const hidden = merged.filter((a) => a.focusId === focusId && a.hidden);

  async function setHidden(id: string, value: boolean) {
    setChanges((m) => ({ ...m, [id]: value }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(code)}/text`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, hidden: value }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setChanges((m) => {
        const next = { ...m };
        delete next[id];
        return next;
      });
      setError("That change didn't save. Try again.");
    }
  }

  const onHide = owner ? (id: string) => void setHidden(id, true) : undefined;
  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      {view === "spotlight" ? <TextSpotlight answers={shown} onHide={onHide} /> : <TextWall answers={shown} onHide={onHide} />}
      {owner && hidden.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <button type="button" onClick={() => setShowHidden((v) => !v)} aria-expanded={showHidden} className="text-sm font-bold text-ink-soft underline underline-offset-2">
            {showHidden ? "Close" : "Show"} hidden answers ({hidden.length})
          </button>
          {showHidden && (
            <ul className="mt-3 flex flex-col gap-2">
              {hidden.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-line-strong p-3 text-ink-soft">
                  <span className="min-w-0 break-words">{a.text}</span>
                  <button type="button" className={pill} onClick={() => void setHidden(a.id, false)}>
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-soft">Hidden answers stay in your exports, marked as hidden.</p>
        </div>
      )}
    </div>
  );
}

/** Every answer as a card, newest first. */
export function TextWall({ answers, onHide }: { answers: TextAnswer[]; onHide?: (id: string) => void }) {
  if (answers.length === 0) return EMPTY;
  return (
    <ul className="columns-1 gap-[clamp(0.6rem,1vw,1.2rem)] sm:columns-2 xl:columns-3" aria-label="Answers, newest first">
      {answers.map((a, i) => (
        <li
          key={a.id}
          className="animate-pop mb-[clamp(0.6rem,1vw,1.2rem)] break-inside-avoid rounded-xl border border-line-strong p-[clamp(0.8rem,1.2vw,1.4rem)] text-[clamp(1.05rem,1.45vw,1.7rem)] leading-snug font-semibold break-words"
          style={{ backgroundColor: onSurface(topicColor(i), 30) }}
        >
          {a.text}
          {onHide && (
            <div className="mt-2">
              <button type="button" className={pill} onClick={() => onHide(a.id)} aria-label={`Hide answer: ${a.text}`}>
                Hide
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const SPOTLIGHT_MS = 7000;

/** One answer at a time, large, moving on every few seconds. Arrows step through by hand. */
export function TextSpotlight({ answers, onHide }: { answers: TextAnswer[]; onHide?: (id: string) => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = answers.length;
  const at = n ? i % n : 0;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((x) => x + 1), SPOTLIGHT_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  if (n === 0) return EMPTY;
  const a = answers[at];
  const btn = "rounded-full border border-line-strong bg-white px-4 py-2 text-[clamp(0.9rem,1.1vw,1.2rem)] font-bold hover:bg-canvas";
  return (
    <div className="flex min-h-[48vh] flex-col items-center justify-center gap-6 text-center">
      <blockquote
        key={`${at}:${a.text}`}
        className="font-display animate-rise max-w-[30ch] text-[clamp(1.6rem,4vw,4.4rem)] leading-tight font-semibold break-words"
        aria-live="polite"
      >
        &ldquo;{a.text}&rdquo;
      </blockquote>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="Previous answer">
          ←
        </button>
        <span className="font-display min-w-[6ch] text-[clamp(1rem,1.3vw,1.5rem)] font-semibold tabular-nums text-ink-soft">
          {at + 1} / {n}
        </span>
        <button type="button" className={btn} onClick={() => setI((x) => (x + 1) % n)} aria-label="Next answer">
          →
        </button>
        <button type="button" className={btn} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? "Play" : "Pause"}
        </button>
        {onHide && (
          <button type="button" className={btn} onClick={() => onHide(a.id)}>
            Hide
          </button>
        )}
      </div>
    </div>
  );
}
