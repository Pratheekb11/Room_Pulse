"use client";

import { Confetti } from "../Confetti";
import { Credit } from "../Credit";
import { Doodle } from "../Doodle";
import type { Character } from "@/lib/decor";
import type { SaveStatus } from "@/lib/vote-queue";

/**
 * Shown once every question is answered: what they answered (each with a tick; finishing locks the answers, see lib/finish-lock.ts), where to
 * look next (the live results when shared, else the big screen) and an honest saving status. The confetti uses the
 * design's own option colours.
 */
export function ThankYou({
  title,
  doodle,
  statuses,
  celebrate,
  questions,
  resultsHref,
  raise,
  onSeeQuestions,
}: {
  title: string;
  /** Fun illustration shown above the tick. */
  doodle?: Character;
  statuses: Record<string, SaveStatus>;
  celebrate: boolean;
  /** The questions answered, in order. */
  questions: string[];
  /** Set when the presenter shows results on phones (it can appear while this screen is open). */
  resultsHref?: string;
  /** The "Raise an open point" button, when the presenter allows it. */
  raise?: React.ReactNode;
  /** Set when the presentation has a Q&A: people come back to vote on new questions. */
  onSeeQuestions?: () => void;
  /** Back to the first question, answers kept. */
}) {
  const values = Object.values(statuses);
  const saving = values.some((s) => s === "saving" || s === "retrying");
  const closed = values.some((s) => s === "closed");
  return (
    <main className="flex min-h-dvh flex-col">
      {celebrate && <Confetti />}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        {doodle && <Doodle character={doodle} className="mb-6 h-28 w-28 sm:h-36 sm:w-36" />}
        <svg viewBox="0 0 64 64" className="h-20 w-20" aria-hidden>
          <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-line)" strokeWidth="3" />
          <circle
            cx="32"
            cy="32"
            r="29"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            className="origin-center -rotate-90 animate-[draw_700ms_var(--ease-out-soft)_both]"
          />
          <path d="M20 33l8 8 16-17" fill="none" stroke="var(--color-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100" className="animate-[draw_500ms_300ms_var(--ease-out-soft)_both]" />
        </svg>
        <h1 className="font-display animate-rise mt-8 text-[clamp(2.5rem,12vw,4rem)] leading-none text-ink [animation-delay:200ms]">Thank you.</h1>
        <p className="animate-rise mt-4 max-w-xs text-[17px] leading-relaxed text-ink-soft [animation-delay:320ms]">
          Your answers to <span className="text-ink">{title}</span> are in.{" "}
          {onSeeQuestions
            ? "New questions keep coming in, so check back to vote on them."
            : resultsHref
              ? "See what the room thinks, live."
              : "Look up at the big screen to see what the room thinks."}
        </p>

        {questions.length > 0 && (
          <ul aria-label="Your answers" className="animate-rise mt-6 w-full max-w-sm space-y-1.5 text-left [animation-delay:380ms]">
            {questions.map((q, i) => (
              <li key={i} data-answered className="flex items-start gap-2.5 rounded-lg bg-white px-3 py-2 text-sm">
                <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden>
                  <circle cx="10" cy="10" r="9" fill="var(--color-primary)" />
                  <path d="M6 10.5l2.6 2.6L14 7.6" fill="none" stroke="var(--color-white)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="min-w-0 text-ink">{q}</span>
              </li>
            ))}
          </ul>
        )}

        {onSeeQuestions && (
          <button type="button" onClick={onSeeQuestions} className="key animate-rise mt-6 rounded-xl bg-primary px-6 py-3 font-bold text-white [animation-delay:420ms]">
            See the room&apos;s questions
          </button>
        )}
        {resultsHref && (
          // pops in: the presenter can turn on shared results while this screen is open
          <a href={resultsHref} className={`key animate-pop mt-4 rounded-xl px-6 py-3 font-bold ${onSeeQuestions ? "bg-white" : "bg-primary text-white"}`}>
            See live results
          </a>
        )}
        {raise}
        <p role="status" aria-live="polite" className="font-mono animate-fade mt-8 text-xs text-muted [animation-delay:600ms]">
          {closed ? (
            <span className="text-error">Voting closed before your last answer was saved.</span>
          ) : saving ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Saving your last answers…
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> All saved
            </span>
          )}
        </p>
      </div>
      <Credit subtle />
    </main>
  );
}
