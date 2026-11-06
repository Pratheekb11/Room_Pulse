"use client";

import { useState } from "react";
import { readableOn } from "@/lib/colors";
import type { SaveStatus } from "@/lib/vote-queue";

const MAX = 3;

interface Props {
  question: string;
  color: string;
  value: string[] | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  onSend: (words: string[]) => void;
}

/** Word cloud answers: up to 3 short entries, sent together. */
export function WordsCard({ question, color, value, status, disabled, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const words = value ?? [];
  const full = words.length >= MAX;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const w = draft.trim().replace(/\s+/g, " ").toLowerCase();
    if (!w || full || words.includes(w)) return setDraft("");
    onSend([...words, w]);
    setDraft("");
  }

  const statusText =
    status === "saving" ? "Sending…" : status === "saved" ? "Sent ✓" : status === "retrying" ? "Retrying…" : status === "closed" ? "Not sent: voting is closed" : status === "error" ? "Not sent. Try again." : "";

  return (
    <section className="slab overflow-hidden rounded-[24px] bg-white" aria-labelledby="words-q">
      <header className="px-5 py-4" style={{ backgroundColor: color, color: readableOn(color) }}>
        <p className="text-sm font-semibold opacity-80">Word cloud: up to {MAX} answers</p>
        <h2 id="words-q" className="font-display text-2xl font-extrabold leading-tight break-words">
          {question}
        </h2>
      </header>
      <div className="p-5">
        <form onSubmit={add} className="flex gap-2">
          <label htmlFor="word-input" className="sr-only">
            Your answer
          </label>
          <input
            id="word-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={40}
            disabled={disabled || full}
            placeholder={full ? "That's 3, nice!" : "Type a word or short phrase"}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-2xl border-2 border-ink px-4 py-3 text-lg font-semibold"
          />
          <button type="submit" disabled={disabled || full || !draft.trim()} className="key rounded-2xl bg-violet px-5 font-bold text-white">
            Send
          </button>
        </form>

        <ul className="mt-4 flex min-h-11 flex-wrap gap-2" aria-label="Your answers">
          {words.map((w) => (
            <li key={w} className="animate-pop flex items-center gap-1 rounded-full border-2 border-ink bg-sun py-1 pl-3 pr-1 font-bold">
              {w}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSend(words.filter((x) => x !== w))}
                aria-label={`Remove ${w}`}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/60"
              >
                ×
              </button>
            </li>
          ))}
          {words.length === 0 && <li className="py-2 text-sm text-ink-soft">Your answers show up here.</li>}
        </ul>
        <p aria-live="polite" className="mt-2 flex justify-between text-xs font-semibold text-ink-soft">
          <span>
            {words.length}/{MAX} used
          </span>
          <span>{statusText}</span>
        </p>
      </div>
    </section>
  );
}
