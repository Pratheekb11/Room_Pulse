// The motivation tree's drawing, shared by the real board (components/results/BoardView.tsx) and the
// home page (components/MiniTree.tsx): the scene, the tree itself and the leaf every answer becomes.
// No hooks that need the browser, so the home page can draw it on the server.
import { useId, type CSSProperties } from "react";
import { tinted } from "@/lib/colors";
import { LEAF_RATIO, type Tree, type TreeLeaf } from "@/lib/tree";

// Leaves are fresh greens (a few turning yellow) with dark green ink.
export const LEAVES = ["#bfe39a", "#a9d983", "#97cf72", "#d3eaa0", "#b4de8c", "#ecdc8a"] as const;
export const LEAF_INK = tinted("#1f3b16");
/** The sky behind the tree. */
export const TREE_SKY = `linear-gradient(180deg, ${tinted("#e7f4fb")} 0%, ${tinted("#f6f9ec")} 70%, ${tinted("#e4efcf")} 100%)`;

/**
 * Where a leaf goes and how it's turned: its stalk on its spot on the twig, the blade growing out from there.
 * `size` is the leaf's length in picture widths; `len` turns picture widths into a CSS length (pixels on the
 * board, container units on the home page).
 */
export function leafStyle(leaf: TreeLeaf, size: number, len: (share: number) => number | string): CSSProperties {
  const right = leaf.side === 1;
  // the flipped leaf's tip is on its left, so tipping it down turns it the other way
  const angle = right ? leaf.tilt : -leaf.tilt;
  return {
    left: len(leaf.x),
    top: len(leaf.y),
    width: len(size),
    height: len(size * LEAF_RATIO),
    // the words sit in the wide middle of the blade, clear of its pointed ends
    paddingBlock: len(size * 0.07),
    paddingLeft: len(size * (right ? 0.235 : 0.165)),
    paddingRight: len(size * (right ? 0.165 : 0.235)),
    lineHeight: 1.12,
    color: LEAF_INK,
    fontSize: len(size * FONT_SHARE),
    transformOrigin: right ? "0% 50%" : "100% 50%",
    transform: `translate(${right ? 0 : -100}%, -50%) rotate(${angle}deg)`,
  };
}

export const FONT_SHARE = 0.105; // a leaf's words, as a share of its length
// The blade: the same above and below its middle vein, round near the stalk and pointed at the tip.
const BLADE = "M10 30 C 30 -3, 72 0, 99 30 C 72 60, 30 63, 10 30 Z";

/** A leaf: a stalk on the left (or right when flipped), a blade with a middle vein and a few side veins. Every leaf has this shape. */
export function LeafShape({ color, flip }: { color: string; flip: boolean }) {
  const id = useId();
  const light = tinted(color);
  const vein = tinted("#4f7f30");
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full overflow-visible drop-shadow-[0_1.5px_1.5px_rgb(40_60_20/0.3)]"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={light} stopOpacity={0.84} />
        </linearGradient>
      </defs>
      <path data-part="stem" d="M0 30 L 14 30" stroke={tinted("#5d3b25")} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <path d={BLADE} fill={tinted("#3f6b25")} />
      <path d={BLADE} fill={`url(#${id})`} stroke={vein} strokeOpacity={0.55} strokeWidth={1.2} />
      <path data-part="vein" d="M12 30 L 95 30" stroke={vein} strokeOpacity={0.4} strokeWidth={1.3} fill="none" />
      <g stroke={vein} strokeOpacity={0.16} strokeWidth={1} fill="none" strokeLinecap="round">
        <path d="M30 30 Q 38 21 47 15" />
        <path d="M52 30 Q 60 22 69 17" />
        <path d="M30 30 Q 38 39 47 45" />
        <path d="M52 30 Q 60 38 69 43" />
      </g>
    </svg>
  );
}

/**
 * The tree: sun, clouds and hills, a trunk that flares into roots, tapering limbs and a soft crown behind them (lib/tree.ts).
 * `w` and `h` are the drawing's size in its own units (pixels on the board); it fills its box.
 */
