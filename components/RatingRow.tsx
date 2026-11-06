"use client";

import { useRef } from "react";
import { readableOn } from "@/lib/colors";
import type { SaveStatus } from "@/lib/vote-queue";

const STATUS_TEXT: Record<SaveStatus, string> = {
  saving: "Saving…",
  saved: "Saved ✓",
  retrying: "Retrying…",
  error: "Not saved. Tap again.",
  closed: "Not saved: voting is closed",
};

const STATUS_CLASS: Record<SaveStatus, string> = {
  saving: "text-ink-soft",
  saved: "text-[#0b7a59]",
  retrying: "text-[#9a5b00]",
  error: "text-[#c2193f]",
  closed: "text-[#c2193f]",
};

interface Props {
  topicName: string;
  criterionName: string;
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  value: number | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  color: string;
  onRate: (score: number) => void;
}

const FACES = ["😖", "🙁", "😐", "🙂", "🤩"];
/** Emoji for a score, spread across the scale (only shown on scales up to 7). */
export const faceFor = (score: number, scaleMax: number) =>
  FACES[Math.round(((score - 1) / Math.max(1, scaleMax - 1)) * (FACES.length - 1))];

export function RatingRow(p: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const scores = Array.from({ length: p.scaleMax }, (_, i) => i + 1);
  const cols = p.scaleMax <= 7 ? p.scaleMax : Math.ceil(p.scaleMax / 2);
  const fg = readableOn(p.color);
  const labelId = `${p.topicName}-${p.criterionName}`.replace(/\W+/g, "-");
  const focusIndex = p.value ? p.value - 1 : 0;
  const faces = p.scaleMax <= 7;

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % p.scaleMax;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + p.scaleMax) % p.scaleMax;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = p.scaleMax - 1;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    p.onRate(next + 1);
  }

  return (
    <div className="py-4 first:pt-1 last:pb-1">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span id={labelId} className="text-[1.05rem] font-semibold leading-tight">
          {p.criterionName}
        </span>
        <span aria-live="polite" className={`shrink-0 text-xs font-semibold ${p.status ? STATUS_CLASS[p.status] : ""}`}>
          {p.status ? STATUS_TEXT[p.status] : ""}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(44px, 1fr))` }}
      >
        {scores.map((score, i) => {
          const selected = p.value === score;
          return (
            <button
              key={score}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${p.criterionName} for ${p.topicName}: ${score}`}
              tabIndex={i === focusIndex ? 0 : -1}
              disabled={p.disabled}
              onClick={() => p.onRate(score)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`key font-display flex min-h-11 min-w-11 flex-col items-center justify-center rounded-2xl font-bold ${
                faces ? "h-[4.25rem] gap-0.5" : "h-12 text-xl"
              } ${selected ? "animate-pop translate-y-[3px] shadow-[var(--shadow-key-down)]" : "bg-white"} ${
                p.value && !selected ? "opacity-60" : ""
              }`}
              style={selected ? { backgroundColor: p.color, color: fg } : undefined}
            >
              {faces && (
                <span aria-hidden className={`text-[1.7rem] leading-none ${selected ? "" : "grayscale-[35%]"}`}>
                  {faceFor(score, p.scaleMax)}
                </span>
              )}
              <span className={faces ? "text-sm leading-none" : ""}>{score}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between text-xs font-medium text-ink-soft">
        <span>{p.lowLabel}</span>
        <span>{p.highLabel}</span>
      </div>
    </div>
  );
}
