"use client";

import { useEffect, useState } from "react";

const OPTIONS = ["Self-serve onboarding", "Usage-based pricing", "Offline mode", "AI meeting notes"];
const START = [14, 9, 6, 11];
const STAGES = ["Voted", "Counted", "On screen"];

/** Hero mockup: a phone ballot tapping on the left, the room's results updating on the right. */
export function LiveDemo() {
  const [votes, setVotes] = useState(START);
  const [tap, setTap] = useState<{ option: number; score: number; tick: number }>({ option: 0, score: 4, tick: 0 });
  const [stage, setStage] = useState(-1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tick = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = setInterval(() => {
      tick += 1;
      const option = [0, 3, 1, 0, 3, 2, 0, 1][tick % 8];
      const score = [5, 4, 3, 5, 4, 2, 4, 5][tick % 8];
      setTap({ option, score, tick });
      setStage(0);
      timers.push(setTimeout(() => setStage(1), 500));
      timers.push(
        setTimeout(() => {
          setStage(2);
          setVotes((v) => v.map((n, i) => (i === option ? n + 1 : n)));
        }, 1000),
      );
    }, 2600);
    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, []);

  const total = votes.reduce((a, b) => a + b, 0);
  const max = Math.max(...votes);
  const lead = votes.indexOf(max);

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white text-ink" aria-hidden>
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-sm text-muted">
        <span>
          Join code <span className="font-mono text-ink">k7m2qp</span>
        </span>
        <span className="tabular-nums">
          <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary align-middle" />
          {total} votes
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)]">
        {/* phone */}
        <div className="border-b border-line p-5 sm:border-r sm:border-b-0">
          <p className="text-sm text-muted">On a phone</p>
          <p key={`q-${tap.tick}`} className="animate-fade mt-2 min-h-[2.6em] leading-snug text-ink">
            {OPTIONS[tap.option]}
          </p>
          <p className="mt-1 text-sm text-muted">Impact, 1 to 5</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => {
              const on = n === tap.score && stage >= 0;
              return (
                <span
                  key={n}
                  className={`flex h-10 items-center justify-center rounded border text-sm tabular-nums transition-colors duration-300 ${
                    on ? "border-ink bg-ink text-canvas" : "border-line text-muted"
                  }`}
                >
                  {n}
                </span>
              );
            })}
          </div>
          <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {STAGES.map((s, i) => (
              <li key={s} className={`flex items-center gap-1.5 transition-colors duration-300 ${stage >= i ? "text-ink" : "text-muted-soft"}`}>
                <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${stage >= i ? "bg-primary" : "bg-line-strong"}`} />
                {s}
              </li>
            ))}
          </ol>
        </div>
        {/* results */}
        <div className="p-5">
          <p className="text-ink">What should we build next?</p>
          <ul className="mt-4 flex flex-col gap-3.5">
            {OPTIONS.map((name, i) => (
              <li key={name}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className={i === lead ? "text-ink" : "text-ink-soft"}>{name}</span>
                  <span className="text-muted tabular-nums">{Math.round((votes[i] / total) * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-700 ease-[var(--ease-out-soft)] ${i === lead ? "bg-primary" : "bg-muted-soft"}`}
                    style={{ width: `${(votes[i] / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
