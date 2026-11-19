"use client";

import { useState, type ReactNode } from "react";

/**
 * The rest of a home page list, folded behind a button that unfolds it like a drop-down: the box grows, then
 * the rows inside (`.unfold-item`, `--j`) slide in one after another. Folded rows stay in the page but `inert`,
 * so they can't be tabbed to until shown.
 */
export function Fold({ id, more, children }: { id: string; more: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id={id} className="unfold" data-open={open}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          {children}
        </div>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[15px] text-ink transition-colors hover:border-ink"
      >
        {open ? "Show fewer" : more}
        <svg aria-hidden viewBox="0 0 16 16" className={`h-4 w-4 transition-transform duration-500 ease-[var(--ease-out-soft)] ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
    </>
  );
}
