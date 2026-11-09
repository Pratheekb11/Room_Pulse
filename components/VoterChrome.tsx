"use client";

import { useState } from "react";
import { Logo } from "./Logo";
import { ListSheet, SheetButton } from "./ListSheet";
import { Doodle } from "./Doodle";
import { charactersFor } from "@/lib/decor";
import { showStepDots } from "@/lib/progress";

// The frame of the voter's phone page, shared by the real page (VoteApp) and the builder's preview,
// so the preview always looks like the real thing.

/** Logo and points, then the presentation title with its illustration. */
export function VoterHeader({
  title,
  theme,
  decor,
  score,
  children,
}: {
  title: string;
  /** The design id (sessions.theme); picks the illustration. */
  theme: string;
  decor: boolean;
  /** The points pill (and its animations) at the top right. */
  score: React.ReactNode;
  /** Extra lines under the title, e.g. "See live results". */
  children?: React.ReactNode;
}) {
  return (
    <header className="mx-auto max-w-xl px-4 pt-5 @container">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="relative flex items-center gap-2">{score}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <h1 className="font-display min-w-0 text-[clamp(1.7rem,7cqw,2.4rem)] font-semibold leading-[1.02] tracking-tight break-words">{title}</h1>
        {decor && <Doodle character={charactersFor(theme).phone} className="h-20 w-20 shrink-0" />}
      </div>
      <p className="mt-1.5 text-[0.95rem] text-ink-soft">Tap an answer. It saves straight away. Your answers are anonymous.</p>
      {children}
    </header>
  );
}

/** The points pill. */
export function ScorePill({ points }: { points: number }) {
  return (
    <span key={points} className="font-mono animate-pop rounded-full border border-line bg-white px-3 py-1 text-sm tabular-nums" aria-label={`${points} points`}>
      <span className="text-primary">★</span> {points}
    </span>
  );
}

export interface QuestionChip {
  key: string;
  label: string;
  active: boolean;
  finished: boolean;
  /** e.g. "1/2" for a question with several items, shown while unfinished. */
  progress?: string;
}

/** One button saying which question this is; it opens the list of all of them (up and down, never sideways). */
function ChipPicker({ chips, onChip }: { chips: QuestionChip[]; onChip: (index: number) => void }) {
  const [open, setOpen] = useState(false);
  const at = Math.max(0, chips.findIndex((c) => c.active));
  return (
    <>
      <SheetButton className="mt-2.5 py-1.5" kicker={`Question ${at + 1} of ${chips.length}:`} label={chips[at]?.label ?? ""} onClick={() => setOpen(true)} />
      {open && <ChipList chips={chips} onChip={onChip} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Every question, what's done ticked, the one on screen marked. */
export function ChipList({ chips, onChip, onClose }: { chips: QuestionChip[]; onChip: (index: number) => void; onClose: () => void }) {
  return (
    <ListSheet
      title="Questions"
      currentAttr="step"
      rows={chips.map((c, i) => ({
        key: c.key,
        label: c.label,
        mark: c.finished ? "✓" : String(i + 1),
        note: !c.finished ? c.progress : undefined,
        current: c.active,
        done: c.finished,
      }))}
      onPick={onChip}
      onClose={onClose}
    />
  );
}

/** Sticky bar: answers done, and a button to jump to any question. */
export function VoterProgress({ done, total, chips, onChip }: { done: number; total: number; chips: QuestionChip[]; onChip: (index: number) => void }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="sticky top-0 z-20 mt-4 border-b border-line-strong bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto max-w-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="h-4 flex-1 overflow-hidden rounded-full border border-line-strong bg-white"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-label="Answers completed"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),color-mix(in_srgb,var(--color-primary)_55%,white))] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-display shrink-0 text-base font-bold tabular-nums">
            {done} / {total} done
          </span>
        </div>
        {chips.length > 1 && <ChipPicker chips={chips} onChip={onChip} />}
      </div>
    </div>
  );
}

/** Back, a dot per step (or "3 / 10" when there are many), Next. */
export function StepNav({ current, steps, onGo }: { current: number; steps: { label: string; done: boolean }[]; onGo: (index: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" onClick={() => onGo(current - 1)} disabled={current === 0} className="key shrink-0 rounded-lg bg-white px-3.5 py-2.5 font-bold whitespace-nowrap">
        ← Back
      </button>
      {!showStepDots(steps.length) ? (
        <span className="font-display text-base font-bold tabular-nums text-ink-soft">
          {current + 1} / {steps.length}
        </span>
      ) : (
        <div className="flex min-w-0 flex-wrap justify-center gap-1.5" aria-label="Steps">
          {steps.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onGo(i)}
              aria-label={`Go to ${s.label}${s.done ? " (done)" : ""}`}
              aria-current={i === current ? "step" : undefined}
              className={`h-2.5 rounded-full border border-ink transition-all ${i === current ? "w-6 bg-ink" : s.done ? "w-2.5 bg-mint" : "w-2.5 bg-white"}`}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onGo(current + 1)}
        disabled={current === steps.length - 1}
        className="key shrink-0 rounded-lg bg-primary px-3.5 py-2.5 font-bold whitespace-nowrap text-white"
      >
        Next →
      </button>
    </div>
  );
}

/** "Level 2 of 5" (and the item's question for Score items), then the question's description. */
export function StepIntro({ level, levels, name, description }: { level: number; levels: number; name?: string; description?: string | null }) {
  return (
    <>
      {levels > 1 && (
        <p className="text-sm font-bold text-ink-soft">
          Level {level} of {levels}
          {name ? `: ${name}` : ""}
        </p>
      )}
      {description && <p className="mt-1 mb-2 rounded-lg bg-white px-3 py-2 text-[15px] leading-snug text-ink break-words">{description}</p>}
    </>
  );
}
