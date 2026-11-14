"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { arrivalOrder, boardInfo, boardSpot, clampPan, leafTilt, pieceShade, pieceSize, sceneSize, ZOOMS, type BoardId } from "@/lib/boards";
import { tinted } from "@/lib/colors";
import { leafSide, TREE_BRANCHES, treeFork } from "@/lib/tree";
import type { TextAnswer } from "@/lib/types";
import { ToBody } from "../Portal";

// Leaves are fresh greens (a few turning yellow) with dark green ink; notes are pastel; stars are gold.
const LEAVES = ["#bfe39a", "#a9d983", "#97cf72", "#d3eaa0", "#b4de8c", "#ecdc8a"] as const;
const LEAF_INK = "#1f3b16";
const NOTES = ["#fff1a8", "#ffd6e0", "#cfe8ff", "#d6f5c9", "#ffe0bf", "#e8dcff"] as const;
const NOTE_INK = "#2b2620";

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w === "leaf" ? "leaves" : `${w}s`}`;

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
  // phones draw leaves too small to read, so the list starts open there
  const [listOpen, setListOpen] = useState(() => typeof window !== "undefined" && window.innerWidth < 560);
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

/**
 * The tree or the sky, drawn to fit: as wide as there's room for and never taller than the screen,
 * so the whole picture is always in view. Zoom in (buttons, or pinch) to read small leaves; drag to look around.
 */
function Scene({ board, answers, onOpen }: { board: "tree" | "sky"; answers: TextAnswer[]; onOpen: (id: string) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [screen, setScreen] = useState({ vh: 0, top: 0 });
  // Where the picture starts moves as things above it load (description, picture, live pills), so measure
  // after every render and on resize; only a real change re-renders.
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = { vh: window.innerHeight, top: Math.round(el.getBoundingClientRect().top + window.scrollY) };
    setScreen((cur) => (Math.abs(cur.vh - next.vh) > 2 || Math.abs(cur.top - next.top) > 2 ? next : cur));
  }, [ref]);
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
  const { w, h } = sceneSize(width, screen.vh || 800, screen.top);
  const wide = width >= 560;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
  const focusY = board === "tree" ? h * 0.3 : h / 2;
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
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
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
  const piece = board === "tree" ? pieceSize(w, h, n) : Math.round(w * pieceShare(n) * (wide ? 0.8 : 1));
  const font = piece * (board === "tree" ? 0.115 : 0.1);
  const showText = font * zoom >= 9;
  // where the pieces go: the canopy, or most of the sky
  const area = board === "tree" ? crownBox(w, h) : { l: 0.05, t: 0.07, w: 0.9, h: 0.8 };
  const label = board === "tree" ? `A tree with ${plural(n, "leaf")}` : `A night sky with ${plural(n, "star")}`;
  const zoomBtn =
    "flex h-9 min-w-9 items-center justify-center rounded-full border border-line-strong bg-white px-2 text-lg font-bold text-ink shadow-sm disabled:opacity-40";

  return (
    <div ref={ref} className="w-full">
      {width > 0 && (
        <div
          role="group"
          aria-label={label}
          className="relative mx-auto overflow-hidden rounded-2xl border border-line-strong select-none"
          style={{
            width: w,
            height: h,
            touchAction: zoom > 1 ? "none" : "pan-y",
            cursor: zoom > 1 ? "grab" : undefined,
            background:
              board === "tree"
                ? `linear-gradient(180deg, ${tinted("#e7f4fb")} 0%, ${tinted("#f6f9ec")} 70%, ${tinted("#e4efcf")} 100%)`
                : `radial-gradient(120% 90% at 50% 100%, ${tinted("#2b3a6b")} 0%, ${tinted("#141a33")} 60%, ${tinted("#0c1024")} 100%)`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {board === "tree" ? <TreeArt w={w} h={h} /> : <SkyArt w={w} h={h} />}
            {answers.map((a, i) => {
              const p = boardSpot(board, i);
              const left = (area.l + p.x * area.w) * w;
              const top = (area.t + p.y * area.h) * h;
              const name = a.author ? ` — ${a.author}` : "";
              if (board === "tree") {
                // hang the leaf by its stem from its spot on the branch, growing away from the trunk
                // (or inwards when there's no room at the edge of the picture)
                let side = leafSide(p, a.id);
                if (side === 1 && left + piece > w && left - piece >= 0) side = -1;
                else if (side === -1 && left - piece < 0 && left + piece <= w) side = 1;
                const angle = side * (leafTilt(a.id) * 0.8 - 8);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => open(a.id)}
                    aria-label={`Leaf: ${a.text}${name}`}
                    title={`${a.text}${name}`}
                    className="animate-grow absolute flex items-center justify-center text-center leading-tight font-bold hover:z-10 hover:scale-110 focus-visible:z-10"
                    style={{
                      left,
                      top,
                      width: piece,
                      height: piece * LEAF_RATIO,
                      paddingBlock: piece * 0.06,
                      paddingLeft: piece * (side === 1 ? 0.2 : 0.1),
                      paddingRight: piece * (side === 1 ? 0.1 : 0.2),
                      color: LEAF_INK,
                      fontSize: font,
                      transformOrigin: side === 1 ? "0% 50%" : "100% 50%",
                      transform: `translate(${side === 1 ? 0 : -100}%, -50%) rotate(${angle}deg)`,
                      animationDelay: `${Math.min(i * 40, 1200)}ms`,
                      transition: "scale 150ms",
                    }}
                  >
                    <LeafShape color={LEAVES[pieceShade(a.id, LEAVES.length)]} flip={side === -1} />
                    {showText && <span className="relative line-clamp-3 [overflow-wrap:anywhere]">{a.text}</span>}
                  </button>
                );
              }
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
              className="absolute inset-x-0 bottom-[6%] px-4 text-center text-[clamp(1rem,1.6vw,1.6rem)] font-bold"
              style={{ color: board === "tree" ? "#41552f" : "#e9e6ff" }}
            >
              {board === "tree" ? "Leaves will grow here as people answer." : "Stars will light up as people answer."}
            </p>
          )}
          {n > 0 && !showText && zoom === 1 && (
            <p className="pointer-events-none absolute inset-x-0 top-2 text-center">
              <span className="rounded-full bg-white/85 px-2.5 py-1 text-xs font-bold text-ink">Zoom in or tap a {board === "tree" ? "leaf" : "star"} to read it</span>
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

const LEAF_RATIO = 0.56;
/**
 * Where the crown's box sits in the picture (the same box the leaf spots use). On a tall picture
 * (phones) the crown takes more of the height and the trunk is shorter, so leaves get more room.
 */
const crownBox = (w: number, h: number) => (h > w ? { l: 0.05, t: 0.03, w: 0.9, h: 0.78 } : { l: 0.08, t: 0.04, w: 0.84, h: 0.64 });

/** A leaf: a pointed blade with a stem on the left (or right when flipped), a middle vein and a few side veins. */
function LeafShape({ color, flip }: { color: string; flip: boolean }) {
  const id = useId();
  const light = tinted(color);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 56"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_1.5px_1.5px_rgb(40_60_20/0.28)]"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={light} stopOpacity={0.82} />
        </linearGradient>
      </defs>
      <path data-part="stem" d="M0 28 Q 6 27 12 28" stroke={tinted("#6d4a2c")} strokeWidth={3} strokeLinecap="round" fill="none" />
      <path d="M10 28 C 24 6, 66 -2, 99 20 C 90 42, 56 60, 10 28 Z" fill={tinted("#3f6b25")} opacity={0.25} transform="translate(0 1.5)" />
      <path d="M10 28 C 24 6, 66 -2, 99 20 C 90 42, 56 60, 10 28 Z" fill={`url(#${id})`} stroke={tinted("#5b8a3a")} strokeOpacity={0.45} strokeWidth={1} />
      <path data-part="vein" d="M11 28 Q 52 25 96 21" stroke={tinted("#5b8a3a")} strokeOpacity={0.5} strokeWidth={1.4} fill="none" />
      <g stroke={tinted("#5b8a3a")} strokeOpacity={0.2} strokeWidth={1} fill="none">
        <path d="M32 26.6 Q 40 18 48 12" />
        <path d="M54 25 Q 62 17 70 10" />
        <path d="M36 27 Q 46 35 54 42" />
        <path d="M60 24.6 Q 70 31 78 35" />
      </g>
    </svg>
  );
}

