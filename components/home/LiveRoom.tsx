"use client";

// The home page's hook: the room, live. A big screen in a real slide design, two phones answering beside it,
// and each answer flying up to the screen. Every few seconds it moves on to another design and another kind of
// question. Colours and headline fonts come from the designs themselves (lib/themes.ts), so it shows what a
// presentation really looks like. Sized in container units: it scales like a picture and the page stays static.
import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from "react";
import { tree } from "@/lib/tree";
import { getTheme, themeStyle, type ThemeId } from "@/lib/themes";
import { LEAVES, LeafShape, leafStyle, TreeArt } from "@/components/TreeArt";

type Base = { id: string; theme: ThemeId; kindLabel: string; question: string; code: string };
type Choice = Base & { kind: "poll" | "quiz"; options: string[]; seed: number[]; script: number[]; correct?: number };
type Cloud = Base & { kind: "words"; words: string[]; seed: number[]; script: number[] };
type Grove = Base & { kind: "tree"; leaves: { text: string; name: string }[]; seed: number };
export type Scene = Choice | Cloud | Grove;

export const SCENES: Scene[] = [
  {
    id: "retro",
    theme: "paper",
    kind: "poll",
    kindLabel: "Pick one",
    question: "What should we fix first?",
    code: "k7m2qp",
    options: ["Flaky tests", "Long standups", "Onboarding docs", "Slow reviews"],
    seed: [5, 3, 2, 4],
    script: [0, 3, 0, 1, 0, 3, 2, 0],
  },
  {
    id: "words",
    theme: "pop",
    kind: "words",
    kindLabel: "Word cloud",
    question: "Our team in one word?",
    code: "b4nd1t",
    words: ["Curious", "Kind", "Bold", "Funny", "Chaotic", "Calm", "Nerdy", "Brave", "Loud", "Fast"],
    seed: [3, 2, 1, 2, 1, 0, 0, 0, 0, 1],
    script: [0, 5, 1, 0, 6, 3, 7, 0, 1, 8],
  },
  {
    id: "quiz",
    theme: "arcade",
    kind: "quiz",
    kindLabel: "Quiz",
    question: "Which planet spins the fastest?",
    code: "qz9plt",
    options: ["Earth", "Jupiter", "Mars", "Venus"],
    seed: [1, 2, 0, 1],
    script: [1, 0, 1, 1, 3, 1, 2, 1],
    correct: 1,
  },
  {
    id: "tree",
    theme: "forest",
    kind: "tree",
    kindLabel: "Team activity",
    question: "What keeps you going at work?",
    code: "tr33ok",
    leaves: [
      { text: "Learning", name: "Ana" },
      { text: "My team", name: "Ravi" },
      { text: "Customers", name: "Mei" },
      { text: "Coffee", name: "Tom" },
      { text: "Shipping", name: "Priya" },
      { text: "Trust", name: "Sam" },
      { text: "Growth", name: "Ines" },
      { text: "Kind people", name: "Kofi" },
      { text: "Demos", name: "Lena" },
      { text: "Autonomy", name: "Arjun" },
    ],
    seed: 3,
  },
];

const steps = (s: Scene) => (s.kind === "tree" ? s.leaves.length - s.seed : s.script.length);
/** Which phone sends answer `i`: they take turns. */
const phoneOf = (i: number) => i % 2;

const TICK = 850; // a new answer this often
const FLIGHT = 1000; // from the phone to the screen, so two can be in the air at once
const HOLD = 3; // ticks to look at the full result before moving on

/** Counts once the first `n` answers of the script have arrived. */
function counts(seed: number[], script: number[], n: number) {
  const c = [...seed];
  for (const i of script.slice(0, n)) c[i] += 1;
  return c;
}
const peopleIn = (s: Scene, shown: number) => (s.kind === "tree" ? s.seed : s.seed.reduce((a, b) => a + b, 0)) + shown;

// Container units of the whole picture
const u = (n: number) => `${n}cqw`;
const fs = (n: number): CSSProperties => ({ fontSize: u(n) });

type State = { scene: number; tap: number; shown: number; from: number | null };

