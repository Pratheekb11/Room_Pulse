"use client";

import { useEffect, useState } from "react";

const OPTIONS = [
  { name: "Self-serve onboarding", color: "#dfa88f" },
  { name: "Usage-based pricing", color: "#9fbbe0" },
  { name: "Offline mode", color: "#9fc9a2" },
  { name: "AI meeting notes", color: "#c0a8dd" },
];
const START = [14, 9, 6, 11];
const STAGES = [
  { label: "Voted", color: "bg-peach" },
  { label: "Counted", color: "bg-mint" },
  { label: "On screen", color: "bg-sky" },
];
const FACES = ["😖", "🙁", "😐", "🙂", "🤩"];

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
      timers.push(setTimeout(() => setStage(1), 380));
      timers.push(
        setTimeout(() => {
          setStage(2);
          setVotes((v) => v.map((n, i) => (i === option ? n + 1 : n)));
        }, 760),
      );
    }, 1900);
    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, []);

  const total = votes.reduce((a, b) => a + b, 0);
  const max = Math.max(...votes);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white" aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="font-mono ml-3 text-xs text-muted">liverate · k7m2qp</span>
      </div>
      <div className="grid grid-cols-1 gap-3 bg-canvas-soft p-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)]">
        {/* phone */}
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Your vote</p>
          <p key={`q-${tap.tick}`} className="animate-rise mt-1 text-[15px] font-medium text-ink">
            {OPTIONS[tap.option].name}
          </p>
          <p className="mt-0.5 text-xs text-muted">Impact</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {FACES.map((f, i) => {
              const on = i + 1 === tap.score && stage >= 0;
              return (
                <span
                  key={`${i}-${on ? tap.tick : "off"}`}
                  className={`flex h-11 flex-col items-center justify-center rounded-lg border text-lg transition-colors ${
                    on ? "animate-pop border-transparent text-white" : "border-line"
                  }`}
                  style={on ? { backgroundColor: OPTIONS[tap.option].color } : undefined}
                >
                  {f}
                </span>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {STAGES.map((s, i) => (
              <span
                key={s.label}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase transition-all duration-300 ${
                  stage >= i ? `${s.color} text-ink` : "bg-line-soft text-muted-soft"
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
        {/* dashboard */}
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">What to build next</p>
            <p className="font-mono text-xs text-muted">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success align-middle" />
              {total} votes
            </p>
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {OPTIONS.map((o, i) => (
              <li key={o.name}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-ink">{o.name}</span>
                  <span className="font-mono text-muted tabular-nums">{Math.round((votes[i] / total) * 100)}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-soft)]"
                    style={{ width: `${(votes[i] / max) * 100}%`, backgroundColor: o.color }}
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
