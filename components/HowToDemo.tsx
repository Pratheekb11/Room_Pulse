"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LeaderRow, LiveQuiz, QuestionKind, SessionInfo, TopicItem } from "@/lib/types";
import { DEMOS, frameFit, type DemoState, type DemoStep, type DemoTarget } from "@/lib/walkthrough";
import { blank, startRows, type QuestionDraft } from "@/lib/builder";
import { topicColor } from "@/lib/colors";
import { cellKey } from "@/lib/stats";
import { themeStyle } from "@/lib/themes";
import { useClientValue } from "./useClientValue";
import { StartChoices } from "./admin/builder/StartChoices";
import { TypePicker } from "./admin/builder/TypePicker";
import { QuestionEditor } from "./admin/builder/QuestionEditor";
import { StepIntro, StepNav, VoterHeader, VoterProgress } from "./VoterChrome";
import { TopicCard } from "./TopicCard";
import { PollCard } from "./PollCard";
import { WordsCard } from "./WordsCard";
import { QuizCard } from "./vote/QuizCard";
import { ResultCard, ScreenHeader, VotingPills } from "./ScreenChrome";
import { LiveBadge } from "./LiveBadge";
import { OverallBars } from "./OverallBars";
import { PollBars } from "./PollResults";
import { WordCloud } from "./WordCloud";
import { Leaderboard, QuizStage } from "./results/QuizResults";

// "See how it works": the builder, a phone and the results screen, each drawn with the app's own pieces (so the
// walkthrough changes when they do), shrunk to fit the box and moved like a camera so the pretend cursor's target
// is always in view. They're a picture: `inert`, so nothing in them can be tabbed into or tapped.

const STEP_MS = 2600;
const MOVE_MS = 750;
const KEY = 9001; // the demo question's key: never one of the builder's own (its ids are built from it)
const CODE = "how-to-demo";
const TITLE = "Team meeting";
const FOCUS = "how-to-demo-q";
const PLAYERS: LeaderRow[] = [
  { nickname: "Ace", points: 960, correct: 1 },
  { nickname: "Kiwi", points: 910, correct: 1 },
  { nickname: "Max", points: 870, correct: 1 },
];
const noop = () => {};

/** The screen as it looks just before the cursor clicks: the step's change isn't there yet. */
function beforeClick(steps: DemoStep[], i: number): DemoState {
  const now = steps[i].state;
  const prev = i > 0 ? steps[i - 1].state : now;
  switch (steps[i].target) {
    case "blank":
      return { ...now, screen: "start" };
    case "kind":
      return { ...now, screen: "types" };
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

/** Counts from 0 to `to`, one every `ms`, while `animate`; straight to `to` otherwise. */
function useCountUp(to: number, animate: boolean, ms: number) {
  const [n, setN] = useState(animate ? 0 : to);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setN((x) => Math.min(to, x + 1)), ms);
    return () => clearInterval(t);
  }, [to, animate, ms]);
  return animate ? n : to;
}

/** Ticks every second, so the pretend screens' "Live" badge and quiz clocks stay current. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const options = (items: string[]): TopicItem[] => items.map((name, n) => ({ id: `${FOCUS}-${n}`, name, focusId: FOCUS }));
const optionId = (items: string[], name: string | null) => (name === null ? undefined : `${FOCUS}-${items.indexOf(name)}`);

/** What the cursor points at (and the camera follows) on the drawn screen. */
function findTarget(root: HTMLElement, target: DemoTarget, state: DemoState): HTMLElement | null {
  const withText = (sel: string, text: string | null) =>
    text === null ? null : ([...root.querySelectorAll<HTMLElement>(sel)].find((el) => el.textContent?.trim().includes(text)) ?? null);
  switch (target) {
    case "blank":
      return root.querySelector('[data-start="blank"]');
    case "kind":
      return root.querySelector(`[aria-describedby="kind-hint-${state.kind}"]`);
    case "question":
      return root.querySelector(`#question-${KEY}`);
    case "items":
      return root.querySelector('[role="group"] input');
    case "scale":
      return withText('[aria-labelledby="scoring-h"] [role="radio"]', "1 to 10");
    case "correct":
      return withText(`[aria-labelledby="right-${KEY}"] [role="radio"]`, state.correct);
    case "create":
      return root.querySelector('[data-demo="create"]');
    case "start":
      // after the tap the same button says End now
      return withText("button", "Start question") ?? withText("button", "End now");
    case "answer":
      if (state.kind === "rating") return root.querySelector('[role="radio"][aria-label$=": 8"]');
      if (state.kind === "words") return root.querySelector('[aria-labelledby="words-q"] input');
      return withText('[role="radio"]', state.picked);
    default:
      return root.querySelector('[aria-label="Leaderboard"]');
  }
}

