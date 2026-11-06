"use client";

import { readableOn, topicColor } from "@/lib/colors";
import type { TopicItem } from "@/lib/types";
import type { SaveStatus } from "@/lib/vote-queue";

const LETTERS = "ABCDEFGHIJ";

const STATUS_TEXT: Partial<Record<SaveStatus, string>> = {
  saving: "Saving…",
  saved: "Saved ✓",
  retrying: "Retrying…",
  error: "Not saved. Tap again.",
  closed: "Not saved: voting is closed",
};

interface Props {
  question: string;
  options: TopicItem[];
  color: string;
  value: string | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  onPick: (topicId: string) => void;
}

/** Single-choice poll: big lettered answer tiles. */
export function PollCard({ question, options, color, value, status, disabled, onPick }: Props) {
  return (
    <section className="slab overflow-hidden rounded-[24px] bg-white" aria-labelledby="poll-q">
      <header className="px-5 py-4" style={{ backgroundColor: color, color: readableOn(color) }}>
        <p className="text-sm font-semibold opacity-80">Poll: pick one</p>
        <h2 id="poll-q" className="font-display text-2xl font-extrabold leading-tight break-words">
          {question}
        </h2>
      </header>
      <div role="radiogroup" aria-labelledby="poll-q" className="flex flex-col gap-3 p-5">
        {options.map((o, i) => {
          const selected = value === o.id;
          const c = topicColor(i);
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onPick(o.id)}
              className={`key flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-lg font-bold ${
                selected ? "animate-pop translate-y-[3px] shadow-[var(--shadow-key-down)]" : "bg-white"
              } ${value && !selected ? "opacity-60" : ""}`}
              style={selected ? { backgroundColor: c, color: readableOn(c) } : undefined}
            >
              <span
                className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-ink text-base font-extrabold"
                style={{ backgroundColor: selected ? "white" : c, color: selected ? "#1a1446" : readableOn(c) }}
                aria-hidden
              >
                {LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1 break-words">{o.name}</span>
              {selected && <span aria-hidden>✓</span>}
            </button>
          );
        })}
        <p aria-live="polite" className="h-4 text-right text-xs font-semibold text-ink-soft">
          {status ? STATUS_TEXT[status] : value ? "" : "You can change your pick until voting closes."}
        </p>
      </div>
    </section>
  );
}
