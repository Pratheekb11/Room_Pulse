// The motivation tree's shape: a branching tree drawn from a fixed seed, and the spots on its
// branches where leaves sit. Coordinates are 0..1 across and down the crown's box (the tree's
// fill area in BoardView), y pointing down; widths are shares of the box's width.

export interface Branch {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Thickness where it starts and where it ends. */
  w1: number;
  w2: number;
  /** An outermost twig. */
  tip: boolean;
  /** How many forks from the trunk (0 = the stem that carries on from the trunk). */
  level: number;
}

/** Small seeded random numbers, so the tree is the same on every screen. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CROWN = 0.47; // branches stay this far from the crown's middle at most
const FORK = { x: 0.5, y: 0.97 };

/** Keeps a point inside the crown, pulling it towards the middle if needed. */
function inside(x: number, y: number) {
  const d = Math.hypot(x - 0.5, y - 0.5);
  if (d <= CROWN) return { x, y };
  return { x: 0.5 + ((x - 0.5) * CROWN) / d, y: 0.5 + ((y - 0.5) * CROWN) / d };
}

function buildTree(): Branch[] {
  const rnd = seeded(20261114);
  const out: Branch[] = [];
  const DEPTH = 5;
  function grow(x: number, y: number, angle: number, len: number, w: number, depth: number) {
    const end = inside(x + Math.sin(angle) * len, y - Math.cos(angle) * len);
    const w2 = w * 0.62;
    // a slight bend half way, so branches aren't ruler-straight
    const bend = depth === DEPTH ? 0 : (rnd() - 0.5) * 0.18 * len;
    const mid = inside((x + end.x) / 2 + Math.cos(angle) * bend, (y + end.y) / 2 + Math.sin(angle) * bend);
    const wm = (w + w2) / 2;
    const tip = depth === 0;
    const level = DEPTH - depth;
    out.push({ x1: x, y1: y, x2: mid.x, y2: mid.y, w1: w, w2: wm, tip: false, level });
    out.push({ x1: mid.x, y1: mid.y, x2: end.x, y2: end.y, w1: wm, w2, tip, level });
    if (tip) return;
    const three = depth >= DEPTH - 2 && rnd() < 0.5;
    for (const k of three ? [-1, 0, 1] : [-1, 1]) {
      const spread = ((20 + rnd() * 14) * Math.PI) / 180;
      // outer branches lean back up a little, like a real crown
      const a = angle + k * spread + (rnd() - 0.5) * 0.15 - angle * 0.22;
      const l = len * (0.68 + rnd() * 0.12) * (k === 0 ? 0.85 : 1);
      grow(end.x, end.y, a, l, w2 * (k === 0 ? 0.8 : 1), depth - 1);
    }
  }
  grow(FORK.x, FORK.y, 0, 0.3, 0.05, DEPTH);
  return out;
}

/** Every branch of the tree, thickest first. */
export const TREE_BRANCHES: readonly Branch[] = buildTree();

/** Where the trunk ends and the branches start. */
export const treeFork = () => ({ ...FORK });

// Spots on the branches where a leaf can sit: points along every branch above the trunk,
// a little apart, put in an order that spreads them out (each next one as far as possible
// from those before it), so the first few leaves already cover the whole tree and a leaf's
// spot depends only on its place in line.
let candidates: { x: number; y: number }[] | null = null;
const order: number[] = [];
let gap: number[] = [];

function allCandidates() {
  if (candidates) return candidates;
  const pts: { x: number; y: number }[] = [];
  for (const b of TREE_BRANCHES) {
    if (b.level < 2) continue; // leaves grow on the outer branches, not the big limbs
    const steps = Math.max(1, Math.round(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 0.02));
    for (let s = 0; s <= steps; s++) {
      const x = b.x1 + ((b.x2 - b.x1) * s) / steps;
      const y = b.y1 + ((b.y2 - b.y1) * s) / steps;
      if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 0.012)) continue;
      pts.push({ x, y });
    }
  }
  candidates = pts;
  gap = pts.map(() => Infinity);
  return pts;
}

/** The spot (0..1 in the crown's box) of the leaf that arrived `index`-th; earlier leaves never move. */
export function treeLeafSpot(index: number): { x: number; y: number } {
  const pts = allCandidates();
  while (order.length <= index && order.length < pts.length) {
    let best = -1;
    if (order.length === 0) {
      // start at the top of the crown
      best = pts.reduce((bi, p, i) => (p.y < pts[bi].y ? i : bi), 0);
    } else {
      for (let i = 0; i < pts.length; i++) if (gap[i] > 0 && (best < 0 || gap[i] > gap[best])) best = i;
    }
    order.push(best);
    for (let i = 0; i < pts.length; i++) gap[i] = Math.min(gap[i], Math.hypot(pts[i].x - pts[best].x, pts[i].y - pts[best].y));
  }
  return { ...pts[order[index % order.length]] };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Which way a leaf grows from its spot: 1 = to the right, −1 = to the left (away from the trunk). */
export function leafSide(spot: { x: number; y?: number }, id: string): 1 | -1 {
  if (Math.abs(spot.x - 0.5) > 0.04) return spot.x > 0.5 ? 1 : -1;
  return hash(id) % 2 ? 1 : -1;
}
