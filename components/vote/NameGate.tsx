"use client";

import { useState } from "react";
import { MAX_AUTHOR } from "@/lib/boards";
import { BLOCKED_MESSAGE, hasBadWords } from "@/lib/profanity";

// Names on (team activities, sessions.named): before the first question the phone asks once for a
// name, which goes with every answer. Kept per presentation on the phone (liverate:author:<code>).

export function NameGate({ title, initial, onDone }: { title: string; initial: string; onDone: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const [problem, setProblem] = useState(false);
  const clean = name.trim().replace(/\s+/g, " ").slice(0, MAX_AUTHOR);

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (!clean) return;
    if (hasBadWords(clean)) {
      setProblem(true);
      return;
    }
    onDone(clean);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <form onSubmit={start} className="slab animate-rise flex flex-col gap-4 rounded-2xl bg-white p-6">
        <div>
          <p className="text-sm font-semibold text-ink-soft">{title}</p>
          <h1 className="font-display mt-1 text-[1.9rem] leading-tight font-semibold tracking-tight">What should we call you?</h1>
          <p className="mt-2 text-[0.95rem] text-ink-soft">This is a team activity, so your answers show your name. You only type it once.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gate-name" className="text-sm font-bold text-ink-soft">
            Your name
          </label>
          <input
            id="gate-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setProblem(false);
            }}
            required
            autoFocus
            maxLength={MAX_AUTHOR}
            autoComplete="given-name"
            placeholder="Your name"
            className="w-full rounded-xl border border-line-strong px-4 py-3 text-lg"
          />
        </div>
        {problem && (
          <p role="alert" className="rounded-lg border border-error px-3 py-2 text-sm font-semibold text-error">
            {BLOCKED_MESSAGE.replace("off the board", "off the screen")}
          </p>
        )}
        <button type="submit" disabled={!clean} className="key rounded-xl bg-primary px-6 py-3.5 text-lg font-bold text-white">
          Start
        </button>
      </form>
    </main>
  );
}
