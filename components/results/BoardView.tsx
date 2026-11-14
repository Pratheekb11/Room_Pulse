"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { arrivalOrder, boardInfo, boardSpot, leafTilt, pieceShade, type BoardId } from "@/lib/boards";
import { tinted } from "@/lib/colors";
import type { TextAnswer } from "@/lib/types";
import { ToBody } from "../Portal";

// Leaves are light greens (a few turning yellow) with dark green ink; notes are pastel; stars are gold.
const LEAVES = ["#cdeab0", "#b4dc92", "#a3d48a", "#dcecaa", "#c3e3a0", "#efe3a0"] as const;
const LEAF_INK = "#1f3b16";
const NOTES = ["#fff1a8", "#ffd6e0", "#cfe8ff", "#d6f5c9", "#ffe0bf", "#e8dcff"] as const;
const NOTE_INK = "#2b2620";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** How wide each leaf or star is, as a share of the board's width: fewer answers, bigger pieces. */
function pieceShare(n: number): number {
  if (n <= 6) return 0.2;
  if (n <= 14) return 0.15;
  if (n <= 30) return 0.115;
  if (n <= 60) return 0.085;
  return 0.065;
}

/**
 * Open answers as a picture: leaves on a tree, sticky notes on a wall or stars in a night sky.
 * Each answer keeps its spot as more arrive. Tap one to show it big (the owner can hide it there).
 */