type Spot = { x: number; y: number } | null;

/**
 * One drawn screen: laid out `width` pixels wide (a phone: `width` × `height`, in a bezel), shrunk to fit the box,
 * and moved up when it's taller than the box so the target stays in view. Tells the demo where the target is.
 */
function Frame({
  width,
  height,
  whole,
  bezel = false,
  still,
  find,
  watch,
  onSpot,
  children,
}: {
  width: number | ((boxW: number) => number);
  height?: number;
  /** Show all of it, shrinking as needed, at least `aspect` × its width tall (a big screen). */
  whole?: number;
  bezel?: boolean;
  still: boolean;
  find: (root: HTMLElement) => HTMLElement | null;
  /** Changes whenever what's drawn changes, so the target is looked up again. */
  watch: string;
  onSpot: (spot: Spot) => void;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [contentH, setContentH] = useState(0);
  const [aim, setAim] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const edge = bezel ? 10 : 0;

  useEffect(() => {
    const b = box.current;
    const c = content.current;
    if (!b || !c) return;
    const measure = () => {
      setSize((s) => (s && s.w === b.clientWidth && s.h === b.clientHeight ? s : { w: b.clientWidth, h: b.clientHeight }));
      setContentH(c.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const w = size ? (typeof width === "number" ? width : width(size.w)) : typeof width === "number" ? width : 560;
  const fit = size ? frameFit({ boxW: size.w - edge, boxH: size.h - edge, width: w, height, contentH, target: aim && { top: aim.top, bottom: aim.top + aim.height }, whole: whole !== undefined }) : null;

  // Where the target sits on the drawn screen (layout pixels, before scaling). After every render, since typing and
  // answers move it; it only sets state when the spot really changed, so it settles.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root = content.current;
    const el = root ? find(root) : null;
    let next: typeof aim = null;
    if (root && el) {
      let left = 0;
      let top = 0;
      let at: HTMLElement | null = el;
      while (at && at !== root) {
        left += at.offsetLeft;
        top += at.offsetTop;
        at = at.offsetParent as HTMLElement | null;
      }
      if (at === root) next = { left, top, width: el.offsetWidth, height: el.offsetHeight };
    }
    setAim((a) => (a?.left === next?.left && a?.top === next?.top && a?.width === next?.width && a?.height === next?.height ? a : next));
  });

  // …and where that is in the demo's box, for the cursor. Worked out from the box (the drawn screen sits in its
  // middle), not measured from the screen itself: that one may still be easing to its new size.
  const fw = fit ? w * fit.scale + edge : 0;
  const fh = fit ? fit.viewH * fit.scale + edge : 0;
  useLayoutEffect(() => {
    const b = box.current;
    const stage = b?.parentElement;
    if (!fit || !b || !stage || !size) return;
    if (!aim) return onSpot(null);
    const o = b.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    onSpot({
      x: o.left - s.left + (size.w - fw) / 2 + edge / 2 + (aim.left + Math.min(aim.width * 0.6, 60)) * fit.scale,
      y: o.top - s.top + (size.h - fh) / 2 + edge / 2 + (aim.top - fit.pan + aim.height * 0.6) * fit.scale,
    });
  }, [aim, fit?.scale, fit?.pan, fw, fh, size, watch, edge, onSpot]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={box} className="flex h-full w-full items-center justify-center">
      <div
        ref={wrap}
        className={`relative shrink-0 overflow-hidden ${bezel ? "rounded-[1.75rem] border-[5px] border-[#26251e]" : "rounded-lg"} ${fit ? "" : "opacity-0"}`}
        style={fit ? { width: fw, height: fh } : { width: "100%", height: "100%" }}
      >
        <div
          ref={content}
          inert
          className={`relative flex origin-top-left flex-col ${still ? "" : "transition-transform duration-500 ease-out"}`}
          style={{ width: w, minHeight: whole !== undefined ? w * whole : fit?.viewH, transform: fit ? `scale(${fit.scale}) translateY(${-fit.pan}px)` : undefined }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * "Show me how": a pretend cursor makes a question in the builder, a phone answers it, the results show.
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
  const [spot, setSpot] = useState<Spot>(null);
  const [visible, setVisible] = useState(true);

  const demo = DEMOS[d];
  const step = demo.steps[i];
  const last = i === demo.steps.length - 1;
  const key = `${d}-${i}`;
  const phase: "move" | "done" = still || !step.target || arrived === key ? "done" : "move";
  const state = phase === "move" ? beforeClick(demo.steps, i) : step.state;
  const typing = phase === "done" && !still ? step.target : null;

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

  const [onSpot] = useState(() => (s: Spot) => setSpot((old) => (old?.x === s?.x && old?.y === s?.y ? old : s)));
  const cursorOn = step.target !== null && spot !== null;

  const pick = (n: number) => {
    setD(n);
    setI(0);
  };
  const go = (n: number) => {
    setChoice(false);
    setI(Math.max(0, Math.min(demo.steps.length - 1, n)));
  };

  const frame = {
    still,
    onSpot,
    watch: `${key}-${phase}-${state.screen}`,
    // the target is found from the step's goal: before the tap, the option to tap isn't picked yet
    find: (root: HTMLElement) => findTarget(root, step.target, step.state),
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
        className={`relative mt-3 overflow-hidden rounded-xl border border-line bg-canvas-soft p-2 sm:p-3 ${compact ? "h-[410px]" : "h-[420px] sm:h-[430px]"}`}
      >
        {(state.screen === "start" || state.screen === "types" || state.screen === "builder") && (
          // a little smaller than life, so more of the builder shows at once; a phone's box gets the narrow layout
          <Frame key={state.screen} width={(w) => (w < 480 ? 480 : 680)} {...frame}>
            <BuilderView state={state} typing={typing} scaleStep={step.target === "scale"} />
          </Frame>
        )}
        {state.screen === "phone" && (
          <Frame key="phone" width={390} height={720} bezel {...frame}>
            <PhoneView state={state} />
          </Frame>
        )}
        {state.screen === "results" && (
          <Frame key="results" width={(w) => (w < 520 ? 560 : 1040)} whole={0.625} {...frame}>
            <ResultsView state={state} />
          </Frame>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`pointer-events-none absolute top-0 left-0 z-10 h-7 w-7 drop-shadow ${still ? "" : "transition-transform duration-700 ease-out"} ${cursorOn ? "opacity-100" : "opacity-0"}`}
          style={{ transform: `translate(${spot?.x ?? 0}px, ${spot?.y ?? 0}px)` }}
        >
          <path d="M4 2l15 10-7 1.5L8.5 21z" fill="#26251e" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        {cursorOn && phase === "done" && !still && (
          <span
            key={key}
            className="demo-click pointer-events-none absolute top-0 left-0 z-0 h-8 w-8 rounded-full border-2 border-primary"
            style={{ transform: `translate(${spot.x - 12}px, ${spot.y - 12}px)` }}
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

/** The builder's own start choices, type tiles and question editor, filled in as the script goes. */
function BuilderView({ state, typing, scaleStep }: { state: DemoState; typing: DemoTarget; scaleStep: boolean }) {
  const typed = useCountUp(state.question.length, typing === "question", 28);
  const shown = useCountUp(state.items.length, typing === "items", 220);
  const card = "slab rounded-xl bg-white p-4 text-ink";

  if (state.screen === "start")
    return (
      <div className={card}>
        <h3 className="font-display text-2xl">How do you want to start?</h3>
        <StartChoices ai={false} onPick={noop} />
      </div>
    );
  if (state.screen === "types")
    return (
      <div className={card}>
        <TypePicker title="What's your first question?" onPick={noop} onCancel={noop} />
      </div>
    );

  const filled = state.items.slice(0, shown).map((name, n) => ({ key: `demo-${n}`, name }));
  const rows = [...filled, ...startRows(state.kind).map((r, n) => ({ ...r, key: `demo-blank-${n}` }))].slice(0, Math.max(filled.length, startRows(state.kind).length));
  const draft: QuestionDraft = { ...blank(KEY, state.kind), name: state.question.slice(0, typed), items: rows, correct: state.correct ?? "" };
  const rating = state.kind === "rating";
  const more = rating && (scaleStep || state.scale === 10);
  return (
    <div className={card}>
      <QuestionEditor
        key={String(more)}
        question={draft}
        index={0}
        total={1}
        onChange={noop}
        onRemove={noop}
        onDuplicate={noop}
        canDuplicate
        answered={0}
        counts={{}}
        problems={[]}
        scoring={
          rating
            ? { scaleMax: state.scale, setScaleMax: noop, lowLabel: "", setLowLabel: noop, highLabel: "", setHighLabel: noop, criteria: [{ name: "Score" }], setCriteria: noop, locked: false, counts: {}, shared: false }
            : null
        }
        scoringNumber={1}
        scaleMax={state.scale}
        lowLabel=""
        highLabel=""
        criteria={["Score"]}
        openMore={more}
      />
      {/* the builder's bottom bar */}
      <div className="mt-5 flex gap-3 border-t border-line pt-3">
        <span className="key rounded-lg bg-white px-5 py-3 font-semibold">Preview</span>
        <span data-demo="create" className="key font-display flex-1 rounded-lg bg-primary px-2 py-3 text-center text-xl font-bold whitespace-nowrap text-white">
          Create presentation
        </span>
      </div>
    </div>
  );
}

/** The voter page's own header, progress and answer card, in the default design. */
function PhoneView({ state }: { state: DemoState }) {
  // the quiz card asks for a nickname first; this pretend player already has one
  useState(() => {
    try {
      window.localStorage.setItem(`liverate:nick:${CODE}`, JSON.stringify("Ace"));
    } catch {
      // storage off: the card asks for a nickname instead
    }
  });
  const now = useNow();
  const [startedAt] = useState(() => Date.now() - 6000);
  const color = topicColor(0);
  const opts = options(state.items);
  const done = state.picked !== null;
  const session: SessionInfo = { code: CODE, title: TITLE, scaleMax: state.scale, lowLabel: "Low", highLabel: "High", isOpen: true, revision: 0, theme: "paper", decor: true };
  const live: LiveQuiz = {
    focusId: FOCUS,
    startedAt: new Date(startedAt).toISOString(),
    endsAt: new Date(startedAt + 20000).toISOString(),
    seconds: 20,
    now: new Date(now).toISOString(),
    correctTopicId: null,
  };
  return (
    <div style={themeStyle("paper")} className="text-ink">
      <div className="theme-pattern min-h-[720px] bg-canvas pb-6">
        <VoterHeader title={TITLE} theme="paper" decor score={null} />
        <VoterProgress done={done ? 1 : 0} total={1} chips={[{ key: "0", label: state.question, active: true, finished: done }]} onChip={noop} />
        <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-5">
          <div>
            <StepIntro name={state.kind === "rating" ? state.question : undefined} question={state.question} />
            {state.kind === "rating" ? (
              <TopicCard
                topic={opts[0]}
                index={0}
                total={opts.length}
                color={color}
                criteria={[{ id: "c0", name: "Score" }]}
                session={session}
                ratings={done ? { [cellKey(opts[0].id, "c0")]: 8 } : {}}
                statuses={{}}
                disabled={false}
                onRate={noop}
              />
            ) : state.kind === "poll" ? (
              <PollCard question={state.question} options={opts} color={color} value={optionId(state.items, state.picked)} status={done ? "saved" : undefined} disabled={false} onPick={noop} />
            ) : state.kind === "words" ? (
              <WordsCard question={state.question} color={color} value={done ? [state.picked!.toLowerCase()] : undefined} status={done ? "saved" : undefined} disabled={false} finished={false} onSend={noop} onFinish={noop} />
            ) : (
              <QuizCard code={CODE} voterId="demo" focusId={FOCUS} question={state.question} options={opts} color={color} live={live} offset={0} value={optionId(state.items, state.picked)} disabled={false} onAnswer={noop} onOver={noop} />
            )}
          </div>
          <StepNav current={0} steps={[{ label: state.question, done }]} onGo={noop} />
        </main>
      </div>
    </div>
  );
}

/** The results page's own header, card and chart (the quiz: its stage and leaderboard), in the default design. */
function ResultsView({ state }: { state: DemoState }) {
  const now = useNow();
  const [startedAt] = useState(() => Date.now());
  const opts = options(state.items);
  const total = state.results.reduce((a, b) => a + b, 0);
  const voters = state.kind === "rating" ? 12 : state.kind === "words" ? 14 : total || 24;
  const pill = "rounded-full border border-line-strong bg-white px-3 py-1";
  const correctId = optionId(state.items, state.correct) ?? null;
  const played = state.kind === "quiz" && state.results.length > 0;

  let body: React.ReactNode;
  if (state.kind === "quiz") {
    const live: LiveQuiz | null = state.started && !played
      ? { focusId: FOCUS, startedAt: new Date(startedAt).toISOString(), endsAt: new Date(startedAt + 20000).toISOString(), seconds: 20, now: new Date(now).toISOString(), correctTopicId: null }
      : null;
    body = (
      <>
        <QuizStage
          code={CODE}
          focusId={FOCUS}
          question={state.question}
          options={opts}
          seconds={20}
          live={live}
          receivedAt={live ? now : null}
          counts={played ? opts.map((o, n) => ({ focusId: FOCUS, topicId: o.id, n: state.results[n] })) : []}
          revealed={played ? correctId : null}
          owner
          next={null}
          onShowLeaderboard={noop}
          onNext={noop}
        />
        {played && (
          <section className="slab rounded-xl bg-white p-5">
            <h2 className="font-display mb-3 text-2xl font-semibold">Leaderboard</h2>
            <Leaderboard rows={PLAYERS} />
          </section>
        )}
      </>
    );
  } else {
    const max = Math.max(1, ...state.results);
    const min = Math.min(...state.results);
    const chart =
      state.kind === "rating" ? (
        <OverallBars
          size="large"
          ranked
          scaleMax={state.scale}
          data={opts
            .map((o, n) => ({ id: o.id, name: o.name, value: state.results[n], n: 12, index: n }))
            .sort((a, b) => b.value - a.value)
            .map((x, r) => ({ ...x, rank: r + 1 }))}
        />
      ) : state.kind === "words" ? (
        <WordCloud words={state.items.map((w, n) => ({ word: w.toLowerCase(), n: state.results[n], weight: max === min ? 1 : (state.results[n] - min) / (max - min) }))} />
      ) : (
        <PollBars
          tally={{
            total,
            rows: opts.map((o, n) => ({ id: o.id, name: o.name, n: state.results[n], pct: Math.round((state.results[n] / (total || 1)) * 100), index: n })),
            leader: null,
          }}
        />
      );
    body = <ResultCard title={state.question}>{state.results.length > 0 ? chart : null}</ResultCard>;
  }

  return (
    <div style={themeStyle("paper")} className="flex flex-1 flex-col text-ink">
      <div className="theme-pattern flex flex-1 flex-col gap-5 bg-canvas px-6 py-5">
        <ScreenHeader
          title={TITLE}
          theme="paper"
          decor
          status={
            <>
              <LiveBadge lastOkAt={now} />
              <VotingPills voters={voters} isOpen />
            </>
          }
          controls={
            <>
              <span className={pill}>Show QR</span>
              <span className={pill}>More ▾</span>
            </>
          }
        />
        <main className="min-w-0">{body}</main>
      </div>
    </div>
  );
}