export function TreeArt({ art, w, h }: { art: Tree; w: number; h: number }) {
  const P = (v: number) => Math.round(v * w * 10) / 10;
  const bark = tinted("#7a5034");
  const barkDark = tinted("#5d3b25");
  const barkLight = tinted("#a07150");
  const trunkR = Math.max(...art.limbs.map((b) => b.r1)) * w;
  const bx = art.base.x * w;
  const ground = art.base.y * w;
  // a tapering piece of limb: a four-sided shape from half-width r1 to r2
  const limb = (x1: number, y1: number, x2: number, y2: number, r1: number, r2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = (-(y2 - y1) / len) * w;
    const ny = ((x2 - x1) / len) * w;
    return `M${P(x1) + nx * r1} ${P(y1) + ny * r1}L${P(x2) + nx * r2} ${P(y2) + ny * r2}L${P(x2) - nx * r2} ${P(y2) - ny * r2}L${P(x1) - nx * r1} ${P(y1) - ny * r1}Z`;
  };
  const wood = art.limbs.map((b) => limb(b.x1, b.y1, b.x2, b.y2, b.r1, b.r2)).join("");
  // the crown's soft shape: a puff round every branch above the trunk
  const leafy = art.limbs.filter((b) => b.twig);
  const puff = Math.min(art.crown.rx, art.crown.ry) * 0.22 * w;
  // light down one side of the trunk and big limbs, shade down the other (one path each, so joints don't show)
  const thick = art.limbs.filter((b) => b.r2 * w > 2.5 && b.r1 > art.limbs[0].r1 * 0.3);
  const edge = (k: number) => thick.map((b) => `M${P(b.x1) + b.r1 * w * k} ${P(b.y1)}L${P(b.x2) + b.r2 * w * k} ${P(b.y2)}`).join("");
  const cloud = (cx: number, cy: number, s: number) => (
    <g fill="#fff" opacity={0.85}>
      <ellipse cx={cx} cy={cy} rx={s * 1.6} ry={s * 0.55} />
      <circle cx={cx - s * 0.6} cy={cy - s * 0.25} r={s * 0.5} />
      <circle cx={cx + s * 0.25} cy={cy - s * 0.45} r={s * 0.65} />
    </g>
  );
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full">
      <circle cx={w * 0.9} cy={h * 0.1} r={Math.max(14, Math.min(w, h) * 0.06)} fill={tinted("#ffe8a3")} opacity={0.9} />
      {cloud(w * 0.1, h * 0.09, Math.max(12, w * 0.035))}
      {cloud(w * 0.76, h * 0.05, Math.max(10, w * 0.026))}
      <g data-part="hills">
        <path d={`M 0 ${h * 0.8} Q ${w * 0.22} ${h * 0.7} ${w * 0.48} ${h * 0.8} T ${w} ${h * 0.76} L ${w} ${h} L 0 ${h} Z`} fill={tinted("#c9e3a6")} />
        <path d={`M 0 ${h * 0.9} Q ${w * 0.3} ${h * 0.84} ${w * 0.6} ${h * 0.89} T ${w} ${h * 0.87} L ${w} ${h} L 0 ${h} Z`} fill={tinted("#9fcd78")} />
        <ellipse cx={bx} cy={ground + h * 0.012} rx={trunkR * 5.5} ry={h * 0.02} fill={tinted("#6f9f4f")} opacity={0.45} />
      </g>
      {/* a soft crown behind the branches, so the tree looks full before many answers arrive */}
      <g data-part="canopy" opacity={0.42}>
        <g fill={tinted("#b9dc98")}>
          {leafy.map((b, i) => (
            <circle key={i} cx={P(b.x2)} cy={P(b.y2)} r={puff} />
          ))}
        </g>
      </g>
      {/* roots: the trunk flares out where it meets the ground */}
      <path
        d={`M ${bx - trunkR} ${ground - trunkR * 4.5} C ${bx - trunkR} ${ground - trunkR * 1.8}, ${bx - trunkR * 1.8} ${ground - trunkR * 0.3}, ${bx - trunkR * 3.2} ${ground + h * 0.012}
            L ${bx + trunkR * 3.2} ${ground + h * 0.012} C ${bx + trunkR * 1.8} ${ground - trunkR * 0.3}, ${bx + trunkR} ${ground - trunkR * 1.8}, ${bx + trunkR} ${ground - trunkR * 4.5} Z`}
        fill={bark}
      />
      <g fill={bark} stroke={bark} strokeLinejoin="round">
        <path d={wood} strokeWidth={0.6} />
        {art.limbs.map((b, i) => (
          <circle key={i} cx={P(b.x2)} cy={P(b.y2)} r={Math.max(0.5, b.r2 * w)} stroke="none" />
        ))}
      </g>
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={edge(0.42)} stroke={barkLight} strokeOpacity={0.5} strokeWidth={Math.max(1, trunkR * 0.3)} />
        <path d={edge(-0.55)} stroke={barkDark} strokeOpacity={0.3} strokeWidth={Math.max(1, trunkR * 0.25)} />
      </g>
    </svg>
  );
}
