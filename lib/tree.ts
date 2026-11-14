// The motivation tree: its limbs, and where each leaf sits and how big leaves are.
// Everything is measured in picture widths (x from 0 to 1, y from 0 down to `aspect`), so the
// tree is never stretched: BoardView multiplies by the picture's width in pixels.
//
// The limbs grow towards points scattered through the crown ("space colonisation"), which gives a
// full, round tree with twigs everywhere in the crown. Leaves hang from the twigs by their stalks.
// The order leaves arrive in is worked out so that the first N are as far from touching each other
// as possible, and the size of a leaf is the biggest at which none of the first N touch.

export type TreeShape = "wide" | "tall";

export interface Limb {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Half its thickness where it starts and where it ends. */
  r1: number;
  r2: number;
  /** Thin enough for leaves to grow on. */
  twig: boolean;
  /** The last piece of a twig. */
  tip: boolean;
}

export interface TreeLeaf {
  /** Where its stalk joins the twig. */
  x: number;
  y: number;
  /** Which way the leaf points on screen, from stalk to tip, in degrees (0 = right, 90 = down). */
  angle: number;
  /** 1 = it points right of its stalk, −1 = left. */
  side: 1 | -1;
  /** How far its tip tips from level, in degrees: − = up, + = down. */
  tilt: number;
  /** Which way its twig grows there (a unit vector). */
  bx: number;
  by: number;
}

export interface Tree {
  shape: TreeShape;
  /** The picture's height in widths. */
  aspect: number;
  /** Every piece of trunk and branch, thickest first. */
  limbs: readonly Limb[];
  /** Where the trunk meets the ground. */
  base: { x: number; y: number };
  /** The crown's middle and reach. */
  crown: { cx: number; cy: number; rx: number; ry: number };
  /** The leaf that arrived `index`-th (0 = first). Earlier leaves never move. */
  leaf(index: number): TreeLeaf;
  /** How long every leaf is when there are `count` of them. */
  leafSize(count: number): number;
}

/** A leaf's height as a share of its length. */
export const LEAF_RATIO = 0.6;

/** The tall tree is for pictures taller than they are wide (phones). */
export const treeShape = (w: number, h: number): TreeShape => (h > w ? "tall" : "wide");

interface Spec {
  aspect: number;
  crown: { cx: number; cy: number; rx: number; ry: number };
  seed: number;
  /** How far a limb grows in one step. */
  step: number;
  /** How close a limb must come to a point in the crown to have reached it. */
  reach: number;
  /** How far apart the points in the crown are. */
  grid: number;
  /** Half the trunk's thickness, and half a twig tip's. */
  trunk: number;
  tipR: number;
  /** The biggest and smallest a leaf may be. */
  maxLeaf: number;
  minLeaf: number;
}

const SPECS: Record<TreeShape, Spec> = {
  wide: {
    aspect: 1 / 1.6,
    crown: { cx: 0.5, cy: 0.255, rx: 0.39, ry: 0.205 },
    seed: 20261114,
    step: 0.02,
    reach: 0.022,
    grid: 0.022,
    trunk: 0.02,
    tipR: 0.0016,
    maxLeaf: 0.12,
    minLeaf: 0.034,
  },
  tall: {
    aspect: 1 / 0.85,
    crown: { cx: 0.5, cy: 0.47, rx: 0.4, ry: 0.4 },
    seed: 20261115,
    step: 0.03,
    reach: 0.034,
    grid: 0.034,
    trunk: 0.03,
    tipR: 0.0028,
    maxLeaf: 0.24,
    minLeaf: 0.06,
  },
};

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

interface Node {
  x: number;
  y: number;
  parent: number;
  kids: number[];
  r: number;
}

