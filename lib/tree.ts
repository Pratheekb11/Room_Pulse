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
/** A spot on a branch, and which way that branch grows there (a unit vector in the crown's box). */
export interface LeafSpot {
  x: number;
  y: number;
  dx: number;
  dy: number;
}
let candidates: LeafSpot[] | null = null;
const order: number[] = [];
let gap: number[] = [];
let centres: { x: number; y: number }[] = [];

function allCandidates() {
  if (candidates) return candidates;
  const pts: LeafSpot[] = [];
  for (const b of TREE_BRANCHES) {
    if (b.level < 2) continue; // leaves grow on the outer branches, not the big limbs
    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1;
    const dx = (b.x2 - b.x1) / len;
    const dy = (b.y2 - b.y1) / len;
    const steps = Math.max(1, Math.round(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 0.02));
    for (let s = 0; s <= steps; s++) {
      const x = b.x1 + ((b.x2 - b.x1) * s) / steps;
      const y = b.y1 + ((b.y2 - b.y1) * s) / steps;
      if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 0.012)) continue;
      pts.push({ x, y, dx, dy });
    }
  }
  candidates = pts;
  gap = pts.map(() => Infinity);
  // where each leaf's middle lands on a typical big screen: leaves are spread by their middles,
  // since a leaf reaches out from its stalk and two stalks apart can still put leaves on top of each other
  const W = 670;
  const H = 320;
  centres = pts.map((p) => {
    const { side, angle } = leafPose(p, "", W, H);
    const a = (angle * Math.PI) / 180;
    return { x: p.x + (side * Math.cos(a) * 0.5 * 110) / W, y: p.y + (Math.sin(a) * 0.5 * 110) / H };
  });
  return pts;
}

/** The spot (0..1 in the crown's box) of the leaf that arrived `index`-th; earlier leaves never move. */
export function treeLeafSpot(index: number): { x: number; y: number } {
  const { x, y } = treeLeafAt(index);
  return { x, y };
}

/** The leaf that arrived `index`-th: its spot and which way its branch grows there. */
export function treeLeafAt(index: number): LeafSpot {
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
    const c = centres[best];
    const at = pts[best];
    // apart both where the stalks sit and where the leaves' middles land
    for (let i = 0; i < pts.length; i++)
      gap[i] = Math.min(gap[i], Math.hypot(centres[i].x - c.x, centres[i].y - c.y), Math.hypot(pts[i].x - at.x, pts[i].y - at.y));
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

const LEAF_TURN = 45; // how far a leaf turns out from its branch, in degrees
// how far a leaf may tip from level, in degrees, so its words read easily: up (−) more than down (+),
// since leaves reaching up look alive and drooping ones look wilted
const LEAF_UP = -32;
const LEAF_DOWN = 20;
const MIN_OFF_BRANCH = 20; // a leaf sticks out at least this far from its branch, in degrees

/**
 * How a leaf grows out of its branch, like a real one: turned 45° off the branch (the more level way),
 * pointing the way the branch grows (out from the trunk), and tipped at most 35° from level.
 * `w` and `h` are the crown box's size on screen, since the tree is stretched to fit it.
 * side: 1 = the leaf points right of its stalk, −1 = left. angle: degrees, + = the tip tips down.
 */
export function leafPose(at: LeafSpot, id: string, w: number, h: number): { side: 1 | -1; angle: number } {
  const base = (Math.atan2(at.dy * h, at.dx * w) * 180) / Math.PI;
  const ways = [base + LEAF_TURN, base - LEAF_TURN].map((deg) => {
    const x = Math.cos((deg * Math.PI) / 180);
    const side: 1 | -1 = x >= 0 ? 1 : -1;
    // the tilt from level, seen from the leaf's own side, kept within reach
    const raw = side === 1 ? deg : 180 - deg;
    const tilt = Math.max(LEAF_UP, Math.min(LEAF_DOWN, ((raw + 540) % 360) - 180));
    // how far that leaf, once tilted, ends up from its branch
    const leafDeg = side === 1 ? tilt : 180 - tilt;
    const off = Math.abs(((leafDeg - base + 540) % 360) - 180);
    return { side, tilt, off };
  });
  let options = ways.filter((v) => v.off >= MIN_OFF_BRANCH);
  if (!options.length) options = ways;
  // on a branch that clearly goes one way, the leaf goes that way too
  if (Math.abs(at.dx) > 0.3) {
    const along = options.filter((v) => v.side === Math.sign(at.dx));
    if (along.length) options = along;
  }
  // the more level one, counting a downward tip as worse; a near tie goes by the answer, the same every time
  const cost = (v: { tilt: number }) => (v.tilt > 0 ? v.tilt * 2.2 : -v.tilt);
  const [a, b] = options;
  const pick = !b ? a : Math.abs(cost(a) - cost(b)) < 6 ? options[hash(id) % 2] : cost(a) <= cost(b) ? a : b;
  return { side: pick.side, angle: Math.round(pick.tilt * 10) / 10 };
}
