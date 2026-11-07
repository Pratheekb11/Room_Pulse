"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { QuestionKind } from "@/lib/types";
import { DEMOS, type DemoState, type DemoStep } from "@/lib/walkthrough";
import { topicColor } from "@/lib/colors";
import { useClientValue } from "./useClientValue";

const STEP_MS = 2600;
const MOVE_MS = 750;
const BUILDER_KINDS: { id: QuestionKind; label: string }[] = [
  { id: "rating", label: "Score items" },
  { id: "poll", label: "Pick one" },
  { id: "words", label: "Word cloud" },
  { id: "quiz", label: "Quiz" },
];
const hasOptions = (k: QuestionKind) => k !== "words";

/** The screen as it looks just before the cursor clicks: the step's change isn't there yet. */
function beforeClick(steps: DemoStep[], i: number): DemoState {
  const now = steps[i].state;
  const prev = i > 0 ? steps[i - 1].state : now;
  switch (steps[i].target) {
    case "question":
      return { ...now, question: prev.question };
    case "items":
      return { ...now, items: prev.items };
    case "scale":
      return { ...now, scale: prev.scale };
    case "correct":
      return { ...now, correct: prev.correct };
    case "answer":
      return { ...now, picked: null };
    case "start":
      return { ...now, started: false };
    default:
      return now;
  }
}

/** Text that types itself out, one letter at a time. Give it a new `key` to type again. */
function Typed({ text, animate }: { text: string; animate: boolean }) {
  const [n, setN] = useState(animate ? 0 : text.length);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setN((x) => Math.min(text.length, x + 1)), 28);
    return () => clearInterval(t);
  }, [text, animate]);
  const typing = animate && n < text.length;
  return (
    <>
      {text.slice(0, n)}
      {typing && <span className="ml-px inline-block h-4 w-px animate-pulse bg-ink align-middle" />}
    </>
  );
}

/**
 * "Show me how": a pretend cursor makes a question in a mock builder, a phone answers it, the results show.
 * Plays by itself (unless the visitor prefers less motion); Back / Next step through by hand.
 */