export function BoardView({ board, answers, onHide }: { board: BoardId; answers: TextAnswer[]; onHide?: (id: string) => void }) {
  const ordered = arrivalOrder(answers);
  const [openId, setOpenId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const info = boardInfo(board);
  const openIndex = openId ? ordered.findIndex((a) => a.id === openId) : -1;

  return (
    <div className="@container">
      {board === "wall" ? (
        <NoteWall answers={ordered} onOpen={setOpenId} />
      ) : (
        <Scene board={board} answers={ordered} onOpen={setOpenId} />
      )}
      {ordered.length > 0 && board !== "wall" && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="rounded-full border border-line-strong bg-white px-4 py-2 text-[clamp(0.9rem,1vw,1.1rem)] font-bold hover:bg-canvas"
          >
            {listOpen ? "Close the list" : `Read all ${plural(ordered.length, info.piece)}`}
          </button>
        </div>
      )}
      {listOpen && board !== "wall" && (
        <ul className="mt-4 grid grid-cols-1 gap-2 @min-[40rem]:grid-cols-2" aria-label={`Every ${info.piece}, newest first`}>
          {[...ordered].reverse().map((a) => (
            <li key={a.id} className="rounded-xl border border-line-strong bg-white p-3 text-[clamp(1rem,1.2vw,1.35rem)] leading-snug font-semibold">
              {a.text}
              {a.author && <span className="mt-1 block text-[0.85em] font-bold text-ink-soft">— {a.author}</span>}
            </li>
          ))}
        </ul>
      )}
      {openIndex !== -1 && (
        <PieceDialog
          board={board}
          answer={ordered[openIndex]}
          index={openIndex}
          count={ordered.length}
          onStep={(d) => setOpenId(ordered[(openIndex + d + ordered.length) % ordered.length].id)}
          onClose={() => setOpenId(null)}
          onHide={
            onHide
              ? (id) => {
                  onHide(id);
                  setOpenId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** The tree or the sky, drawn to fit the width: tall on phones, wide on big screens. */
function Scene({ board, answers, onOpen }: { board: "tree" | "sky"; answers: TextAnswer[]; onOpen: (id: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const wide = width >= 560;
  const ratio = wide ? 1.6 : 0.85; // width / height
  const w = Math.min(width, wide ? Math.round(typeof window === "undefined" ? width : window.innerHeight * 0.7 * ratio) : width);
  const h = Math.round(w / ratio);
  const n = answers.length;
  const piece = Math.round(w * pieceShare(n) * (wide ? 0.8 : 1));
  const font = piece * 0.1;
  const showText = font >= 9;
  // where the pieces go: the canopy, or most of the sky
  const area = board === "tree" ? { l: 0.07, t: 0.05, w: 0.86, h: 0.58 } : { l: 0.05, t: 0.07, w: 0.9, h: 0.8 };
  const label = board === "tree" ? `A tree with ${plural(n, "leaf").replace("leafs", "leaves")}` : `A night sky with ${plural(n, "star")}`;

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <div
          role="group"
          aria-label={label}
          className="relative mx-auto overflow-hidden rounded-2xl border border-line-strong"
          style={{
            width: w,
            height: h,
            background:
              board === "tree"
                ? `linear-gradient(180deg, ${tinted("#e7f4fb")} 0%, ${tinted("#f6f9ec")} 70%, ${tinted("#e4efcf")} 100%)`
                : `radial-gradient(120% 90% at 50% 100%, ${tinted("#2b3a6b")} 0%, ${tinted("#141a33")} 60%, ${tinted("#0c1024")} 100%)`,
          }}
        >
          {board === "tree" ? <TreeArt w={w} h={h} n={n} /> : <SkyArt w={w} h={h} />}
          {answers.map((a, i) => {
            const p = boardSpot(board, i);
            const left = (area.l + p.x * area.w) * w;
            const top = (area.t + p.y * area.h) * h;
            const name = a.author ? ` — ${a.author}` : "";
            return board === "tree" ? (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpen(a.id)}
                aria-label={`Leaf: ${a.text}${name}`}
                title={`${a.text}${name}`}
                className="animate-grow absolute flex items-center justify-center text-center leading-tight font-bold shadow-[0_1px_2px_rgb(0_0_0/0.18)] hover:z-10 hover:scale-110 focus-visible:z-10"
                style={{
                  left,
                  top,
                  width: piece,
                  height: piece * 0.68,
                  padding: `${piece * 0.08}px ${piece * 0.14}px`,
                  borderRadius: "75% 0",
                  background: tinted(LEAVES[pieceShade(a.id, LEAVES.length)]),
                  color: LEAF_INK,
                  fontSize: font,
                  transform: `translate(-50%, -50%) rotate(${leafTilt(a.id)}deg)`,
                  animationDelay: `${Math.min(i * 40, 1200)}ms`,
                  transition: "scale 150ms",
                }}
              >
                {showText && <span className="line-clamp-3 [overflow-wrap:anywhere]">{a.text}</span>}
              </button>
            ) : (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpen(a.id)}
                aria-label={`Star: ${a.text}${name}`}
                title={`${a.text}${name}`}
                className="animate-grow absolute flex flex-col items-center gap-1 hover:z-10 focus-visible:z-10"
                style={{ left, top, width: piece * 1.3, transform: "translate(-50%, -30%)", animationDelay: `${Math.min(i * 40, 1200)}ms` }}
              >
                <Star size={Math.max(14, piece * 0.32)} />
                {showText && (
                  <span
                    className="line-clamp-2 rounded-md px-1.5 py-0.5 text-center leading-tight font-bold [overflow-wrap:anywhere]"
                    style={{ fontSize: font, color: "#fdf7e3", background: "rgb(12 16 36 / 0.55)" }}
                  >
                    {a.text}
                  </span>
                )}
              </button>
            );
          })}
          {n === 0 && (
            <p
              className="absolute inset-x-0 bottom-[6%] px-4 text-center text-[clamp(1rem,1.6vw,1.6rem)] font-bold"
              style={{ color: board === "tree" ? "#41552f" : "#e9e6ff" }}
            >
              {board === "tree" ? "Leaves will grow here as people answer." : "Stars will light up as people answer."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TreeArt({ w, h, n }: { w: number; h: number; n: number }) {
  const cx = w / 2;
  const bark = tinted("#8a5a3b");
  const trunkW = Math.max(14, w * 0.055);
  // branches from the top of the trunk into the canopy
  const twigs: [number, number, number][] = [
    [0.22, 0.3, 0.5],
    [0.78, 0.3, 0.5],
    [0.38, 0.12, 0.42],
    [0.62, 0.14, 0.42],
    [0.12, 0.46, 0.4],
    [0.88, 0.46, 0.4],
    [0.5, 0.08, 0.36],
  ];
  const fork = h * 0.6;
  return (
    <svg aria-hidden="true" width={w} height={h} className="absolute inset-0">
      <ellipse cx={cx} cy={h * 1.02} rx={w * 0.62} ry={h * 0.1} fill={tinted("#a9cf7d")} />
      <ellipse cx={cx} cy={h * 0.34} rx={w * 0.47} ry={h * 0.32} fill={tinted("#9fd08a")} opacity={Math.min(0.35, n * 0.03)} />
      {twigs.map(([x, y, k], i) => (
        <path
          key={i}
          d={`M ${cx} ${fork} Q ${cx + (x * w - cx) * 0.3} ${(fork + y * h) / 2 - h * 0.04} ${x * w} ${y * h}`}
          stroke={bark}
          strokeWidth={trunkW * k}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <path
        d={`M ${cx - trunkW * 0.9} ${h * 0.97} C ${cx - trunkW * 0.5} ${h * 0.8}, ${cx - trunkW * 0.55} ${h * 0.7}, ${cx - trunkW * 0.35} ${fork}
            L ${cx + trunkW * 0.35} ${fork} C ${cx + trunkW * 0.55} ${h * 0.7}, ${cx + trunkW * 0.5} ${h * 0.8}, ${cx + trunkW * 0.9} ${h * 0.97} Z`}
        fill={bark}
      />
    </svg>
  );
}

function SkyArt({ w, h }: { w: number; h: number }) {
  // faint background stars, the same every time
  const dots = Array.from({ length: 70 }, (_, i) => {
    const p = boardSpot("sky", i + 400);
    return { x: p.x * w, y: p.y * h, r: 0.6 + ((i * 7) % 5) * 0.25 };
  });
  return (
    <svg aria-hidden="true" width={w} height={h} className="absolute inset-0">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={0.35} />
      ))}
      <circle cx={w * 0.9} cy={h * 0.12} r={Math.max(12, w * 0.035)} fill={tinted("#fbe7a1")} />
      <circle cx={w * 0.9 + Math.max(12, w * 0.035) * 0.45} cy={h * 0.12 - 4} r={Math.max(12, w * 0.035)} fill={tinted("#141a33")} />
    </svg>
  );
}

function Star({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="drop-shadow-[0_0_6px_rgb(255_220_120/0.7)]">
      <path d="M12 1.8l2.9 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.3 5.7 21l1.6-7.1L1.9 9.1l7.2-.7z" fill={tinted("#ffd45e")} />
    </svg>
  );
}

/** Sticky notes on a cork wall, in the order they arrived. */
function NoteWall({ answers, onOpen }: { answers: TextAnswer[]; onOpen: (id: string) => void }) {
  return (
    <div className="@container rounded-2xl border border-line-strong p-[clamp(0.75rem,1.6vw,1.6rem)]" style={{ background: tinted("#e9d8b8") }}>
      {answers.length === 0 ? (
        <p className="py-14 text-center text-[clamp(1rem,1.6vw,1.6rem)] font-bold" style={{ color: "#5b4a2e" }}>
          Sticky notes will appear here as people answer.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-[clamp(0.6rem,1.2vw,1.2rem)] @min-[36rem]:grid-cols-3 @min-[56rem]:grid-cols-4" aria-label="Sticky notes">
          {answers.map((a, i) => (
            <li key={a.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(a.id)}
                aria-label={`Note: ${a.text}${a.author ? ` — ${a.author}` : ""}`}
                className="animate-grow flex aspect-square w-full flex-col justify-between p-[clamp(0.6rem,1.1vw,1.1rem)] text-left shadow-[0_2px_4px_rgb(0_0_0/0.18)] hover:scale-[1.03]"
                style={{
                  background: tinted(NOTES[pieceShade(a.id, NOTES.length)]),
                  color: NOTE_INK,
                  transform: `rotate(${leafTilt(a.id) / 4}deg)`,
                  animationDelay: `${Math.min(i * 40, 1200)}ms`,
                  transition: "scale 150ms",
                }}
              >
                <span className="line-clamp-6 text-[clamp(0.95rem,1.35vw,1.5rem)] leading-snug font-bold [overflow-wrap:anywhere]">{a.text}</span>
                {a.author && <span className="mt-2 truncate text-[clamp(0.8rem,1vw,1.1rem)] font-bold opacity-75">— {a.author}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One leaf, note or star, big, to read out and talk about. Arrows step through the others. */
function PieceDialog({
  board,
  answer,
  index,
  count,
  onStep,
  onClose,
  onHide,
}: {
  board: BoardId;
  answer: TextAnswer;
  index: number;
  count: number;
  onStep: (d: number) => void;
  onClose: () => void;
  onHide?: (id: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onStep(1);
      else if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  const info = boardInfo(board);
  const style =
    board === "tree"
      ? { background: tinted(LEAVES[pieceShade(answer.id, LEAVES.length)]), color: LEAF_INK, borderRadius: "48px 0" }
      : board === "wall"
        ? { background: tinted(NOTES[pieceShade(answer.id, NOTES.length)]), color: NOTE_INK, borderRadius: 4 }
        : { background: tinted("#141a33"), color: "#fdf7e3", borderRadius: 24 };
  const btn = "rounded-full border border-line-strong bg-white px-4 py-2 font-bold text-ink hover:bg-canvas";
  return (
    <ToBody>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${info.piece[0].toUpperCase()}${info.piece.slice(1)} ${index + 1} of ${count}`}
          className="animate-pop flex w-full max-w-2xl flex-col gap-5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-[clamp(1.5rem,4vw,3.5rem)] text-center shadow-2xl" style={style}>
            {board === "sky" && <Star size={48} />}
            <p className="font-display text-[clamp(1.5rem,4vw,3.2rem)] leading-tight font-semibold [overflow-wrap:anywhere]">{answer.text}</p>
            {answer.author && <p className="text-[clamp(1rem,1.8vw,1.6rem)] font-bold opacity-80">— {answer.author}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" className={btn} onClick={() => onStep(-1)} aria-label={`Previous ${info.piece}`} disabled={count < 2}>
              ←
            </button>
            <span className="min-w-[6ch] text-center font-bold tabular-nums text-white">
              {index + 1} / {count}
            </span>
            <button type="button" className={btn} onClick={() => onStep(1)} aria-label={`Next ${info.piece}`} disabled={count < 2}>
              →
            </button>
            {onHide && (
              <button type="button" className={btn} onClick={() => onHide(answer.id)}>
                Hide
              </button>
            )}
            <button ref={closeRef} type="button" className={btn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ToBody>
  );
}
