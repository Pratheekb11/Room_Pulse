"use client";

import { useState } from "react";
import { topicColor } from "@/lib/colors";
import { quadrant, type Quadrant } from "@/lib/insights";
import { avg, cellKey, fmt1, type Agg } from "@/lib/stats";
import type { NamedItem } from "@/lib/types";

interface Props {
  topics: { item: NamedItem; index: number }[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  scaleMax: number;
}

/** Prefer the classic impact (Y) vs feasibility/effort (X) pair when those criteria exist. */
function defaultAxes(criteria: NamedItem[]): [string, string] {
  const find = (re: RegExp) => criteria.find((c) => re.test(c.name))?.id;
  const y = find(/impact|value|benefit/i) ?? criteria[0].id;
  const x = find(/feasib|ease|effort|cost/i) ?? criteria.find((c) => c.id !== y)!.id;
  return [x === y ? criteria.find((c) => c.id !== y)!.id : x, y];
}

const QUAD_STYLE: Record<Quadrant, string> = {
  both_high: "bg-[#e3f7ef]",
  y_high: "bg-[#efe9ff]",
  x_high: "bg-[#fff4d9]",
  both_low: "bg-[#f4f2f8]",
};

export function PriorityMatrix({ topics, criteria, cells, scaleMax }: Props) {
  const [axes, setAxes] = useState<[string, string] | null>(() => (criteria.length >= 2 ? defaultAxes(criteria) : null));
  if (!axes) {
    return <p className="text-xl text-ink-soft">The priority matrix needs at least 2 criteria.</p>;
  }
  const [xId, yId] = axes;
  const xName = criteria.find((c) => c.id === xId)?.name ?? "";
  const yName = criteria.find((c) => c.id === yId)?.name ?? "";
  const pos = (v: number) => ((v - 1) / (scaleMax - 1)) * 100;

  const points = topics
    .map(({ item, index }) => {
      const x = avg(cells.get(cellKey(item.id, xId)));
      const y = avg(cells.get(cellKey(item.id, yId)));
      return x === null || y === null ? null : { item, index, x, y, q: quadrant(x, y, scaleMax) };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p, i, all) => {
      // Stack labels of nearby points so they don't overlap.
      const near = all.slice(0, i).filter((q) => Math.abs(pos(q.x) - pos(p.x)) < 14 && Math.abs(pos(q.y) - pos(p.y)) < 9).length;
      return { ...p, stack: near };
    });

  const quadLabel: Record<Quadrant, string> = {
    both_high: `High ${yName}, high ${xName}`,
    y_high: `High ${yName}, low ${xName}`,
    x_high: `Low ${yName}, high ${xName}`,
    both_low: `Low on both`,
  };

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex items-center gap-2 rounded-full border-2 border-ink bg-white py-0.5 pl-3 pr-1 text-sm font-semibold">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-full bg-transparent px-1 py-0.5 font-bold">
        {criteria.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {select(yId, (v) => setAxes([xId, v]), "Up")}
        {select(xId, (v) => setAxes([v, yId]), "Across")}
      </div>
      <div className="flex gap-3">
        <div className="flex w-8 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-[clamp(0.95rem,1.2vw,1.35rem)] font-extrabold">{yName} →</span>
        </div>
        <div className="flex-1">
          <div
            className="relative aspect-[16/8.2] w-full overflow-hidden rounded-[22px] border-2 border-ink"
            role="img"
            aria-label={`Priority matrix: ${yName} against ${xName}. ${points.map((p) => `${p.item.name}: ${fmt1(p.x)} ${xName}, ${fmt1(p.y)} ${yName}`).join("; ")}`}
          >
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {(["y_high", "both_high", "both_low", "x_high"] as Quadrant[]).map((q) => (
                // Labels sit in the outer corners, away from the crowded centre.
                <div
                  key={q}
                  className={`${QUAD_STYLE[q]} flex p-3 ${q === "both_high" || q === "x_high" ? "justify-end text-right" : ""} ${
                    q === "both_low" || q === "x_high" ? "items-end" : ""
                  }`}
                >
                  <span className="text-[clamp(0.8rem,1vw,1.1rem)] font-bold text-ink-soft">{quadLabel[q]}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-y-0 left-1/2 w-0.5 bg-ink/30" />
            <div className="absolute inset-x-0 top-1/2 h-0.5 bg-ink/30" />
            {/* Two layers (dots, then labels) so no dot is ever drawn over a label. */}
            {points.map((p) => (
              <span
                key={`dot-${p.item.id}`}
                className="absolute block h-[clamp(1rem,1.5vw,1.6rem)] w-[clamp(1rem,1.5vw,1.6rem)] -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-ink transition-[left,bottom] duration-700 ease-out"
                style={{ left: `${pos(p.x)}%`, bottom: `${pos(p.y)}%`, backgroundColor: topicColor(p.index) }}
              />
            ))}
            {points.map((p) => (
              <span
                key={`label-${p.item.id}`}
                className="absolute rounded-md border border-ink/15 bg-white/95 px-1.5 text-center text-[clamp(0.75rem,0.95vw,1.05rem)] font-bold leading-tight whitespace-nowrap transition-[left,bottom] duration-700 ease-out"
                style={{
                  left: `${pos(p.x)}%`,
                  bottom: `${pos(p.y)}%`,
                  // Beside the dot (left of it near the right edge); nearby points stack downwards.
                  transform:
                    pos(p.x) > 72
                      ? `translate(calc(-100% - 0.9rem), calc(50% + ${p.stack * 1.6}em))`
                      : `translate(0.9rem, calc(50% + ${p.stack * 1.6}em))`,
                }}
              >
                {p.item.name}
              </span>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-sm font-semibold text-ink-soft">
            <span>1</span>
            <span className="text-[clamp(0.95rem,1.2vw,1.35rem)] font-extrabold text-ink">{xName} →</span>
            <span>{scaleMax}</span>
          </div>
        </div>
      </div>
      {points.length === 0 && <p className="text-center font-semibold text-ink-soft">Topics appear here once they have ratings on both criteria.</p>}
    </div>
  );
}
