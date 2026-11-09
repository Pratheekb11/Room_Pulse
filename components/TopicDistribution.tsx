"use client";

import { useEffect, useRef } from "react";
import { scaleColor, topicColor } from "@/lib/colors";
import { agreement } from "@/lib/insights";
import { avg, cellKey, criterionHistograms, fmt1, sumAggs, type Agg } from "@/lib/stats";
import type { NamedItem, ScoreBucket } from "@/lib/types";
import { faceFor } from "./RatingRow";

interface Props {
  topics: { item: NamedItem & { description?: string | null }; index: number }[];
  current: number;
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  dist: ScoreBucket[];
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  onMove: (i: number) => void;
  onClose: () => void;
}

/** One column per score: how many people gave 1, 2, 3… */
function Columns({ counts, scaleMax, tall }: { counts: number[]; scaleMax: number; tall?: boolean }) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  return (
    <div className={`flex items-end gap-[clamp(0.25rem,0.6vw,0.75rem)] ${tall ? "h-[clamp(9rem,26vh,18rem)]" : "h-[clamp(6rem,15vh,10rem)]"}`}>
      {counts.map((n, i) => {
        const c = scaleColor(i + 1, scaleMax);
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="font-display text-[clamp(0.9rem,1.3vw,1.6rem)] font-semibold tabular-nums leading-none">{n}</span>
            <span className="mb-1 text-[clamp(0.65rem,0.8vw,0.9rem)] font-semibold text-ink-soft">{pct}%</span>
            <div
              className="w-full rounded-t-lg border border-b-0 border-black/10 transition-[height] duration-700 ease-out"
              style={{ height: `${(n / max) * 100}%`, minHeight: n ? 6 : 0, backgroundColor: c.bg }}
            />
            <div className="w-full border-t border-line-strong pt-1 text-center">
              {scaleMax <= 7 && <span aria-hidden className="block text-[clamp(0.9rem,1.3vw,1.5rem)] leading-none">{faceFor(i + 1, scaleMax)}</span>}
              <span className="text-[clamp(0.8rem,1vw,1.15rem)] font-bold">{i + 1}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TopicDistribution(p: Props) {
  const { item, index } = p.topics[p.current];
  const closeRef = useRef<HTMLButtonElement>(null);
  const per = criterionHistograms(p.dist, item.id, p.criteria.map((c) => c.id), p.scaleMax);
  const all = new Array<number>(p.scaleMax).fill(0);
  for (const counts of Object.values(per)) counts.forEach((n, i) => (all[i] += n));
  const overall = avg(sumAggs(p.criteria.map((c) => p.cells.get(cellKey(item.id, c.id)))));
  const agree = agreement(all, p.scaleMax);
  const total = all.reduce((a, b) => a + b, 0);

  const { onClose, onMove, current } = p;
  const count = p.topics.length;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onMove(Math.min(count - 1, current + 1));
      else if (e.key === "ArrowLeft") onMove(Math.max(0, current - 1));
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, onMove, current, count]);

  // One chart per row on a phone, then 2, 3 and (for many measures) 4 as the screen widens; literal class names for Tailwind.
  const n = p.criteria.length;
  const wide = n <= 2 ? "" : n <= 6 || n === 9 ? " @4xl:grid-cols-3" : " @4xl:grid-cols-3 @6xl:grid-cols-4";

  return (
    <div role="dialog" aria-modal="true" aria-label={`How people scored ${item.name}`} className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <div className="flex min-h-full flex-col gap-[clamp(0.75rem,1.6vh,1.5rem)] px-[clamp(1rem,2.2vw,2.75rem)] py-[clamp(0.75rem,2vh,1.75rem)]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[clamp(0.9rem,1.1vw,1.25rem)] font-semibold text-ink-soft">
              <span aria-hidden className="h-4 w-4 rounded-full" style={{ backgroundColor: topicColor(index) }} />
              How people scored
            </p>
            <h2 className="font-display text-[clamp(2rem,3.6vw,4.2rem)] font-semibold leading-[1] tracking-tight break-words">{item.name}</h2>
            {item.description && (
              <p className="mt-2 text-[clamp(1rem,1.3vw,1.5rem)] leading-snug text-ink-soft break-words">{item.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onMove(Math.max(0, current - 1))} disabled={current === 0} className="key rounded-lg bg-white px-4 py-2 font-bold">
              ← Prev
            </button>
            <span className="font-display px-1 font-bold tabular-nums">
              {current + 1} / {count}
            </span>
            <button type="button" onClick={() => onMove(Math.min(count - 1, current + 1))} disabled={current === count - 1} className="key rounded-lg bg-white px-4 py-2 font-bold">
              Next →
            </button>
            <button ref={closeRef} type="button" onClick={onClose} className="key ml-2 rounded-lg bg-ink px-4 py-2 font-bold text-white">
              Close
            </button>
          </div>
        </header>

        <section className="slab grid gap-[clamp(1rem,2vw,2.5rem)] rounded-xl bg-white p-[clamp(1rem,1.8vw,2rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
          <div className="flex flex-col justify-center">
            <p className="text-[clamp(0.9rem,1.1vw,1.2rem)] font-semibold text-ink-soft">Average across all measures</p>
            <p className="font-display text-[clamp(3rem,6vw,7rem)] font-semibold leading-none">{fmt1(overall)}</p>
            <p className="mt-2 text-[clamp(1rem,1.2vw,1.4rem)] font-semibold">
              {total} {total === 1 ? "rating" : "ratings"}
              {agree && <span className="text-ink-soft">, {agree.label.toLowerCase()}</span>}
            </p>
            <p className="mt-1 text-[clamp(0.85rem,1vw,1.1rem)] text-ink-soft">
              1 = {p.lowLabel}, {p.scaleMax} = {p.highLabel}
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[clamp(0.95rem,1.2vw,1.35rem)] font-semibold">Each measure</h3>
            <Columns counts={all} scaleMax={p.scaleMax} tall />
          </div>
        </section>

        <div className="@container">
        <div className={`grid gap-[clamp(0.75rem,1.4vw,1.5rem)] grid-cols-1${n > 1 ? " @md:grid-cols-2" : ""}${wide}`}>
          {p.criteria.map((c) => (
            <section key={c.id} className="rounded-xl border border-line-strong bg-white p-[clamp(0.75rem,1.2vw,1.4rem)]">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="truncate text-[clamp(1rem,1.3vw,1.5rem)] font-semibold" title={c.name}>
                  {c.name}
                </h3>
                <span className="font-display text-[clamp(1.1rem,1.5vw,1.8rem)] font-semibold tabular-nums">
                  {fmt1(avg(p.cells.get(cellKey(item.id, c.id))))}
                </span>
              </div>
              <Columns counts={per[c.id]} scaleMax={p.scaleMax} />
            </section>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
