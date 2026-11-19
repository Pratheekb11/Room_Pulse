"use client";

import { useState, type CSSProperties } from "react";

export interface ActivityItem {
  id: string;
  label: string;
  blurb: string;
  minutes: number;
}

/**
 * The home page's team activities: the first few with what they are and how long they take, and a button
 * that unfolds the rest (the box grows, then the names slide in one after another). Folded names stay in
 * the page but `inert`, so they can't be tabbed to until shown.
 */
export function ActivityList({ items, featured = 4 }: { items: ActivityItem[]; featured?: number }) {
  const [open, setOpen] = useState(false);
  const top = items.slice(0, featured);
  const rest = items.slice(featured);
  return (
    <div>
      <ul aria-label="Team activities" className="grid grid-cols-1">
        {top.map((a, i) => (
          <li key={a.id} style={{ "--i": i } as CSSProperties} className="rule group py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg text-ink transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-1.5">{a.label}</span>
              <span className="text-sm text-muted tabular-nums">{a.minutes} min</span>
            </div>
            <p className="mt-1 text-[15px] leading-snug text-ink-soft">{a.blurb}</p>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <div id="more-activities" className="unfold" data-open={open}>
            <div className="min-h-0 overflow-hidden" inert={!open}>
              <ul aria-label="More team activities" className="grid grid-cols-1 gap-x-8 pb-1 min-[420px]:grid-cols-2">
                {rest.map((a, i) => (
                  <li key={a.id} title={a.blurb} style={{ "--j": i } as CSSProperties} className="unfold-item border-t border-line py-2.5 text-ink-soft">
                    {a.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="more-activities"
            onClick={() => setOpen((o) => !o)}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[15px] text-ink transition-colors hover:border-ink"
          >
            {open ? "Show fewer" : `See all ${items.length} activities`}
            <svg aria-hidden viewBox="0 0 16 16" className={`h-4 w-4 transition-transform duration-500 ease-[var(--ease-out-soft)] ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
