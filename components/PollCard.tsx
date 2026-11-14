"use client";

import { useState } from "react";
import { readableOn, topicColor } from "@/lib/colors";
import { Burst, haptic } from "./Burst";
import type { TopicItem } from "@/lib/types";
import { OptionPicture } from "./Picture";
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
  const [burst, setBurst] = useState<{ id: string; key: number } | null>(null);
  // With pictures, options become tiles, two to a row.
  const pictures = options.some((o) => o.imageId);
  return (
    <section className="slab overflow-hidden rounded-xl bg-white" aria-labelledby="poll-q">
      <header className="px-5 py-4" style={{ backgroundColor: color, color: readableOn(color) }}>
        <p className="text-sm font-semibold opacity-80">Pick one</p>
        <h2 id="poll-q" className="font-display text-2xl font-semibold leading-tight break-words">
          {question}
        </h2>
      </header>
      <div role="radiogroup" aria-labelledby="poll-q" className={`${pictures ? "grid grid-cols-2 items-start" : "flex flex-col"} gap-3 p-5`}>
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
              onClick={() => {
                haptic();
                setBurst({ id: o.id, key: (burst?.key ?? 0) + 1 });
                onPick(o.id);
              }}
              className={`key relative flex min-h-14 rounded-xl text-left font-bold ${pictures ? "flex-col gap-2 p-2 text-base" : "items-center gap-3 px-3 py-2.5 text-lg"} ${
                selected ? "animate-pop " : "bg-white"
              } ${value && !selected ? "opacity-60" : ""}`}
              style={selected ? { backgroundColor: c, color: readableOn(c) } : undefined}
            >
              <OptionPicture id={o.imageId} size="tile" />
              <span className={pictures ? "flex w-full items-center gap-2" : "contents"}>
                <span
                  className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-base font-semibold"
                  style={{ backgroundColor: selected ? "white" : c, color: selected ? "#26251e" : readableOn(c) }}
                  aria-hidden
                >
                  {LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1 break-words">{o.name}</span>
                {selected && <span aria-hidden>✓</span>}
              </span>
              {burst?.id === o.id && <Burst key={burst.key} color={c} />}
            </button>
          );
        })}
        <p aria-live="polite" className={`h-4 text-right text-xs font-semibold text-ink-soft ${pictures ? "col-span-2" : ""}`}>
          {status ? STATUS_TEXT[status] : value ? "" : "You can change your pick until voting closes."}
        </p>
      </div>
    </section>
  );
}
