"use client";

import { useState } from "react";
import type { Row } from "@/lib/list-edit";
import { MAX_CRITERIA } from "@/lib/validation";
import { ListEditor } from "../ListEditor";

const input = "mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2";

export interface ScoringProps {
  scaleMax: number;
  setScaleMax: (n: number) => void;
  lowLabel: string;
  setLowLabel: (s: string) => void;
  highLabel: string;
  setHighLabel: (s: string) => void;
  criteria: Row[];
  setCriteria: (rows: Row[]) => void;
  /** People have already given scores: the range can't change. */
  locked: boolean;
  counts: Record<string, number>;
  /** More than one Score items question shares these settings. */
  shared: boolean;
}

/**
 * How Score items are scored: the range, what the ends mean and, only if asked for, more than one thing to score
 * each item on (Impact and Effort by default made every new question a grid).
 */
export function ScoringSettings(p: ScoringProps) {
  const [many, setMany] = useState(p.criteria.length > 1);
  return (
    <section className="mt-3 rounded-lg bg-canvas p-3" aria-labelledby="scoring-h">
      <h4 id="scoring-h" className="text-sm font-semibold">
        How people score
      </h4>
      <p id="scale-h" className="mt-2 text-sm font-semibold">
        Scores go from
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-labelledby="scale-h" className="flex gap-1.5">
          {[5, 10].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={p.scaleMax === n}
              disabled={p.locked}
              onClick={() => p.setScaleMax(n)}
              className={`rounded-full border border-line-strong px-3 py-1 text-sm font-bold disabled:opacity-60 ${p.scaleMax === n ? "bg-ink text-white" : "bg-white hover:bg-canvas"}`}
            >
              1 to {n}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          or 1 to
          <input
            type="number"
            min={3}
            max={10}
            value={p.scaleMax}
            disabled={p.locked}
            aria-label="Highest score"
            onChange={(e) => p.setScaleMax(Math.min(10, Math.max(3, Number(e.target.value) || 5)))}
            className="w-16 rounded-lg border border-line-strong bg-white px-2 py-1 text-base text-ink disabled:bg-canvas disabled:text-ink-soft"
          />
        </label>
      </div>
      {p.locked && <p className="mt-1.5 text-xs text-ink-soft">People have already given scores, so the range is locked. Reset the votes to change it.</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          1 means
          <input value={p.lowLabel} onChange={(e) => p.setLowLabel(e.target.value)} maxLength={30} placeholder="Low" className={input} />
        </label>
        <label className="block text-sm font-semibold">
          {p.scaleMax} means
          <input value={p.highLabel} onChange={(e) => p.setHighLabel(e.target.value)} maxLength={30} placeholder="High" className={input} />
        </label>
      </div>
      {many ? (
        <ListEditor
          label="Score each item on"
          hint="For example Impact or Effort. People give every item a score for each of these."
          noun="measure"
          items={p.criteria}
          onChange={p.setCriteria}
          max={MAX_CRITERIA}
          maxLength={60}
          answers={p.counts}
        />
      ) : (
        <button type="button" onClick={() => setMany(true)} className="mt-3 text-sm font-semibold underline underline-offset-4">
          + Score on more than one thing (like Impact and Effort)
        </button>
      )}
      {p.shared && <p className="mt-2 text-xs text-ink-soft">Every &ldquo;Score items&rdquo; question uses these settings.</p>}
    </section>
  );
}
