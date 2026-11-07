"use client";

import { useEffect, useState } from "react";
import { TOPIC_COLORS } from "@/lib/colors";
import type { TextAnswer } from "@/lib/types";

const EMPTY = <p className="py-16 text-center text-[clamp(1.2rem,1.8vw,2rem)] font-semibold text-ink-soft">Answers will appear here.</p>;

/** Every answer as a card, newest first. */
export function TextWall({ answers }: { answers: TextAnswer[] }) {
  if (answers.length === 0) return EMPTY;
  return (
    <ul className="columns-1 gap-[clamp(0.6rem,1vw,1.2rem)] sm:columns-2 xl:columns-3" aria-label="Answers, newest first">
      {answers.map((a, i) => (
        <li
          key={`${a.at}:${a.text}`}
          className="animate-pop mb-[clamp(0.6rem,1vw,1.2rem)] break-inside-avoid rounded-xl border border-line-strong p-[clamp(0.8rem,1.2vw,1.4rem)] text-[clamp(1.05rem,1.45vw,1.7rem)] leading-snug font-semibold break-words"
          style={{ backgroundColor: `color-mix(in srgb, ${TOPIC_COLORS[i % TOPIC_COLORS.length]} 30%, white)` }}
        >
          {a.text}
        </li>
      ))}
    </ul>
  );
}

const SPOTLIGHT_MS = 7000;

/** One answer at a time, large, moving on every few seconds. Arrows step through by hand. */
export function TextSpotlight({ answers }: { answers: TextAnswer[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = answers.length;
  const at = n ? i % n : 0;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((x) => x + 1), SPOTLIGHT_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  if (n === 0) return EMPTY;
  const a = answers[at];
  const btn = "rounded-full border border-line-strong bg-white px-4 py-2 text-[clamp(0.9rem,1.1vw,1.2rem)] font-bold hover:bg-canvas";
  return (
    <div className="flex min-h-[48vh] flex-col items-center justify-center gap-6 text-center">
      <blockquote
        key={`${at}:${a.text}`}
        className="font-display animate-rise max-w-[30ch] text-[clamp(1.6rem,4vw,4.4rem)] leading-tight font-semibold break-words"
        aria-live="polite"
      >
        &ldquo;{a.text}&rdquo;
      </blockquote>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => setI((x) => (x - 1 + n) % n)} aria-label="Previous answer">
          ←
        </button>
        <span className="font-display min-w-[6ch] text-[clamp(1rem,1.3vw,1.5rem)] font-semibold tabular-nums text-ink-soft">
          {at + 1} / {n}
        </span>
        <button type="button" className={btn} onClick={() => setI((x) => (x + 1) % n)} aria-label="Next answer">
          →
        </button>
        <button type="button" className={btn} onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? "Play" : "Pause"}
        </button>
      </div>
    </div>
  );
}
