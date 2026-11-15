"use client";

import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { ListSheet, SheetButton } from "./ListSheet";
import { Doodle } from "./Doodle";
import { CountUp } from "./CountUp";
import { charactersFor } from "@/lib/decor";
import { QuestionPicture } from "./Picture";

// The frame of the big-screen results page, shared by the real page (DashboardApp) and the builder's
// preview, so the preview always looks like the real thing.

/** Logo, title and illustration on the left; live status and the controls row on the right. */
export function ScreenHeader({
  title,
  theme,
  decor,
  status,
  controls,
  compact = false,
}: {
  title: string;
  /** The design id (sessions.theme); picks the illustration. */
  theme: string;
  decor: boolean;
  status: React.ReactNode;
  controls: React.ReactNode;
  /** Fit to screen is on: a smaller title and no illustration, so the results get the room. */
  compact?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      {/* at least 34rem for the title (or the full width): when that and the controls don't fit side by side, the controls wrap below */}
      <div className="min-w-0 flex-[1_1_min(100%,34rem)]">
        <Logo />
        <div className={`flex items-end gap-3 ${compact ? "mt-1" : "mt-2"}`}>
          <h1 className={`font-display min-w-0 font-semibold leading-[0.98] tracking-tight break-words ${compact ? "text-[clamp(1.3rem,1.9vw,2.2rem)]" : "text-[clamp(2rem,3.6vw,4.2rem)]"}`}>{title}</h1>
          {decor && !compact && <Doodle character={charactersFor(theme).screen} className="h-[clamp(4rem,8vw,8.5rem)] w-auto shrink-0" />}
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
      <span className="rounded-full border border-line-strong bg-white px-2.5 py-0.5 text-sm font-bold tabular-nums sm:px-3.5 sm:py-1 sm:text-lg">
        <CountUp value={voters} /> {voters === 1 ? "person" : "people"} voted
      </span>
      <span className={`rounded-full border border-line-strong px-2.5 py-0.5 text-sm font-bold sm:px-3.5 sm:py-1 sm:text-lg ${isOpen ? "bg-mint text-ink" : "bg-ink text-white"}`}>
        {isOpen ? "Voting open" : "Voting closed"}
      </span>
    </>
  );
}

type TabName = { key: string; name: string };

/**
 * "All questions" plus a tab per question. `active` null = all questions.
 * On a narrow screen the tabs fold into one button that opens a list (up and down, never sideways).
 * Container queries, not the viewport: the builder's preview draws this screen at 1280px on any device.
 */
export function QuestionTabs({
  names,
  active,
  onPick,
  compact = false,
}: {
  names: TabName[];
  active: number | null;
  onPick: (index: number | null) => void;
  /** Fit to screen is on: always the one button, so several rows of tabs don't take the results' room. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tab = (on: boolean) =>
    `flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 text-[clamp(0.85rem,1vw,1.1rem)] font-bold ${on ? "bg-ink text-white" : "bg-white"}`;
  return (
    <div className="@container mb-[clamp(0.6rem,1.4vh,1.25rem)]">
      <nav aria-label="Questions" className={compact ? "hidden" : "flex flex-wrap items-center gap-2 @max-xl:hidden"}>
        <button type="button" onClick={() => onPick(null)} aria-current={active === null ? "page" : undefined} className={tab(active === null)}>
          All questions
        </button>
        {names.map((n, i) => (
          <button
            key={n.key}
            type="button"
            onClick={() => onPick(i)}
            aria-current={active === i ? "page" : undefined}
            title={n.name}
            className={`${tab(active === i)} min-w-0 max-w-[26ch]`}
          >
            <span className="truncate">{n.name}</span>
          </button>
        ))}
      </nav>
      <SheetButton
        className={compact ? "" : "@xl:hidden"}
        kicker={active === null ? "Showing" : `Question ${active + 1} of ${names.length}:`}
        label={active === null ? `All questions (${names.length})` : names[active]?.name ?? ""}
        onClick={() => setOpen(true)}
      />
      {open && <QuestionList names={names} active={active} onPick={onPick} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** Every question in a full-screen list, "All questions" first. */
export function QuestionList({ names, active, onPick, onClose }: { names: TabName[]; active: number | null; onPick: (index: number | null) => void; onClose: () => void }) {
  return (
    <ListSheet
      title="Questions"
      currentAttr="page"
      rows={[
        { key: "all", label: "All questions", mark: "≡", current: active === null },
        ...names.map((n, i) => ({ key: n.key, label: n.name, mark: String(i + 1), current: active === i })),
      ]}
      onPick={(i) => onPick(i === 0 ? null : i - 1)}
      onClose={onClose}
    />
  );
}

/** The question's description and picture, above its card. */
export function QuestionDescription({ text, image, question = "" }: { text?: string | null; image?: string | null; question?: string }) {
  if (!text && !image) return null;
  return (
    <>
      {text && <p className="mb-[clamp(0.6rem,1.4vh,1.25rem)] max-w-[70ch] text-[clamp(1rem,1.3vw,1.5rem)] leading-snug text-ink-soft break-words">{text}</p>}
      <QuestionPicture id={image} question={question} where="screen" />
    </>
  );
}

/** The question, as the biggest words on the big screen after the presentation's title. */
export function QuestionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-display mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-tight break-words ${className}`}>{children}</h2>;
}

/** A question's results card with its title. */
export function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
      <QuestionTitle>{title}</QuestionTitle>
      {children}
    </section>
  );
}

const MENU_W = 224; // w-56

/** A row in the More menu. */
export const menuItem = "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left whitespace-nowrap hover:bg-canvas";

/**
 * The controls a presenter needs now and then (Fit to screen, Full screen, the report, editing), out of the
 * way behind one button. Opens below it, inside the screen; Esc or a tap outside closes it.
 */
export function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // undefined: under the button's right edge; a number: shifted from the button's left edge to stay on screen
  const [shift, setShift] = useState<number | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    <div
      ref={box}
      className="relative"
      onKeyDown={(e) => {
        // the menu owns Esc while it's open: it doesn't also take the results back to All questions
        if (!open || e.key !== "Escape") return;
        e.stopPropagation();
        setOpen(false);
        box.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          // near the left edge (a phone, where the row wraps), open to the right, never past the screen's edge
          const rect = box.current?.getBoundingClientRect();
          const room = document.documentElement.clientWidth - 8;
          setShift(!rect || rect.right - MENU_W >= 8 ? undefined : Math.min(0, room - MENU_W - rect.left));
          setOpen((o) => !o);
        }}
        className={`rounded-full border border-line-strong px-3 py-1 ${open ? "bg-ink text-white" : "bg-white hover:bg-canvas"}`}
      >
        More <span aria-hidden>▾</span>
      </button>
      {open && (
        <div
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('[role^="menuitem"]')) setOpen(false);
          }}
          style={shift === undefined ? { right: 0 } : { left: shift }}
          className="animate-[fade_120ms_ease-out] absolute top-full z-30 mt-1.5 flex w-56 flex-col rounded-xl border border-line-strong bg-white p-1.5 shadow-[0_10px_30px_rgb(0_0_0/0.12)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