/** Grows the limbs: a trunk up from the ground, then branches towards every part of the crown. */
function grow(spec: Spec): Node[] {
  const rnd = seeded(spec.seed);
  const { cx, cy, rx, ry } = spec.crown;
  // points to reach: an even, slightly shaken grid inside the crown
  let targets: { x: number; y: number }[] = [];
  for (let gy = cy - ry; gy <= cy + ry; gy += spec.grid)
    for (let gx = cx - rx; gx <= cx + rx; gx += spec.grid) {
      const x = gx + (rnd() - 0.5) * spec.grid * 0.7;
      const y = gy + (rnd() - 0.5) * spec.grid * 0.7;
      // a round top and a flatter bottom, like a real crown
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && y <= cy + ry * FLAT) targets.push({ x, y });
    }

  const look = spec.step * 6; // how far a limb can see a point to grow towards
  const nodes: Node[] = [];
  // which pieces of limb are in each square of the picture (squares `look` wide), to find the nearest one fast
  const squares = new Map<number, number[]>();
  const square = (x: number, y: number) => Math.floor(x / look) * 1000 + Math.floor(y / look);
  const add = (x: number, y: number, parent: number) => {
    nodes.push({ x, y, parent, kids: [], r: 0 });
    const i = nodes.length - 1;
    if (parent >= 0) nodes[parent].kids.push(i);
    const key = square(x, y);
    const list = squares.get(key);
    if (list) list.push(i);
    else squares.set(key, [i]);
    return i;
  };
  // the trunk: straight up from the ground to just under the crown, where the limbs start
  const baseY = spec.aspect * 0.9;
  const forkY = cy + ry * FLAT + spec.step;
  const trunkSteps = Math.max(2, Math.round((baseY - forkY) / spec.step));
  let last = add(cx, baseY, -1);
  for (let i = 1; i <= trunkSteps; i++) last = add(cx, baseY + ((forkY - baseY) * i) / trunkSteps, last);

  for (let round = 0; round < 400 && targets.length; round++) {
    // each point pulls the nearest piece of limb towards it
    const pull = new Map<number, { x: number; y: number; near: { x: number; y: number }; nearD: number }>();
    for (const t of targets) {
      let best = -1;
      let bestD = look;
      for (let sx = -1; sx <= 1; sx++)
        for (let sy = -1; sy <= 1; sy++)
          for (const i of squares.get(square(t.x + sx * look, t.y + sy * look)) ?? []) {
            const d = Math.hypot(nodes[i].x - t.x, nodes[i].y - t.y);
            if (d < bestD || (d === bestD && i < best)) {
              bestD = d;
              best = i;
            }
          }
      if (best < 0) continue;
      const p = pull.get(best) ?? { x: 0, y: 0, near: t, nearD: Infinity };
      p.x += (t.x - nodes[best].x) / bestD;
      p.y += (t.y - nodes[best].y) / bestD;
      if (bestD < p.nearD) {
        p.near = t;
        p.nearD = bestD;
      }
      pull.set(best, p);
    }
    const before = nodes.length;
    for (const [i, p] of [...pull.entries()].sort((a, b) => a[0] - b[0])) {
      const n = nodes[i];
      // towards the middle of the points pulling it; if a shoot already goes that way, towards the nearest one
      const ways = [
        { x: p.x, y: p.y },
        { x: p.near.x - n.x, y: p.near.y - n.y },
      ];
      for (const way of ways) {
        const len = Math.hypot(way.x, way.y);
        if (len < 1e-6) continue;
        const x = n.x + (way.x / len) * spec.step;
        const y = n.y + (way.y / len) * spec.step;
        // not the same shoot twice, and not back down its own branch
        if (n.kids.some((k) => Math.hypot(nodes[k].x - x, nodes[k].y - y) < spec.step * 0.8)) continue;
        if (n.parent >= 0 && Math.hypot(nodes[n.parent].x - x, nodes[n.parent].y - y) < spec.step * 0.9) continue;
        add(x, y, i);
        break;
      }
    }
    if (nodes.length === before) break;
    const fresh = nodes.slice(before);
    targets = targets.filter((t) => !fresh.some((n) => Math.hypot(n.x - t.x, n.y - t.y) < spec.reach));
  }

  // a one-step shoot off the side of a limb looks like a thorn: take those off
  for (let i = nodes.length - 1; i > trunkSteps; i--) {
    const n = nodes[i];
    const p = nodes[n.parent];
    if (n.kids.length === 0 && p.kids.length > 1 && p.parent >= 0) {
      p.kids = p.kids.filter((k) => k !== i);
      n.parent = -2;
    }
  }
  const kept = nodes.filter((n) => n.parent !== -2);
  const renumber = new Map(nodes.map((n, i) => [i, kept.indexOf(n)]));
  for (const n of kept) {
    n.parent = n.parent < 0 ? -1 : renumber.get(n.parent)!;
    n.kids = n.kids.map((k) => renumber.get(k)!);
  }
  nodes.length = 0;
  nodes.push(...kept);

  // ease the kinks out of each limb: a piece between two others moves towards the line between them
  for (let pass = 0; pass < 2; pass++) {
    const next = nodes.map((n, i) => {
      if (i <= trunkSteps || n.kids.length !== 1) return { x: n.x, y: n.y };
      const a = nodes[n.parent];
      const b = nodes[n.kids[0]];
      return { x: n.x * 0.5 + (a.x + b.x) * 0.25, y: n.y * 0.5 + (a.y + b.y) * 0.25 };
    });
    next.forEach((p, i) => Object.assign(nodes[i], p));
  }

  // thickness: a limb is as thick as the branches it feeds, put together (tips first)
  const POWER = 2.1;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    // (and a little thicker with every step back towards the trunk, so a long twig tapers too)
    n.r = n.kids.length ? Math.pow(n.kids.reduce((sum, k) => sum + Math.pow(nodes[k].r, POWER), 0), 1 / POWER) + 0.16 : 1;
  }
  const top = nodes[0].r;
  // from twig-tip thin to trunk thick; the curve keeps side branches clearly thinner than the limb they leave
  for (const n of nodes) n.r = spec.tipR + (spec.trunk - spec.tipR) * Math.pow((n.r - 1) / Math.max(1e-9, top - 1), 1.05);
  return nodes;
}