export function HowToDemo({ initial = "rating", compact = false }: { initial?: QuestionKind; compact?: boolean }) {
  const [d, setD] = useState(Math.max(0, DEMOS.findIndex((x) => x.kind === initial)));
  const [i, setI] = useState(0);
  const [arrived, setArrived] = useState("");
  // null: play by itself unless the visitor prefers less motion; true/false once they press Play or Pause
  const [choice, setChoice] = useState<boolean | null>(null);
  // undefined until the page runs in the browser (the home page is static)
  const reduce = useClientValue(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const still = reduce !== false;
  const playing = reduce !== undefined && (choice ?? !still);
  const stage = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0, show: false });
  const [visible, setVisible] = useState(true);

  const demo = DEMOS[d];
  const step = demo.steps[i];
  const last = i === demo.steps.length - 1;
  const key = `${d}-${i}`;
  const phase: "move" | "done" = still || !step.target || arrived === key ? "done" : "move";
  const state = phase === "move" ? beforeClick(demo.steps, i) : step.state;

  // pause while scrolled out of view
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // each step: move the cursor to its target, then "click" (show the change)
  useEffect(() => {
    if (still || !step.target) return;
    const t = setTimeout(() => setArrived(key), MOVE_MS);
    return () => clearTimeout(t);
  }, [key, still, step.target]);

  useEffect(() => {
    if (!playing || !visible) return;
    const t = setTimeout(() => setI((x) => (x + 1) % demo.steps.length), last ? STEP_MS + 1800 : STEP_MS);
    return () => clearTimeout(t);
  }, [playing, visible, i, d, last, demo.steps.length]);

  useLayoutEffect(() => {
    const box = stage.current;
    if (!box) return;
    const el = step.target ? box.querySelector<HTMLElement>(`[data-demo="${step.target}"]`) : null;
    if (!el) return setCursor((c) => ({ ...c, show: false }));
    const a = box.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setCursor({ x: b.left - a.left + Math.min(b.width * 0.6, 60), y: b.top - a.top + b.height * 0.6, show: true });
  }, [d, i, phase, step.target]);

  const pick = (n: number) => {
    setD(n);
    setI(0);
  };
  const go = (n: number) => {
    setChoice(false);
    setI(Math.max(0, Math.min(demo.steps.length - 1, n)));
  };

  return (
    <div className="min-w-0">
      <div role="tablist" aria-label="Question type" className="flex flex-wrap gap-1.5">
        {DEMOS.map((x, n) => (
          <button
            key={x.kind}
            type="button"
            role="tab"
            aria-selected={n === d}
            onClick={() => pick(n)}
            className={`rounded-full border px-3 py-1.5 text-sm font-bold ${n === d ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:bg-canvas"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div
        ref={stage}
        aria-hidden
        className={`relative mt-3 overflow-hidden rounded-xl border border-line bg-canvas-soft p-3 sm:p-4 ${compact ? "h-[360px]" : "h-[380px] sm:h-[400px]"}`}
      >
        {state.screen === "builder" && <Builder state={state} goal={step.state} kindPicked={!(i === 0 && phase === "move")} typing={phase === "done" && !still ? step.target : null} />}
        {state.screen === "phone" && <Phone state={state} goal={step.state} />}
        {state.screen === "results" && <Results state={state} />}
        <svg
          viewBox="0 0 24 24"
          className={`pointer-events-none absolute top-0 left-0 z-10 h-7 w-7 drop-shadow ${still ? "" : "transition-transform duration-700 ease-out"} ${cursor.show ? "opacity-100" : "opacity-0"}`}
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <path d="M4 2l15 10-7 1.5L8.5 21z" fill="#26251e" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        {cursor.show && phase === "done" && !still && (
          <span
            key={`${d}-${i}`}
            className="demo-click pointer-events-none absolute top-0 left-0 z-0 h-8 w-8 rounded-full border-2 border-primary"
            style={{ transform: `translate(${cursor.x - 12}px, ${cursor.y - 12}px)` }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <p className="min-h-12 w-full text-[15px] font-semibold text-ink sm:w-auto sm:flex-1" aria-live={playing ? "off" : "polite"}>
          <span className="mr-2 font-mono text-xs text-muted tabular-nums">
            {i + 1}/{demo.steps.length}
          </span>
          {step.caption}
        </p>
        <div className="ml-auto flex shrink-0 gap-1.5">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="key rounded-lg bg-white px-3 py-2 text-sm font-bold" aria-label="Previous step">
            ←
          </button>
          <button type="button" onClick={() => setChoice(!playing)} className="key rounded-lg bg-white px-3 py-2 text-sm font-bold">
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => (last ? go(0) : go(i + 1))}
            className="key rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white"
            aria-label={last ? "Watch again" : "Next step"}
          >
            {last ? "↺" : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Builder({ state, goal, kindPicked, typing }: { state: DemoState; goal: DemoState; kindPicked: boolean; typing: string | null }) {
  const items = state.items.length ? state.items : hasOptions(state.kind) ? ["", ""] : [];
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-white p-3 text-sm">
      <p className="font-display text-base">Question 1</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {BUILDER_KINDS.map((k) => {
          const on = kindPicked && k.id === state.kind;
          return (
            <span
              key={k.id}
              data-demo={k.id === state.kind ? "kind" : undefined}
              className={`rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-bold ${on ? "bg-ink text-white" : "bg-white"}`}
            >
              {k.label}
            </span>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs font-semibold">What do you want to ask?</p>
      <div data-demo="question" className="mt-1 min-h-9 rounded-lg border border-line-strong px-2.5 py-1.5 text-[15px]">
        {state.question ? (
          <Typed key={`${state.question}-${typing === "question"}`} text={state.question} animate={typing === "question"} />
        ) : (
          <span className="text-muted-soft">Type your question</span>
        )}
      </div>
      {hasOptions(state.kind) && (
        <>
          <p className="mt-2.5 text-xs font-semibold">{state.kind === "rating" ? "Items to score" : "Options"}</p>
          <ul data-demo="items" className="mt-1 flex flex-col gap-1">
            {items.map((it, n) => (
              <li
                key={n}
                data-demo={state.kind === "quiz" && it && it === goal.correct ? "correct" : undefined}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 ${state.kind === "quiz" && it && state.correct === it ? "border-success bg-mint/40" : "border-line-strong"}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: topicColor(n) }} />
                <span className={`truncate ${typing === "items" ? "demo-rise" : ""}`} style={{ animationDelay: `${n * 160}ms` }}>
                  {it || <span className="text-muted-soft">{state.kind === "rating" ? "Item" : "Option"} {n + 1}</span>}
                </span>
                {state.kind === "quiz" && it && state.correct === it && <span className="ml-auto text-xs font-bold text-success">✓ Right answer</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {state.kind === "rating" && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          <span className="font-semibold">Scores go from</span>
          {([5, 10] as const).map((s) => (
            <span
              key={s}
              data-demo={s === 10 ? "scale" : undefined}
              className={`rounded-full border border-line-strong px-2.5 py-0.5 font-bold ${state.scale === s ? "bg-ink text-white" : "bg-white"}`}
            >
              1 to {s}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex justify-end pt-2">
        <span data-demo="create" className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white">
          Create
        </span>
      </div>
    </div>
  );
}

function Phone({ state, goal }: { state: DemoState; goal: DemoState }) {
  return (
    <div className="mx-auto flex h-full w-[220px] flex-col rounded-[28px] border-[5px] border-ink bg-white px-3 pt-5 pb-3 text-sm">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">Room code k7m2qp</p>
      <p className="font-display mt-1 text-base leading-tight">{state.question}</p>
      {state.kind === "rating" && (
        <>
          <p className="mt-3 text-xs text-ink-soft">{state.items[0]}</p>
          <div className="mt-1.5 grid grid-cols-5 gap-1">
            {Array.from({ length: state.scale }, (_, n) => n + 1).map((n) => (
              <span
                key={n}
                data-demo={n === 8 ? "answer" : undefined}
                className={`grid h-8 place-items-center rounded-md border text-xs font-bold ${state.picked && n === 8 ? "demo-pop border-transparent bg-peach" : "border-line"}`}
              >
                {n}
              </span>
            ))}
          </div>
        </>
      )}
      {(state.kind === "poll" || state.kind === "quiz") && (
        <div className="mt-3 flex flex-col gap-1.5">
          {state.kind === "quiz" && <p className="text-xs font-bold text-primary">⏱ 14 seconds left</p>}
          {state.items.map((it, n) => (
            <span
              key={it}
              data-demo={it === goal.picked ? "answer" : undefined}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 font-bold ${state.picked === it ? "demo-pop border-ink bg-sun" : "border-line"}`}
            >
              <span className="grid h-5 w-5 place-items-center rounded text-[10px]" style={{ backgroundColor: topicColor(n) }}>
                {String.fromCharCode(65 + n)}
              </span>
              {it}
            </span>
          ))}
        </div>
      )}
      {state.kind === "words" && (
        <div className="mt-3">
          <div className="flex gap-1.5">
            <span data-demo="answer" className="flex-1 rounded-lg border border-line-strong px-2 py-1.5">
              {state.picked ?? <span className="text-muted-soft">Type a word</span>}
            </span>
            <span className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-white">Send</span>
          </div>
          {state.picked && <span className="demo-pop mt-2 inline-block rounded-full bg-lavender px-2.5 py-0.5 text-xs font-bold">{state.picked} ×</span>}
        </div>
      )}
      <p className="mt-auto text-center text-[10px] text-muted">{state.picked ? "Saved ✓" : "Tap to answer"}</p>
    </div>
  );
}