export function LiveRoom() {
  const [state, setState] = useState<State>({ scene: 0, tap: 0, shown: 0, from: null });
  const [running, setRunning] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const hold = useRef(0);

  // runs only on screen, in a visible tab, and not for people who ask for less motion
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let onScreen = false;
    const update = () => setRunning(onScreen && document.visibilityState === "visible");
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      update();
    });
    if (box.current) io.observe(box.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // on a laptop the picture leans towards the pointer (set straight on the element: no re-render per move)
  useEffect(() => {
    const el = tilt.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.tilt = "";
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
        const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
        el.style.setProperty("--tilt-x", `${(x * 7).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(-y * 5).toFixed(2)}deg`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      delete el.dataset.tilt;
    };
  }, []);

  // the loop reads the latest state from a ref, so the updates themselves stay pure
  const cur = useRef(state);
  useEffect(() => {
    cur.current = state;
  });
  useEffect(() => {
    if (!running) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = setInterval(() => {
      const s = cur.current;
      if (s.tap < steps(SCENES[s.scene])) {
        const tap = s.tap + 1;
        setState({ ...s, tap });
        timers.push(
          setTimeout(() => setState((t) => (t.scene === s.scene && t.tap >= tap ? { ...t, shown: Math.max(t.shown, tap) } : t)), FLIGHT),
        );
      } else if (hold.current < HOLD) {
        hold.current += 1;
      } else {
        hold.current = 0;
        setState({ scene: (s.scene + 1) % SCENES.length, tap: 0, shown: 0, from: s.scene });
      }
    }, TICK);
    return () => {
      clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, [running]);

  const scene = SCENES[state.scene];
  const style = themeStyle(scene.theme) as CSSProperties;
  const people = peopleIn(scene, state.shown);
  const before = state.from === null ? null : SCENES[state.from];
  const inAir = Array.from({ length: Math.max(0, state.tap - state.shown) }, (_, k) => state.shown + k);

  return (
    <div className="min-w-0">
      <div
        ref={box}
        role="img"
        aria-label={`A big screen showing a ${scene.kindLabel.toLowerCase()} question in the ${getTheme(scene.theme).label} design, with answers arriving from people's phones`}
        className="@container relative w-full"
        style={{ aspectRatio: "100 / 74" }}
      >
        {/* the screen's light on the dark page, in the design's colours */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: u(4), top: u(4), width: u(74), height: u(44) }}>
          <div className="room-glow absolute rounded-full" style={{ ...style, inset: `${u(-8)}`, "--glow": "var(--color-primary)" } as CSSProperties} />
          <div className="room-glow room-glow-2 absolute rounded-full" style={{ ...style, inset: `${u(2)} ${u(-14)} ${u(-16)} ${u(32)}`, "--glow": "var(--topic-2)" } as CSSProperties} />
        </div>

        <div ref={tilt} className="room-tilt absolute inset-0">
          {/* the big screen: the next design sweeps across the one before */}
          <div className="absolute top-0 left-0 rounded-[1.8cqw] bg-black p-[0.6cqw] shadow-2xl shadow-black/60 ring-1 ring-white/15" style={{ width: u(82), height: u(51.25) }}>
            <div className="relative h-full overflow-hidden rounded-[1.3cqw]">
              {before && <ScreenLayer scene={before} shown={steps(before)} people={peopleIn(before, steps(before))} />}
              <ScreenLayer
                key={`${scene.id}-${state.from ?? "start"}`}
                className={before ? "room-wipe" : ""}
                onAnimationEnd={(e) => {
                  if (e.target === e.currentTarget) setState((t) => ({ ...t, from: null }));
                }}
                scene={scene}
                shown={state.shown}
                people={people}
              />
            </div>
          </div>

          {/* phones */}
          <Phone scene={scene} slot={0} tap={state.tap} pos={{ left: u(77), top: u(17), width: u(21.5), height: u(43) }} />
          <Phone scene={scene} slot={1} tap={state.tap} pos={{ left: u(3.5), top: u(44), width: u(15), height: u(30) }} />

          {/* answers in flight, from the phone that sent each up to the screen, and the ping where the last one landed */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {inAir.map((i) => (
              <Flight key={`${scene.id}-${i}`} scene={scene} index={i} />
            ))}
            {state.shown > 0 && <Ping key={`${scene.id}-ping-${state.shown}`} index={state.shown - 1} />}
          </div>
        </div>

      </div>

    </div>
  );
}

/** One design's screen: header, question and results. */
function ScreenLayer({
  scene,
  shown,
  people,
  className = "",
  onAnimationEnd,
}: {
  scene: Scene;
  shown: number;
  people: number;
  className?: string;
  onAnimationEnd?: (e: AnimationEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`room-screen absolute inset-0 flex flex-col bg-canvas text-ink ${className}`}
      style={{ ...(themeStyle(scene.theme) as CSSProperties), padding: `${u(2.6)} ${u(7)} ${u(1.8)} ${u(3)}` }}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="flex items-center justify-between gap-[1cqw] text-muted" style={fs(1.35)}>
        <span>
          Join with code <span className="font-mono text-ink">{scene.code}</span>
        </span>
        <span className="tabular-nums">
          <span className="mr-[0.6cqw] inline-block h-[0.8cqw] w-[0.8cqw] animate-pulse rounded-full bg-primary align-middle" />
          <span key={people} className="animate-pop inline-block">
            {people}
          </span>{" "}
          answers
        </span>
      </div>
      <p className="font-display mt-[1.6cqw] leading-[1.05]" style={fs(3.4)}>
        {scene.question}
      </p>
      <div className="mt-[2cqw] min-h-0 flex-1">
        <ScreenBody scene={scene} shown={shown} />
      </div>
    </div>
  );
}

function ScreenBody({ scene, shown }: { scene: Scene; shown: number }) {
  if (scene.kind === "poll" || scene.kind === "quiz") {
    const c = counts(scene.seed, scene.script, shown);
    const max = Math.max(...c, 1);
    const total = c.reduce((a, b) => a + b, 0);
    const done = shown >= scene.script.length;
    if (scene.kind === "quiz") {
      const reveal = done;
      return (
        <div className="flex h-full flex-col">
          {/* time running out */}
          <div className="h-[0.7cqw] overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-primary transition-[width] duration-[1400ms] ease-linear" style={{ width: `${(1 - shown / scene.script.length) * 100}%` }} />
          </div>
          <ul className="mt-[1.8cqw] grid flex-1 grid-cols-2 gap-[1.2cqw]">
            {scene.options.map((o, i) => {
              const right = i === scene.correct;
              return (
                <li
                  key={o}
                  className={`relative flex items-center justify-between rounded-[0.8cqw] px-[1.6cqw] transition-[opacity,transform] duration-500 ease-[var(--ease-spring)] ${reveal && !right ? "scale-95 opacity-35" : ""} ${reveal && right ? "z-10 scale-[1.04]" : ""}`}
                  style={{ background: `var(--topic-${i})`, color: "var(--color-canvas)" }}
                >
                  <span className="font-display" style={fs(2.4)}>
                    {o}
                  </span>
                  <span className="flex items-center gap-[0.6cqw] tabular-nums" style={fs(2)}>
                    {reveal && right && <Burst />}
                    {reveal && right && (
                      <svg viewBox="0 0 16 16" className="h-[2.2cqw] w-[2.2cqw]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8.5l3.2 3L13 4.5" />
                      </svg>
                    )}
                    {c[i]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    const lead = c.indexOf(max);
    return (
      <ul className="flex h-full flex-col justify-around pb-[2.5cqw]">
        {scene.options.map((o, i) => (
          <li key={o}>
            <div className="flex justify-between gap-[1cqw]" style={fs(1.7)}>
              <span className={i === lead ? "text-ink" : "text-ink-soft"}>{o}</span>
              <span className="text-muted tabular-nums">{Math.round((c[i] / total) * 100)}%</span>
            </div>
            <div className="mt-[0.6cqw] h-[1.9cqw] overflow-hidden rounded-[0.5cqw] bg-line-soft">
              <div
                className="h-full rounded-[0.5cqw] transition-[width] duration-700 ease-[var(--ease-out-soft)]"
                style={{ width: `${(c[i] / max) * 100}%`, background: `var(--topic-${i})` }}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (scene.kind === "words") {
    const c = counts(scene.seed, scene.script, shown);
    const max = Math.max(...c, 1);
    return (
      <ul className="flex h-full flex-wrap content-center items-baseline justify-center gap-x-[2.6cqw] gap-y-[0.8cqw] pb-[3cqw]">
        {scene.words.map((w, i) =>
          c[i] === 0 ? null : (
            <li
              key={w}
              className="font-display animate-grow leading-none transition-[font-size] duration-500 ease-[var(--ease-spring)]"
              style={{ fontSize: u(2.2 + (c[i] / max) * 6.2), color: `var(--topic-ink-${i % 8})` }}
            >
              {w}
            </li>
          ),
        )}
      </ul>
    );
  }
  if (scene.kind !== "tree") return null;
  const art = tree("wide");
  const size = art.leafSize(scene.leaves.length);
  const W = 64; // the tree's width in cqw
  const len = (share: number) => u(Math.round(share * W * 100) / 100);
  return (
    <div className="relative mx-auto -mt-[1cqw]" style={{ width: u(W), height: u(W * art.aspect) }}>
      <div className="absolute inset-0 overflow-hidden rounded-[0.8cqw]">
        <TreeArt art={art} w={400} h={400 * art.aspect} />
      </div>
      {scene.leaves.slice(0, scene.seed + shown).map((l, i) => {
        const leaf = art.leaf(i);
        return (
          <span key={l.text} className="animate-grow absolute flex items-center justify-center text-center font-bold [overflow-wrap:normal]" style={leafStyle(leaf, size, len)}>
            <LeafShape color={LEAVES[i % LEAVES.length]} flip={leaf.side === -1} />
            <span className="relative">{l.text}</span>
          </span>
        );
      })}
    </div>
  );
}

/** A phone: the voter's screen in the same design, showing the answer it sent last. */
function Phone({ scene, slot, tap, pos }: { scene: Scene; slot: number; tap: number; pos: CSSProperties }) {
  // the latest answer this phone has sent, and whether it's the one being sent right now
  let mine = -1;
  for (let i = tap - 1; i >= 0; i--) if (phoneOf(i) === slot) { mine = i; break; }
  const now = mine >= 0 && mine === tap - 1;
  return (
    <div className="room-depth absolute" style={pos}>
    <div className="room-float h-full rounded-[2.6cqw] bg-black p-[0.6cqw] shadow-xl shadow-black/50 ring-1 ring-white/15" style={{ animationDelay: `${slot * -2.2}s` }}>
      <div className="room-screen flex h-full flex-col overflow-hidden rounded-[2cqw] bg-canvas text-ink" style={{ ...(themeStyle(scene.theme) as CSSProperties), padding: u(1.3) }}>
        <div key={scene.id} className="animate-fade flex h-full flex-col">
          <span className="mx-auto mb-[1cqw] h-[0.5cqw] w-[4cqw] rounded-full bg-line-strong" />
          <p className="font-display leading-[1.1]" style={fs(slot ? 1.25 : 1.55)}>
            {scene.question}
          </p>
          <div className="mt-[1.1cqw] min-h-0 flex-1">
            <PhoneBody scene={scene} index={mine} now={now} small={slot === 1} />
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function PhoneBody({ scene, index, now, small }: { scene: Scene; index: number; now: boolean; small: boolean }) {
  const text = small ? 1.05 : 1.3;
  if (scene.kind === "poll" || scene.kind === "quiz") {
    const choice = index >= 0 ? scene.script[index] : -1;
    const quiz = scene.kind === "quiz";
    return (
      <ul className={quiz ? "grid grid-cols-2 gap-[0.7cqw]" : "flex flex-col gap-[0.7cqw]"}>
        {scene.options.map((o, i) => {
          const on = i === choice;
          return (
            <li
              key={o}
              className={`relative overflow-hidden rounded-[0.7cqw] border transition-all duration-300 ${quiz ? "flex aspect-square items-center justify-center text-center" : ""} ${
                on ? "border-ink" : "border-line"
              } ${on && now ? "scale-[1.04]" : ""}`}
              style={{
                ...fs(text),
                padding: quiz ? undefined : `${u(0.75)} ${u(0.9)}`,
                background: quiz ? `var(--topic-${i})` : on ? "var(--color-primary)" : "var(--color-white)",
                color: quiz ? "var(--color-canvas)" : on ? "var(--color-white)" : "var(--color-ink)",
                opacity: quiz && choice >= 0 && !on ? 0.4 : 1,
              }}
            >
              {on && now && <Tap key={index} />}
              <span className="relative">{o}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (scene.kind === "words") {
    const word = index >= 0 ? scene.words[scene.script[index]] : "";
    return (
      <div className="flex flex-col gap-[0.8cqw]">
        <div className="rounded-[0.7cqw] border border-line-strong bg-white" style={{ ...fs(text + 0.2), padding: `${u(0.8)} ${u(0.9)}` }}>
          {word || <span className="text-muted-soft">A word</span>}
          {now && <span className="ml-px inline-block h-[1.3cqw] w-px animate-pulse bg-ink align-middle" />}
        </div>
        <span className={`relative overflow-hidden rounded-[0.7cqw] bg-primary text-center text-white transition-transform duration-300 ${now ? "scale-[1.04]" : ""}`} style={{ ...fs(text), padding: u(0.7) }}>
          {now && <Tap key={index} />}
          <span className="relative">Send</span>
        </span>
      </div>
    );
  }
  if (scene.kind !== "tree") return null;
  const leaf = index >= 0 ? scene.leaves[scene.seed + index] : null;
  return (
    <div className="flex flex-col gap-[0.8cqw]">
      <div className="relative flex items-center justify-center" style={{ height: u(small ? 6 : 8.5) }}>
        <LeafShape color={LEAVES[(scene.seed + Math.max(index, 0)) % LEAVES.length]} flip={false} />
        <span className="relative font-bold" style={{ ...fs(text), color: "var(--color-ink)" }}>
          {leaf?.text ?? "Your leaf"}
        </span>
      </div>
      <div className="rounded-[0.7cqw] border border-line bg-white text-ink-soft" style={{ ...fs(text - 0.1), padding: `${u(0.6)} ${u(0.9)}` }}>
        {leaf?.name ?? "Your name"}
      </div>
      <span className={`relative overflow-hidden rounded-[0.7cqw] bg-primary text-center text-white transition-transform duration-300 ${now ? "scale-[1.04]" : ""}`} style={{ ...fs(text), padding: u(0.7) }}>
        {now && <Tap key={index} />}
        <span className="relative">Add my leaf</span>
      </span>
    </div>
  );
}

// Where an answer leaves its phone, and how far it travels to the screen (cqw)
const FROM = [
  { x: 80, y: 27, dx: -24, dy: -6 },
  { x: 11, y: 48, dx: 18, dy: -18 },
];

function Flight({ scene, index }: { scene: Scene; index: number }) {
  const from = FROM[phoneOf(index)];
  const colour =
    scene.kind === "tree" ? LEAVES[(scene.seed + index) % LEAVES.length] : themeStyle(scene.theme)[`--topic-${scene.script[index] % 8}`];
  return (
    <span
      className="room-fly absolute rounded-full ring-2 ring-white/80"
      style={
        {
          left: u(from.x),
          top: u(from.y),
          width: u(2),
          height: u(2),
          background: colour,
          color: colour,
          "--dx": u(from.dx),
          "--dy": u(from.dy),
          animationDuration: `${FLIGHT}ms`,
        } as CSSProperties
      }
    />
  );
}

/** A ring where an answer lands on the screen. */
function Ping({ index }: { index: number }) {
  const from = FROM[phoneOf(index)];
  return (
    <span
      className="room-ping absolute rounded-full border-2 border-white/80"
      style={{ left: u(from.x + from.dx - 1), top: u(from.y + from.dy - 1), width: u(4), height: u(4) }}
    />
  );
}

/** A ripple from where a phone was tapped. */
function Tap() {
  return <span aria-hidden className="room-tap absolute top-1/2 left-1/2 aspect-square w-[140%] rounded-full bg-white/45" />;
}

/** A burst of the design's own colours from the right answer of a quiz. */
const BITS = Array.from({ length: 22 }, (_, i) => {
  const a = (i / 22) * Math.PI * 2 + (i % 2) * 0.2;
  const d = 12 + (i % 3) * 6;
  return { x: Math.round(Math.cos(a) * d * 10) / 10, y: Math.round(Math.sin(a) * d * 0.7 * 10) / 10, c: i % 8, r: (i * 47) % 360 };
});
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
      {BITS.map((b, i) => (
        <span
          key={i}
          className="room-burst absolute h-[1.7cqw] w-[0.9cqw] rounded-[0.25cqw] ring-1 ring-black/20"
          style={{ background: b.c % 3 === 0 ? "var(--color-white)" : `var(--topic-${b.c})`, "--bx": u(b.x), "--by": u(b.y), "--br": `${b.r}deg`, animationDelay: `${(i % 4) * 30}ms` } as CSSProperties}
        />
      ))}
    </span>
  );
}