// A leaf's blade as circles along its middle line: [how far along the leaf, radius], in leaf lengths.
// Together they cover the blade as it's drawn (BLADE in components/TreeArt.tsx), so leaves whose circles
// don't touch don't touch either.
const BLADE_CIRCLES: readonly [number, number][] = [
  [0.25, 0.165],
  [0.4, 0.222],
  [0.55, 0.238],
  [0.7, 0.207],
  [0.845, 0.145],
];
const BREATHE = 1.06; // a little air between leaves

const FLAT = 0.7; // how far below its middle the crown goes, as a share of its reach (1 = a full oval)

const LEAF_TURNS = [45, -45, 60, -60]; // how far a leaf turns out from its twig, in degrees
// how far a leaf may tip from level, in degrees, so its words read easily: up (−) more than down (+),
// since leaves reaching up look alive and drooping ones look wilted
const LEAF_UP = -32;
const LEAF_LEVEL = 5;
const LEAF_DOWN = 20;
const MIN_OFF_BRANCH = 20; // a leaf sticks out at least this far from its twig, in degrees
const MAX_OFF_BRANCH = 75; // and never turns back towards the trunk

interface Candidate extends TreeLeaf {
  spot: number;
  ux: number;
  uy: number;
  /** The biggest it can be and stay inside the picture. */
  fits: number;
}

/**
 * The ways a leaf can grow from a spot on a twig, like a real one: turned out from the twig,
 * pointing the way the twig grows, and tipped only a little from level.
 */
function poses(x: number, y: number, bx: number, by: number, spot: number, spec: Spec): Candidate[] {
  const base = (Math.atan2(by, bx) * 180) / Math.PI;
  // a leaf reaches up or level wherever its twig lets it; only twigs with no other way get a drooping one
  for (const lowest of [LEAF_LEVEL, LEAF_DOWN]) {
    const out: Candidate[] = [];
    for (const turn of LEAF_TURNS) {
      const deg = base + turn;
      const side: 1 | -1 = Math.cos((deg * Math.PI) / 180) >= 0 ? 1 : -1;
      // the tilt from level, seen from the leaf's own side, kept within reach
      const raw = side === 1 ? deg : 180 - deg;
      const tilt = Math.round(Math.max(LEAF_UP, Math.min(lowest, ((raw + 540) % 360) - 180)) * 10) / 10;
      const angle = side === 1 ? tilt : 180 - tilt;
      const off = Math.abs(((angle - base + 540) % 360) - 180);
      if (off < MIN_OFF_BRANCH || off > MAX_OFF_BRANCH) continue;
      if (out.some((c) => c.side === side && Math.abs(c.tilt - tilt) < 8)) continue;
      const ux = Math.cos((angle * Math.PI) / 180);
      const uy = Math.sin((angle * Math.PI) / 180);
      // inside the picture: every circle of the blade clear of the edges and the ground
      let fits = Infinity;
      const edge = 0.008;
      for (const [t, r] of BLADE_CIRCLES) {
        if (r - ux * t > 0) fits = Math.min(fits, (x - edge) / (r - ux * t));
        if (r + ux * t > 0) fits = Math.min(fits, (1 - edge - x) / (r + ux * t));
        if (r - uy * t > 0) fits = Math.min(fits, (y - edge) / (r - uy * t));
        if (r + uy * t > 0) fits = Math.min(fits, (spec.aspect * 0.9 - y) / (r + uy * t));
      }
      out.push({ x, y, angle, side, tilt, bx, by, spot, ux, uy, fits });
    }
    if (out.length) return out;
  }
  return [];
}

/** The biggest two leaves can be before they touch (Infinity = they never do). */
function touchSize(a: Candidate, b: Candidate): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const c = dx * dx + dy * dy;
  let best = Infinity;
  for (const [ta, ra] of BLADE_CIRCLES)
    for (const [tb, rb] of BLADE_CIRCLES) {
      // circle centres are (stalk + direction × t × size); they touch when their distance is (ra + rb) × size
      const vx = a.ux * ta - b.ux * tb;
      const vy = a.uy * ta - b.uy * tb;
      const R = (ra + rb) * BREATHE;
      const qa = vx * vx + vy * vy - R * R;
      const qb = 2 * (dx * vx + dy * vy);
      let root = Infinity;
      if (c < 1e-12) root = qa < 0 ? 0 : Infinity;
      else if (Math.abs(qa) < 1e-12) root = qb < 0 ? -c / qb : Infinity;
      else {
        const disc = qb * qb - 4 * qa * c;
        if (qa < 0) root = (-qb - Math.sqrt(disc)) / (2 * qa);
        else if (disc >= 0 && qb < 0) root = (-qb - Math.sqrt(disc)) / (2 * qa);
      }
      if (root < best) best = root;
    }
  return best;
}