function Results({ state }: { state: DemoState }) {
  const quizWaiting = state.kind === "quiz" && state.results.length === 0;
  const max = Math.max(1, ...state.results);
  const total = state.results.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Your screen</p>
        <p className="font-mono text-xs text-muted">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success align-middle" />
          live
        </p>
      </div>
      <p className="font-display mt-1 text-lg leading-tight">{state.question}</p>
      {quizWaiting ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-ink-soft">{state.started ? "Question is live: 20 seconds" : "Ready when you are"}</p>
          <span data-demo="start" className={`rounded-lg px-4 py-2 font-bold ${state.started ? "bg-mint text-ink" : "bg-primary text-white"}`}>
            {state.started ? "⏱ Running…" : "Start question"}
          </span>
        </div>
      ) : state.kind === "words" ? (
        <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-x-4 gap-y-1">
          {state.items.map((w, n) => (
            <span key={w} className="demo-rise font-display" style={{ fontSize: `${14 + (state.results[n] / max) * 26}px`, color: topicColor(n), animationDelay: `${n * 120}ms` }}>
              {w}
            </span>
          ))}
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {state.items.map((it, n) => {
            const v = state.results[n] ?? 0;
            const right = state.kind === "quiz" && it === state.correct;
            return (
              <li key={it}>
                <div className="flex justify-between text-[13px]">
                  <span className={right ? "font-bold text-success" : "text-ink"}>
                    {it}
                    {right ? " ✓" : ""}
                  </span>
                  <span className="font-mono text-muted tabular-nums">
                    {state.kind === "rating" ? `${v} / ${state.scale}` : `${Math.round((v / total) * 100)}%`}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="demo-grow h-full rounded-full"
                    style={{ width: `${(state.kind === "rating" ? v / state.scale : v / max) * 100}%`, backgroundColor: topicColor(n) }}
                  />
                </div>
              </li>
            );
          })}
          {state.kind === "quiz" && <li className="mt-1 text-xs text-ink-soft">🏆 Top players: Ace 960 · Kiwi 910 · Max 870</li>}
        </ul>
      )}
    </div>
  );
}
