"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/answers";
import type { SaveStatus } from "@/lib/vote-queue";
import { haptic } from "../Burst";
import { CardShell, saveText } from "./CardShell";

interface Props {
  question: string;
  color: string;
  min: number;
  max: number;
  unit: string | null;
  value: number | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  onSend: (value: number) => void;
}

/** Slider step: whole numbers for small whole ranges, otherwise about 200 steps across the range. */
function sliderStep(min: number, max: number): number {
  const span = max - min;
  if (Number.isInteger(min) && Number.isInteger(max) && span <= 200) return 1;
  const raw = span / 200;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
}

/** Answer with a number: type it, or drag the slider. */
export function NumberCard({ question, color, min, max, unit, value, status, disabled, onSend }: Props) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const parsed = draft.trim() === "" ? null : Number(draft.replace(/,/g, ""));
  const valid = parsed !== null && Number.isFinite(parsed) && parsed >= min && parsed <= max;
  const step = sliderStep(min, max);
  const sliderValue = valid ? parsed : (min + max) / 2;
  const unchanged = valid && parsed === value;

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || unchanged) return;
    haptic();
    onSend(parsed);
  }

  const range = `${formatNumber(min)} to ${formatNumber(max)}${unit ? ` ${unit}` : ""}`;
  let hint = saveText(status);
  if (!hint && parsed !== null && !valid) hint = `Pick a number from ${range}.`;
  if (!hint && value !== undefined) hint = "Sent. You can change it until voting closes.";

  return (
    <CardShell id="number-q" color={color} how={`Answer with a number from ${range}`} question={question}>
      <form onSubmit={send} className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <label htmlFor="number-answer" className="sr-only">
            Your number
          </label>
          <input
            id="number-answer"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={disabled}
            placeholder="Your number"
            aria-invalid={parsed !== null && !valid}
            className="font-display min-w-0 flex-1 rounded-xl border border-line-strong px-4 py-3 text-3xl font-semibold tabular-nums aria-invalid:border-error"
          />
          {unit && <span className="shrink-0 text-lg font-bold text-ink-soft">{unit}</span>}
        </div>
        <div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={sliderValue}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Choose with a slider"
            className="h-10 w-full accent-[var(--color-primary)]"
          />
          <div className="flex justify-between text-xs font-semibold text-ink-soft">
            <span>{formatNumber(min)}</span>
            <span>{formatNumber(max)}</span>
          </div>
        </div>
        <button type="submit" disabled={disabled || !valid || unchanged} className="key rounded-xl bg-primary py-3 text-lg font-bold text-white">
          {value === undefined ? "Send" : "Update"}
        </button>
        <p aria-live="polite" className={`min-h-4 text-right text-xs font-semibold ${parsed !== null && !valid ? "text-error" : "text-ink-soft"}`}>
          {hint}
        </p>
      </form>
    </CardShell>
  );
}