function build(shape: TreeShape): Tree {
  const spec = SPECS[shape];
  const nodes = grow(spec);
  const twigR = spec.tipR + (spec.trunk - spec.tipR) * 0.3;
  const limbs: Limb[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    const p = nodes[n.parent];
    const tip = n.kids.length === 0;
    limbs.push({ x1: p.x, y1: p.y, x2: n.x, y2: n.y, r1: Math.max(p.r, n.r), r2: tip ? n.r * 0.6 : n.r, twig: n.r <= twigR, tip });
  }
  limbs.sort((a, b) => b.r1 - a.r1);

  // every way a leaf could grow: spots a little apart along the twigs, a few poses at each
  const cands: Candidate[] = [];
  let spot = 0;
  for (const b of limbs) {
    if (!b.twig) continue;
    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1;
    const bx = (b.x2 - b.x1) / len;
    const by = (b.y2 - b.y1) / len;
    const parts = Math.max(1, Math.round(len / (spec.step * 0.5)));
    for (let s = 1; s <= parts; s++) {
      const x = b.x1 + ((b.x2 - b.x1) * s) / parts;
      const y = b.y1 + ((b.y2 - b.y1) * s) / parts;
      cands.push(...poses(x, y, bx, by, spot++, spec));
    }
  }

  const { cx, cy, ry } = spec.crown;
  const order: number[] = [];
  const sizes: number[] = []; // sizes[k] = the biggest the first k + 1 leaves can be without touching
  const room = cands.map((c) => c.fits); // how big each could be next to the leaves already there
  const apart = cands.map(() => Infinity); // how far each is from the leaves already there
  const free = cands.map(() => true); // its spot isn't taken yet
  // where each one's middle would be at full size
  const midX = cands.map((c) => c.x + c.ux * spec.maxLeaf * 0.5);
  const midY = cands.map((c) => c.y + c.uy * spec.maxLeaf * 0.5);

  function next() {
    let best = -1;
    let bestKey = -Infinity;
    for (let i = 0; i < cands.length; i++) {
      if (!free[i]) continue;
      // the first leaf goes at the top of the crown; after that, whichever has the most room,
      // and among those with plenty, the one furthest from the others
      const key =
        order.length === 0
          ? Math.min(room[i], spec.maxLeaf) - Math.hypot(cands[i].x - cx, cands[i].y - (cy - ry * 0.7))
          : Math.min(room[i], spec.maxLeaf) + Math.min(apart[i], 1) * 0.02;
      if (key > bestKey) {
        bestKey = key;
        best = i;
      }
    }
    if (best < 0) return false;
    const c = cands[best];
    order.push(best);
    sizes.push(Math.min(sizes.length ? sizes[sizes.length - 1] : Infinity, room[best]));
    for (let i = 0; i < cands.length; i++) {
      if (!free[i]) continue;
      if (cands[i].spot === c.spot) {
        free[i] = false; // one leaf to a spot
        continue;
      }
      const d = Math.hypot(midX[i] - midX[best], midY[i] - midY[best]);
      if (d < apart[i]) apart[i] = d;
      // leaves whose middles are more than two full-size leaves apart can never touch
      if (d < spec.maxLeaf * 2) {
        const t = touchSize(cands[i], c);
        if (t < room[i]) room[i] = t;
      }
    }
    return true;
  }
  const upTo = (count: number) => {
    while (order.length < count && next());
  };

  return {
    shape,
    aspect: spec.aspect,
    limbs,
    base: { x: nodes[0].x, y: nodes[0].y },
    crown: { ...spec.crown },
    leaf(index) {
      upTo(index + 1);
      const { x, y, angle, side, tilt, bx, by } = cands[order[index % order.length]];
      return { x, y, angle, side, tilt, bx, by };
    },
    leafSize(count) {
      if (count < 1) return spec.maxLeaf;
      upTo(count);
      const fit = sizes[Math.min(count, sizes.length) - 1];
      return Math.max(spec.minLeaf, Math.min(spec.maxLeaf, fit));
    },
  };
}

const built = new Map<TreeShape, Tree>();

/** The tree for a wide picture (big screens) or a tall one (phones): the same every time. */
export function tree(shape: TreeShape): Tree {
  let t = built.get(shape);
  if (!t) built.set(shape, (t = build(shape)));
  return t;
}
