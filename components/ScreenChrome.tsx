"use client";

import { Logo } from "./Logo";
import { Doodle } from "./Doodle";
import { CountUp } from "./CountUp";
import { charactersFor } from "@/lib/decor";

// The frame of the big-screen results page, shared by the real page (DashboardApp) and the builder's
// preview, so the preview always looks like the real thing.

/** Logo, title and illustration on the left; live status and the controls row on the right. */
export function ScreenHeader({
  title,
  theme,
  decor,
  status,
  controls,
}: {
  title: string;
  /** The design id (sessions.theme); picks the illustration. */
  theme: string;
  decor: boolean;
  status: React.ReactNode;
  controls: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        <Logo />
        <div className="mt-2 flex items-end gap-3">
          <h1 className="font-display min-w-0 text-[clamp(2rem,3.6vw,4.2rem)] font-semibold leading-[0.98] tracking-tight break-words">{title}</h1>
          {decor && <Doodle character={charactersFor(theme).screen} className="h-[clamp(4rem,8vw,8.5rem)] w-auto shrink-0" />}
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-2.5">{status}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:justify-end">{controls}</div>
      </div>
    </header>
  );
}

/** "12 people voted" and "Voting open / closed" pills (the live badge goes before them). */
export function VotingPills({ voters, isOpen }: { voters: number; isOpen: boolean }) {
  return (
    <>
      <span className="rounded-full border border-line-strong bg-white px-3 py-1 text-base font-bold tabular-nums sm:px-3.5 sm:text-lg">
        <CountUp value={voters} /> {voters === 1 ? "person" : "people"} voted
      </span>
      <span className={`rounded-full border border-line-strong px-3 py-1 text-base font-bold sm:px-3.5 sm:text-lg ${isOpen ? "bg-mint text-ink" : "bg-ink text-white"}`}>
        {isOpen ? "Voting open" : "Voting closed"}
      </span>
    </>
  );
}

/** "All questions" plus a tab per question. `active` null = all questions. */
export function QuestionTabs({ names, active, onPick }: { names: { key: string; name: string }[]; active: number | null; onPick: (index: number | null) => void }) {
  const tab = (on: boolean) =>
    `flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 text-[clamp(0.85rem,1vw,1.1rem)] font-bold ${on ? "bg-ink text-white" : "bg-white"}`;
  return (
    <nav aria-label="Questions" className="mb-[clamp(0.6rem,1.4vh,1.25rem)] flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onPick(null)} aria-current={active === null ? "page" : undefined} className={tab(active === null)}>
        All questions
      </button>
      {names.map((n, i) => (
        <button key={n.key} type="button" onClick={() => onPick(i)} aria-current={active === i ? "page" : undefined} className={tab(active === i)}>
          {n.name}
        </button>
      ))}
    </nav>
  );
}

/** The question's description, above its card. */
export function QuestionDescription({ text }: { text?: string | null }) {
  if (!text) return null;
  return <p className="mb-[clamp(0.6rem,1.4vh,1.25rem)] max-w-[70ch] text-[clamp(1rem,1.3vw,1.5rem)] leading-snug text-ink-soft break-words">{text}</p>;
}

/** A question's results card with its title. */
export function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
      <h2 className="font-display mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-tight break-words">{title}</h2>
      {children}
    </section>
  );
}
