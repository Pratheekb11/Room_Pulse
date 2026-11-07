"use client";

import { useState } from "react";
import { MAX_TEXT_ANSWER } from "@/lib/validation";
import type { SaveStatus } from "@/lib/vote-queue";
import { haptic } from "../Burst";
import { CardShell, saveText } from "./CardShell";

interface Props {
  question: string;
  color: string;
  value: string | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  onSend: (text: string) => void;
}

/** Open answer: one short answer in the voter's own words. They can change it later. */
export function TextCard({ question, color, value, status, disabled, onSend }: Props) {
  const [draft, setDraft] = useState(value ?? "");
  const clean = draft.trim().replace(/\s+/g, " ");
  const unchanged = value !== undefined && clean === value;
  const left = MAX_TEXT_ANSWER - draft.length;

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!clean || unchanged) return;
    haptic();
    onSend(clean);
  }

  return (
    <CardShell id="text-q" color={color} how="Write your answer" question={question}>
      <form onSubmit={send} className="flex flex-col gap-3 p-5">
        <label htmlFor="text-answer" className="sr-only">
          Your answer
        </label>
        <textarea
          id="text-answer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TEXT_ANSWER}
          rows={4}
          disabled={disabled}
          placeholder="Type here…"
          className="w-full resize-none rounded-xl border border-line-strong px-4 py-3 text-lg leading-snug"
        />
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs font-semibold tabular-nums ${left < 20 ? "text-error" : "text-ink-soft"}`}>{left} left</span>
          <button type="submit" disabled={disabled || !clean || unchanged} className="key rounded-xl bg-primary px-6 py-3 font-bold text-white">
            {value === undefined ? "Send" : "Update"}
          </button>
        </div>
        <p aria-live="polite" className="min-h-4 text-right text-xs font-semibold text-ink-soft">
          {saveText(status) || (value !== undefined ? "Sent. You can change it until voting closes." : "Your answer is anonymous.")}
        </p>
      </form>
    </CardShell>
  );
}
