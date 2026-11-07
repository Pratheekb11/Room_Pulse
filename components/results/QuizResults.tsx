"use client";

import { useEffect, useState } from "react";
import { topicColor } from "@/lib/colors";
import { clockOffset, quizOwnerAction, quizStartConfirmed, quizTimeLeft, type PendingStart } from "@/lib/quiz";
import type { LeaderRow, LiveQuiz, NamedItem, QuizCount } from "@/lib/types";

const LETTERS = "ABCDEFGHIJ";

/** Re-renders a few times a second while `on`, for countdowns. */
function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [on]);
  return now;
}

interface Props {
  code: string;
  focusId: string;
  question: string;
  options: NamedItem[];
  seconds: number;
  live: LiveQuiz | null;
  /** When (this screen's clock) the latest results read arrived. */
  receivedAt: number | null;
  counts: QuizCount[];
  /** Right answer, once this question has been played. */
  revealed: string | null;
  owner: boolean;
  /** The next quiz question, for the "Next question" button. */
  next: { focusId: string; name: string } | null;
  onShowLeaderboard: () => void;
  onNext: (focusId: string) => void;
}

/**
 * One quiz question on the presenter's screen: ready to start, counting down while people answer
 * (without showing what they picked), then the answers with the right one marked.
 */
export function QuizStage({ code, focusId, question, options, seconds, live, receivedAt, counts, revealed, owner, next, onShowLeaderboard, onNext }: Props) {
  // A tap on Start shows the countdown at once, before the next results refresh confirms it.
  const [pending, setPending] = useState<PendingStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Server minus this screen's clock, from the server time in the latest results read.
  const offset = live && receivedAt ? clockOffset(live.now, receivedAt) : 0;

  const here = live?.focusId === focusId ? live : null;
  const confirmed = pending !== null && quizStartConfirmed(pending, live, offset);
  const starting = pending?.focusId === focusId && !confirmed;
  // Forget the tap once the server confirms it: "End now" moves the start back, which would
  // otherwise look like the start hadn't arrived yet and freeze a full countdown on screen.
  if (confirmed) setPending(null);
  const running = starting || (here !== null && here.correctTopicId === null);
  const now = useTick(running);
  const left = starting ? seconds * 1000 : here ? quizTimeLeft(here, now, offset) : 0;
  const ended = !starting && here !== null && left === 0;
  const right = here?.correctTopicId ?? revealed;
  const mine = counts.filter((c) => c.focusId === focusId);
  const total = mine.reduce((s, c) => s + c.n, 0);
  const showAnswers = !running && (ended || total > 0);
  const action = quizOwnerAction({ running, ended, total, hasNext: next !== null });

  async function control(body: object) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/sessions/${encodeURIComponent(code)}/quiz`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      return true;
    } catch {
      setPending(null);
      setError("That didn't work. Check your internet and try again.");
      return false;
    }
  }
  const start = (id: string) => {
    setPending({ focusId: id, at: Date.now() });
    void control({ action: "start", focusId: id });
  };

  const btn = "rounded-full border border-line-strong px-4 py-2 text-[clamp(0.9rem,1vw,1.1rem)] font-bold";

  return (
    <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
      <div className="mb-[clamp(0.75rem,2vh,1.5rem)] flex flex-wrap items-start justify-between gap-4">
        <h2 className="font-display min-w-0 flex-1 text-[clamp(1.6rem,2.8vw,3.2rem)] leading-tight font-semibold break-words">{question}</h2>
        {running && (
          <div className="flex shrink-0 flex-col items-center" role="timer" aria-live="off">
            <span className={`font-display text-[clamp(2.6rem,5vw,5.5rem)] leading-none font-semibold tabular-nums ${left <= 5000 ? "text-primary" : ""}`}>
              {Math.ceil(left / 1000)}
            </span>
            <span className="text-sm font-semibold text-ink-soft">seconds left</span>
          </div>
        )}
      </div>

      {running && (
        <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-canvas" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear" style={{ width: `${(left / (seconds * 1000)) * 100}%` }} />
        </div>
      )}

      <ul className="grid grid-cols-1 gap-[clamp(0.5rem,1vw,1rem)] sm:grid-cols-2">
        {options.map((o, i) => {
          const n = mine.find((c) => c.topicId === o.id)?.n ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const isRight = showAnswers && right === o.id;
          const dim = showAnswers && right !== null && !isRight;
          return (
            <li
              key={o.id}
              className={`relative flex items-center gap-3 overflow-hidden rounded-xl border-2 p-[clamp(0.7rem,1.2vw,1.3rem)] transition-opacity ${
                isRight ? "border-success" : "border-line-strong"
              } ${dim ? "opacity-45" : ""}`}
            >
              {showAnswers && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 transition-[width] duration-700"
                  style={{ width: `${pct}%`, backgroundColor: `color-mix(in srgb, ${topicColor(i)} 45%, white)` }}
                />
              )}
              <span
                className="font-display relative flex h-[clamp(2.2rem,3vw,3.2rem)] w-[clamp(2.2rem,3vw,3.2rem)] shrink-0 items-center justify-center rounded-lg border border-line-strong font-semibold"
                style={{ backgroundColor: topicColor(i) }}
              >
                {LETTERS[i]}
              </span>
              <span className="relative min-w-0 flex-1 text-[clamp(1.05rem,1.7vw,2rem)] leading-tight font-bold break-words">{o.name}</span>
              {showAnswers && (
                <span className="font-display relative shrink-0 text-[clamp(1.1rem,1.6vw,1.9rem)] font-semibold tabular-nums">
                  {isRight && <span className="mr-1 text-success">✓</span>}
                  {n}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[clamp(1rem,1.3vw,1.4rem)] font-semibold text-ink-soft" aria-live="polite">
          {running
            ? `${total} answered`
            : ended || total > 0
              ? `${total} answered`
              : owner
                ? "Start when everyone has the QR code open."
                : "Waiting for the presenter to start this question."}
        </p>
        {owner && (
          <div className="flex flex-wrap gap-2">
            {action === "end" ? (
              <button
                type="button"
                onClick={() => {
                  setPending(null);
                  void control({ action: "end" });
                }}
                className={`${btn} bg-white hover:bg-canvas`}
              >
                End now
              </button>
            ) : (
              <>
                {(ended || total > 0) && (
                  <button type="button" onClick={onShowLeaderboard} className={`${btn} bg-white hover:bg-canvas`}>
                    Leaderboard
                  </button>
                )}
                {action === "next" && next ? (
                  <button
                    type="button"
                    onClick={() => {
                      onNext(next.focusId);
                      start(next.focusId);
                    }}
                    className={`${btn} border-primary bg-primary text-white`}
                  >
                    Next question →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => start(focusId)}
                    className={`${btn} ${action === "again" ? "bg-white hover:bg-canvas" : "border-primary bg-primary text-white"}`}
                  >
                    {action === "again" ? "Run it again" : "Start question"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </section>
  );
}

/** Top players, biggest score first. */
export function Leaderboard({ rows }: { rows: LeaderRow[] }) {
  if (rows.length === 0)
    return <p className="py-16 text-center text-[clamp(1.2rem,1.8vw,2rem)] font-semibold text-ink-soft">Scores will appear here after the first question.</p>;
  const medal = ["bg-sun", "bg-canvas", "bg-[color-mix(in_srgb,var(--color-primary)_25%,white)]"];
  return (
    <ol className="flex flex-col gap-[clamp(0.4rem,0.8vw,0.9rem)]" aria-label="Leaderboard">
      {rows.map((p, i) => (
        <li
          key={`${i}:${p.nickname}`}
          className={`animate-pop flex items-center gap-[clamp(0.75rem,1.2vw,1.5rem)] rounded-xl border border-line-strong p-[clamp(0.6rem,1vw,1.1rem)] ${medal[i] ?? "bg-white"}`}
        >
          <span className="font-display w-[2ch] shrink-0 text-center text-[clamp(1.4rem,2.2vw,2.6rem)] font-semibold tabular-nums">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-[clamp(1.1rem,1.8vw,2.1rem)] font-bold">{p.nickname}</span>
          <span className="hidden shrink-0 text-[clamp(0.85rem,1vw,1.1rem)] font-semibold text-ink-soft sm:inline">{p.correct} right</span>
          <span className="font-display shrink-0 text-[clamp(1.3rem,2vw,2.4rem)] font-semibold tabular-nums">{p.points.toLocaleString("en-US")}</span>
        </li>
      ))}
    </ol>
  );
}