/** The tree: sky, sun, clouds and hills, a flared trunk and tapering branches (lib/tree.ts). */
function TreeArt({ w, h }: { w: number; h: number }) {
  const CROWN = crownBox(w, h);
  const X = (x: number) => (CROWN.l + x * CROWN.w) * w;
  const Y = (y: number) => (CROWN.t + y * CROWN.h) * h;
  const W = (k: number) => Math.max(1.2, k * CROWN.w * w);
  const bark = tinted("#7a5034");
  const barkDark = tinted("#5d3b25");
  const barkLight = tinted("#a07150");
  // the trunk runs straight up to where it first splits (the stem that carries on from it isn't drawn again)
  const stem = TREE_BRANCHES.filter((b) => b.level === 0);
  const fork = treeFork();
  const fx = X(fork.x);
  const fy = Y(stem[stem.length - 1].y2);
  const top = W(stem[stem.length - 1].w2) / 2;
  const ground = h * 0.9;
  const base = Math.max(top * 1.7, w * 0.04);
  // a tapering piece of branch: a four-sided shape from width w1 to w2, with round joints
  const limb = (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    return `M ${x1 + nx * r1} ${y1 + ny * r1} L ${x2 + nx * r2} ${y2 + ny * r2} L ${x2 - nx * r2} ${y2 - ny * r2} L ${x1 - nx * r1} ${y1 - ny * r1} Z`;
  };
  const cloud = (cx: number, cy: number, s: number) => (
    <g fill="#fff" opacity={0.85}>
      <ellipse cx={cx} cy={cy} rx={s * 1.6} ry={s * 0.55} />
      <circle cx={cx - s * 0.6} cy={cy - s * 0.25} r={s * 0.5} />
      <circle cx={cx + s * 0.25} cy={cy - s * 0.45} r={s * 0.65} />
    </g>
  );
  return (
    <svg aria-hidden="true" width={w} height={h} className="absolute inset-0">
      <circle cx={w * 0.86} cy={h * 0.13} r={Math.max(14, Math.min(w, h) * 0.07)} fill={tinted("#ffe8a3")} opacity={0.9} />
      {cloud(w * 0.16, h * 0.12, Math.max(12, w * 0.04))}
      {cloud(w * 0.7, h * 0.07, Math.max(10, w * 0.03))}
      <g data-part="hills">
        <path d={`M 0 ${h * 0.8} Q ${w * 0.22} ${h * 0.7} ${w * 0.48} ${h * 0.8} T ${w} ${h * 0.76} L ${w} ${h} L 0 ${h} Z`} fill={tinted("#c9e3a6")} />
        <path d={`M 0 ${h * 0.9} Q ${w * 0.3} ${h * 0.84} ${w * 0.6} ${h * 0.89} T ${w} ${h * 0.87} L ${w} ${h} L 0 ${h} Z`} fill={tinted("#9fcd78")} />
        <ellipse cx={fx} cy={ground + h * 0.012} rx={base * 3.2} ry={h * 0.022} fill={tinted("#6f9f4f")} opacity={0.45} />
      </g>
      {/* trunk, flaring into roots at the ground */}
      <path
        d={`M ${fx - top} ${fy - top} C ${fx - top * 1.2} ${fy + (ground - fy) * 0.55}, ${fx - base * 0.8} ${ground - h * 0.05}, ${fx - base * 1.6} ${ground + h * 0.01}
            L ${fx + base * 1.6} ${ground + h * 0.01} C ${fx + base * 0.8} ${ground - h * 0.05}, ${fx + top * 1.2} ${fy + (ground - fy) * 0.55}, ${fx + top} ${fy - top} Z`}
        fill={bark}
      />
      <path d={`M ${fx + top * 0.25} ${fy + h * 0.02} C ${fx + top * 0.4} ${(fy + ground) / 2}, ${fx + base * 0.45} ${ground - h * 0.06}, ${fx + base * 0.8} ${ground}`} stroke={barkLight} strokeOpacity={0.6} strokeWidth={Math.max(1.5, top * 0.35)} fill="none" strokeLinecap="round" />
      <path d={`M ${fx - top * 0.5} ${fy + h * 0.06} C ${fx - top * 0.6} ${(fy + ground) / 2}, ${fx - base * 0.6} ${ground - h * 0.08}, ${fx - base * 1.1} ${ground}`} stroke={barkDark} strokeOpacity={0.45} strokeWidth={Math.max(1, top * 0.25)} fill="none" strokeLinecap="round" />
      <g fill={bark}>
        {TREE_BRANCHES.map((b, i) => {
          if (b.level === 0) return null;
          const r1 = W(b.w1) / 2;
          const r2 = W(b.w2) / 2;
          return (
            <g key={i}>
              <path d={limb(X(b.x1), Y(b.y1), X(b.x2), Y(b.y2), r1, r2)} />
              <circle cx={X(b.x2)} cy={Y(b.y2)} r={r2} />
            </g>
          );
        })}
      </g>
      {/* little leaf buds on the twig tips, so the tree looks alive before many answers arrive */}
      <g fill={tinted("#6fa84a")} opacity={0.75}>
        {TREE_BRANCHES.filter((b) => b.tip).map((b, i) => {
          const s = Math.max(3, w * 0.009);
          const a = (Math.atan2(Y(b.y2) - Y(b.y1), X(b.x2) - X(b.x1)) * 180) / Math.PI;
          return <ellipse key={i} cx={X(b.x2)} cy={Y(b.y2)} rx={s * 1.5} ry={s * 0.7} transform={`rotate(${a} ${X(b.x2)} ${Y(b.y2)})`} />;
        })}
      </g>
      {/* a light edge along the bigger branches */}
      <g stroke={barkLight} strokeOpacity={0.45} strokeLinecap="round" fill="none">
        {TREE_BRANCHES.filter((b) => b.level > 0 && b.level < 3).map((b, i) => (
          <path key={i} d={`M ${X(b.x1)} ${Y(b.y1) - W(b.w1) * 0.18} L ${X(b.x2)} ${Y(b.y2) - W(b.w2) * 0.18}`} strokeWidth={Math.max(0.8, W(b.w2) * 0.22)} />
        ))}
      </g>
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
      ? { background: tinted(LEAVES[pieceShade(answer.id, LEAVES.length)]), color: LEAF_INK, borderRadius: "70% 0" }
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
