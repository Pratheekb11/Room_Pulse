"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { arrivalOrder, boardInfo, boardSpot, clampPan, fitSceneSize, leafTilt, pieceShade, pieceTextSize, SCENE_FIT_MIN, sceneRatio, sceneSize, screenInFrame, ZOOMS, type BoardId } from "@/lib/boards";
import { tinted } from "@/lib/colors";
import { tree, treeShape } from "@/lib/tree";
import type { TextAnswer } from "@/lib/types";
import { useFit } from "../FitToScreen";
import { ToBody } from "../Portal";
import { FONT_SHARE, LEAF_INK, LEAVES, LeafShape, leafStyle, TREE_SKY, TreeArt } from "../TreeArt";

// Notes are pastel; stars are gold. (Leaves: components/TreeArt.tsx)
const NOTES = ["#fff1a8", "#ffd6e0", "#cfe8ff", "#d6f5c9", "#ffe0bf", "#e8dcff"] as const;
const NOTE_INK = "#2b2620";

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w === "leaf" ? "leaves" : `${w}s`}`;

/** An element's own width and height (layout pixels: a scaled parent doesn't change them). */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((cur) => (cur.w === el.clientWidth && cur.h === el.clientHeight ? cur : { w: el.clientWidth, h: el.clientHeight }));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const NARROW = "(max-width: 559px)";
const watchNarrow = (changed: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", changed);
  return () => mq.removeEventListener("change", changed);
};
/** Is this a phone-sized screen? False while the server draws the page, so both draw the same thing. */
function useNarrowScreen() {
  return useSyncExternalStore(
    watchNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/** How wide each star is, as a share of the board's width: fewer answers, bigger pieces. */
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
  // phones draw leaves too small to read, so the list starts open there (until it's opened or closed by hand)
  const narrow = useNarrowScreen();
  const [listChoice, setListOpen] = useState<boolean | null>(null);
  const listOpen = listChoice ?? narrow;
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
            onClick={() => setListOpen(!listOpen)}
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

/**
 * The tree or the sky, drawn to fit: as wide as there's room for and never taller than the screen,
 * so the whole picture is always in view. Zoom in (buttons, or pinch) to read small leaves; drag to look around.
 */
function Scene({ board, answers, onOpen }: { board: "tree" | "sky"; answers: TextAnswer[]; onOpen: (id: string) => void }) {
  // With Fit to screen on, it gives this picture its box (the room left on the screen) and the picture
  // only draws inside it. If both sized the picture, each would change the other's answer for ever.
  const fit = useFit();
  const [ref, box] = useSize<HTMLDivElement>();
  const width = box.w;
  const [screen, setScreen] = useState({ vh: 0, top: 0 });
  // Where the picture starts moves as things above it load (description, picture, live pills), so measure
  // after every render and on resize; only a real change re-renders.
  const measure = useCallback(() => {
    if (fit.on) return;
    const el = ref.current;
    if (!el) return;
    // the builder's preview draws a pretend screen, scaled down: the picture fits that, not the window
    const frame = el.closest<HTMLElement>("[data-screen]");
    const shown = frame?.getBoundingClientRect();
    const top = el.getBoundingClientRect().top;
    const next = frame && shown ? screenInFrame(top, shown.top, shown.height, frame.offsetHeight) : { vh: window.innerHeight, top: Math.round(top + window.scrollY) };
    setScreen((cur) => (Math.abs(cur.vh - next.vh) > 2 || Math.abs(cur.top - next.top) > 2 ? next : cur));
  }, [ref, fit.on]);
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [measure]);
  const { w, h } = fit.on ? fitSceneSize(width, box.h) : sceneSize(width, screen.vh || 800, screen.top);
  const wide = width >= 560;
  // the picture's shape changes with its width (wide or tall): Fit to screen has to work its box out again
  const ratio = sceneRatio(width);
  useLayoutEffect(() => {
    if (fit.on) fit.refit();
  }, [fit, ratio]);

  // the tree, drawn for this picture's shape (wide on big screens, tall on phones)
  const art = board === "tree" ? tree(treeShape(w, h)) : null;

  const [zoom, setZoom] = useState(1);
  const [rawPan, setPan] = useState({ x: 0, y: 0 });
  // the picture may have been resized since it was dragged: it still has to cover its frame
  const pan = clampPan(rawPan, zoom, w, h);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; pan: { x: number; y: number }; dist: number; zoom: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const maxZoom = ZOOMS[ZOOMS.length - 1];

  /** Zoom to `z`, keeping the point (cx, cy) of the frame where it is. */
  function zoomTo(z: number, cx = w / 2, cy = h / 2) {
    const next = Math.min(maxZoom, Math.max(1, z));
    setPan((p) => clampPan({ x: cx - ((cx - p.x) * next) / zoom, y: cy - ((cy - p.y) * next) / zoom }, next, w, h));
    setZoom(next);
  }
  // the buttons zoom towards the leaves (the tree's crown), not the trunk
  const focusY = art ? art.crown.cy * w : h / 2;
  const stepIn = () => zoomTo(ZOOMS.find((z) => z > zoom + 0.01) ?? maxZoom, w / 2, focusY);
  const stepOut = () => zoomTo([...ZOOMS].reverse().find((z) => z < zoom - 0.01) ?? 1, w / 2, focusY);

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { x: e.clientX, y: e.clientY, pan, dist, zoom, moved: false };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length > 1 && g.dist > 0) {
      // pinch: zoom around the middle of the two fingers
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomTo((g.zoom * d) / g.dist, (pts[0].x + pts[1].x) / 2 - box.left, (pts[0].y + pts[1].y) / 2 - box.top);
      moved.current = true;
    } else if (zoom > 1) {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (Math.abs(dx) + Math.abs(dy) > 4 && !moved.current) {
        moved.current = true;
        // keep following the finger outside the picture, and don't count the drag as a tap on a leaf
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
      setPan(clampPan({ x: g.pan.x + dx, y: g.pan.y + dy }, zoom, w, h));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    gesture.current = pointers.current.size ? { ...gesture.current!, x: e.clientX, y: e.clientY, pan, zoom, dist: 0 } : null;
  }
  // a drag that ends on a leaf isn't a tap on it
  const open = (id: string) => {
    if (!moved.current) onOpen(id);
  };

  const n = answers.length;
  // every leaf is the same size: the biggest at which none of them touch (lib/tree.ts)
  const piece = art ? Math.floor(art.leafSize(n) * w) : Math.round(w * pieceShare(n) * (wide ? 0.8 : 1));
  const font = piece * (art ? FONT_SHARE : 0.1);
  const showText = font * zoom >= 9;
  // where the stars go: most of the sky
  const area = { l: 0.05, t: 0.07, w: 0.9, h: 0.8 };
  const label = board === "tree" ? `A tree with ${plural(n, "leaf")}` : `A night sky with ${plural(n, "star")}`;
  // one line beside the zoom buttons: the long wording wrapped on a phone-sized picture
  const one = board === "tree" ? "leaf" : "star";
  const hint = w < 360 ? `Tap a ${one} to read it` : `Zoom in or tap a ${one} to read it`;
  const zoomBtn =
    "flex h-9 min-w-9 items-center justify-center rounded-full border border-line-strong bg-white px-2 text-lg font-bold text-ink shadow-sm disabled:opacity-40";

  return (
    <div
      ref={ref}
      className={fit.on ? "flex w-full justify-center overflow-hidden" : "w-full"}
      data-fit-flex={fit.on ? ratio : undefined}
      data-fit-min={fit.on ? SCENE_FIT_MIN : undefined}
    >
      {width > 0 && h > 0 && (
        <div
          role="group"
          aria-label={label}
          className="relative mx-auto shrink-0 overflow-hidden rounded-2xl border border-line-strong select-none"
          style={{
            width: w,
            height: h,
            touchAction: zoom > 1 ? "none" : "pan-y",
            cursor: zoom > 1 ? "grab" : undefined,
            background:
              board === "tree"
                ? TREE_SKY
                : `radial-gradient(120% 90% at 50% 100%, ${tinted("#2b3a6b")} 0%, ${tinted("#141a33")} 60%, ${tinted("#0c1024")} 100%)`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {art ? <TreeArt art={art} w={w} h={h} /> : <SkyArt w={w} h={h} />}
            {answers.map((a, i) => {
              const name = a.author ? ` — ${a.author}` : "";
              if (art) {
                // the leaf's stalk sits on its twig and the leaf grows out of it like a real one:
                // turned off the twig, pointing the way the twig grows, nearly level
                const leaf = art.leaf(i);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => open(a.id)}
                    aria-label={`Leaf: ${a.text}${name}`}
                    title={`${a.text}${name}`}
                    className="animate-grow absolute flex items-center justify-center text-center leading-tight font-bold hover:z-10 hover:scale-110 focus-visible:z-10"
                    style={{
                      ...leafStyle(leaf, piece / w, (share) => share * w),
                      animationDelay: `${Math.min(i * 40, 1200)}ms`,
                      transition: "scale 150ms, width 400ms, height 400ms, font-size 400ms, padding 400ms",
                    }}
                  >
                    <LeafShape color={LEAVES[pieceShade(a.id, LEAVES.length)]} flip={leaf.side === -1} />
                    {showText && <span className="relative line-clamp-3 [overflow-wrap:anywhere]">{a.text}</span>}
                  </button>
                );
              }
              const p = boardSpot(board, i);
              const left = (area.l + p.x * area.w) * w;
              const top = (area.t + p.y * area.h) * h;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => open(a.id)}
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
          </div>
          {n === 0 && (
            <p
              className="absolute inset-x-0 bottom-[1.5%] px-4 text-center text-[clamp(0.95rem,1.5vw,1.5rem)] font-bold"
              style={{ color: board === "tree" ? "#41552f" : "#e9e6ff" }}
            >
              {board === "tree" ? "Leaves will grow here as people answer." : "Stars will light up as people answer."}
            </p>
          )}
          {n > 0 && !showText && zoom === 1 && (
            <p className="pointer-events-none absolute bottom-3.5 left-2 right-24">
              <span className="rounded-full bg-white/85 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-ink">{hint}</span>
            </p>
          )}
          {n > 0 && (
            <div className="absolute right-2 bottom-2 flex gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
              {zoom > 1 && (
                <button type="button" className={`${zoomBtn} text-sm`} onClick={() => zoomTo(1)} aria-label={`Show the whole ${board}`}>
                  Fit
                </button>
              )}
              <button type="button" className={zoomBtn} onClick={stepOut} disabled={zoom <= 1} aria-label="Zoom out">
                −
              </button>
              <button type="button" className={zoomBtn} onClick={stepIn} disabled={zoom >= maxZoom} aria-label="Zoom in">
                +
              </button>
            </div>
          )}
        </div>
      )}

    </div>
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
  // the latest handlers: they change on every refresh of the results, and the box must not start over then
  const handlers = useRef({ onClose, onStep });
  useEffect(() => {
    handlers.current = { onClose, onStep };
  });
  useEffect(() => {
    closeRef.current?.focus();
    // The results screen has keys of its own (Esc = all questions, arrows = the next question, F, Q, 1–5).
    // While this box is open the keys belong to it: handle them first and stop them here, or Esc would
    // also leave the question and an arrow would also change the board behind the box.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") handlers.current.onClose();
      else if (e.key === "ArrowRight") handlers.current.onStep(1);
      else if (e.key === "ArrowLeft") handlers.current.onStep(-1);
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const info = boardInfo(board);
  // a paragraph gets smaller words and a plainer shape, so it all fits inside the box
  const size = pieceTextSize(answer.text);
  const textSize = { big: "text-[clamp(1.5rem,4vw,3.2rem)]", medium: "text-[clamp(1.25rem,2.8vw,2.2rem)]", small: "text-[clamp(1.05rem,1.9vw,1.6rem)]" }[size];
  const style =
    board === "tree"
      ? { background: tinted(LEAVES[pieceShade(answer.id, LEAVES.length)]), color: LEAF_INK, borderRadius: size === "big" ? "70% 0" : "2.5rem 0.75rem" }
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
          {/* never taller than the screen (minus the buttons): a long one scrolls inside */}
          <div
            className="flex max-h-[calc(100dvh-9rem)] min-h-[min(40vh,20rem)] flex-col items-center gap-4 overflow-y-auto p-[clamp(1.5rem,4vw,3.5rem)] text-center shadow-2xl"
            style={style}
          >
            {board === "sky" && <Star size={48} />}
            <p className={`font-display my-auto ${textSize} ${size === "small" ? "leading-snug" : "leading-tight"} font-semibold [overflow-wrap:anywhere]`}>{answer.text}</p>
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
