// The motivation tree's drawing: a full, round tree whose leaves sit on its branches,
// each attached by its stalk, all the same size and shape, and not on top of each other.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardSpot } from "@/lib/boards";
import { tree, treeShape, type Tree, type TreeLeaf } from "@/lib/tree";

const SHAPES = ["wide", "tall"] as const;
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
// the board, and the tree's drawing it shares with the home page
const src = read("../components/results/BoardView.tsx") + read("../components/TreeArt.tsx");

const toLimb = (p: { x: number; y: number }, s: { x1: number; y1: number; x2: number; y2: number }) => {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy));
};

// The blade exactly as it's drawn (BLADE in components/TreeArt.tsx: two curves from the stalk end to the tip and back,
// in a box 100 long and 60 high), as points round its outline.
const BLADE_NUMS = /const BLADE = "([^"]+)"/.exec(src)![1].match(/-?[0-9.]+/g)!.map(Number);
const OUTLINE: { x: number; y: number }[] = [];
for (const k of [0, 6]) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = BLADE_NUMS.slice(k, k + 8);
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const u = 1 - t;
    OUTLINE.push({
      x: (u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3) / 100,
      y: (u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3 - 30) / 100,
    });
  }
}

/** A leaf's blade where it is on the tree, at the given leaf length. */
function blade(leaf: TreeLeaf, size: number): { x: number; y: number }[] {
  const a = (leaf.angle * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  return OUTLINE.map((p) => ({ x: leaf.x + (ux * p.x - uy * p.y) * size, y: leaf.y + (uy * p.x + ux * p.y) * size }));
}

/** Do two convex shapes overlap? (separating axes) */
function overlap(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const on = (pts: { x: number; y: number }[]) => pts.map((v) => v.x * nx + v.y * ny);
      const pa = on(a);
      const pb = on(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  return true;
}

function overlaps(t: Tree, n: number): number {
  const size = t.leafSize(n);
  const shapes = Array.from({ length: n }, (_, i) => blade(t.leaf(i), size));
  let count = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (overlap(shapes[i], shapes[j])) count++;
  return count;
}

describe("the tree's shape", () => {
  it("has a wide shape for big screens and a tall one for phones, drawn the same way every time", () => {
    expect(treeShape(1300, 812)).toBe("wide");
    expect(treeShape(357, 420)).toBe("tall");
    expect(tree("wide").aspect).toBeCloseTo(1 / 1.6, 5);
    expect(tree("tall").aspect).toBeCloseTo(1 / 0.85, 5);
    expect(tree("wide")).toBe(tree("wide"));
    for (const s of SHAPES) expect(tree(s).limbs.length).toBeGreaterThan(60);
  });

  it("stands in the middle, on the ground", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      expect(t.base.x).toBeCloseTo(0.5, 5);
      expect(t.base.y / t.aspect).toBeGreaterThan(0.85);
      expect(t.limbs.some((b) => b.x1 === t.base.x && b.y1 === t.base.y)).toBe(true);
    }
  });

  it("is one tree: every limb starts where another one ends", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      const ends = new Set(t.limbs.map((b) => `${b.x2},${b.y2}`));
      ends.add(`${t.base.x},${t.base.y}`);
      for (const b of t.limbs) expect(ends.has(`${b.x1},${b.y1}`)).toBe(true);
    }
  });

  it("gets thinner from the trunk to the twigs", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      for (const b of t.limbs) expect(b.r2).toBeLessThanOrEqual(b.r1 + 1e-9);
      const thickest = Math.max(...t.limbs.map((b) => b.r1));
      const tips = t.limbs.filter((b) => b.tip);
      expect(tips.length).toBeGreaterThan(15);
      for (const b of tips) expect(b.r2).toBeLessThan(thickest / 5);
    }
  });

  it("has a full crown: it fills most of the picture's width and more than half its height (not a flat umbrella)", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      const twigs = t.limbs.filter((b) => b.twig);
      const xs = twigs.map((b) => b.x2);
      const ys = twigs.map((b) => b.y2 / t.aspect);
      expect(Math.min(...xs), s).toBeLessThan(0.2);
      expect(Math.max(...xs), s).toBeGreaterThan(0.8);
      expect(Math.min(...ys), s).toBeLessThan(0.14);
      expect(Math.max(...ys) - Math.min(...ys), s).toBeGreaterThan(0.5);
    }
  });

  it("stays inside the picture, with room at the edges for leaves", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      for (const b of t.limbs) {
        expect(b.x2).toBeGreaterThan(0.05);
        expect(b.x2).toBeLessThan(0.95);
        expect(b.y2).toBeGreaterThan(0.03);
        expect(b.y2).toBeLessThanOrEqual(t.base.y);
      }
    }
  });
});

describe("where leaves sit", () => {
  it("on a twig, by the stalk, every one of the first 150", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      const twigs = t.limbs.filter((b) => b.twig);
      for (let i = 0; i < 150; i++) {
        const nearest = Math.min(...twigs.map((b) => toLimb(t.leaf(i), b)));
        expect(nearest, `${s} leaf ${i}`).toBeLessThan(0.002);
      }
    }
  });

  it("each on its own spot, and an earlier leaf never moves when new ones arrive", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      const first = Array.from({ length: 10 }, (_, i) => t.leaf(i));
      const all = Array.from({ length: 150 }, (_, i) => t.leaf(i));
      expect(all.slice(0, 10)).toEqual(first);
      expect(new Set(all.map((l) => `${l.x},${l.y}`)).size).toBe(150);
    }
  });

  it("all over the crown from the first few leaves, not in one corner", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      const first = Array.from({ length: 12 }, (_, i) => t.leaf(i));
      expect(Math.min(...first.map((l) => l.x))).toBeLessThan(0.3);
      expect(Math.max(...first.map((l) => l.x))).toBeGreaterThan(0.7);
      const ys = first.map((l) => l.y / t.aspect);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.3);
    }
  });

  it("gives the board the same spots, as shares of the picture", () => {
    const t = tree("wide");
    for (let i = 0; i < 20; i++) {
      const p = boardSpot("tree", i);
      expect(p.x).toBeCloseTo(t.leaf(i).x, 6);
      expect(p.y).toBeCloseTo(t.leaf(i).y / t.aspect, 6);
    }
  });
});

describe("how a leaf grows out of its branch", () => {
  const each = (fn: (l: TreeLeaf, label: string) => void) => {
    for (const s of SHAPES) for (let i = 0; i < 150; i++) fn(tree(s).leaf(i), `${s} leaf ${i}`);
  };
  const offBranch = (l: TreeLeaf) => {
    const a = (l.angle * Math.PI) / 180;
    return (Math.acos(Math.max(-1, Math.min(1, Math.cos(a) * l.bx + Math.sin(a) * l.by))) * 180) / Math.PI;
  };

  it("knows which way its branch runs", () => {
    each((l, label) => expect(Math.hypot(l.bx, l.by), label).toBeCloseTo(1, 5));
  });

  it("sticks out of its branch instead of lying along it, and never points back towards the trunk", () => {
    each((l, label) => {
      expect(offBranch(l), label).toBeGreaterThanOrEqual(20);
      expect(offBranch(l), label).toBeLessThanOrEqual(75);
    });
  });

  it("stays nearly level, so its words read easily: up to 32° up, at most 20° down (drooping leaves look wilted)", () => {
    each((l, label) => {
      expect(l.tilt, label).toBeGreaterThanOrEqual(-32);
      expect(l.tilt, label).toBeLessThanOrEqual(20);
      // side and tilt say the same as the angle
      const want = l.side === 1 ? l.tilt : 180 - l.tilt;
      expect(Math.cos(((l.angle - want) * Math.PI) / 180), label).toBeCloseTo(1, 5);
    });
  });

  it("mostly reaches up or level, rarely down", () => {
    for (const s of SHAPES) {
      const down = Array.from({ length: 100 }, (_, i) => tree(s).leaf(i)).filter((l) => l.tilt > 5).length;
      expect(down, s).toBeLessThan(35);
    }
  });
});

describe("leaves next to each other", () => {
  it("are all one size, which only gets smaller as more arrive", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      let last = Infinity;
      for (let n = 1; n <= 300; n++) {
        expect(t.leafSize(n)).toBeLessThanOrEqual(last);
        last = t.leafSize(n);
      }
      expect(t.leafSize(1)).toBeLessThanOrEqual(s === "wide" ? 0.12 : 0.24);
      expect(t.leafSize(300)).toBeGreaterThanOrEqual(s === "wide" ? 0.03 : 0.05);
    }
    expect(src).not.toMatch(/data-part="bud"/);
  });

  it("never sit on top of each other, up to 100 leaves on a big screen and 60 on a phone", () => {
    for (const n of [2, 5, 12, 20, 35, 50, 75, 100]) expect(overlaps(tree("wide"), n), `wide, ${n} leaves`).toBe(0);
    for (const n of [2, 5, 12, 20, 35, 60]) expect(overlaps(tree("tall"), n), `tall, ${n} leaves`).toBe(0);
  });

  it("stay inside the picture", () => {
    for (const s of SHAPES) {
      const t = tree(s);
      for (const n of [1, 8, 30, 100]) {
        const size = t.leafSize(n);
        for (let i = 0; i < n; i++)
          for (const p of blade(t.leaf(i), size)) {
            expect(p.x, `${s} ${n} leaf ${i}`).toBeGreaterThanOrEqual(0);
            expect(p.x, `${s} ${n} leaf ${i}`).toBeLessThanOrEqual(1);
            expect(p.y, `${s} ${n} leaf ${i}`).toBeGreaterThanOrEqual(0);
          }
      }
    }
  });

  it("are big enough to read: 15 leaves on a laptop as they are, 40 on a big screen, 15 on a phone zoomed in twice", () => {
    // words show once the font (FONT_SHARE of the leaf) is 9px
    const font = Number(/const FONT_SHARE = ([0-9.]+);/.exec(src)![1]);
    expect(tree("wide").leafSize(15) * 740 * font).toBeGreaterThanOrEqual(9);
    expect(tree("wide").leafSize(40) * 1300 * font).toBeGreaterThanOrEqual(9);
    expect(tree("tall").leafSize(15) * 357 * font * 2).toBeGreaterThanOrEqual(9);
    expect(tree("wide").leafSize(100) * 1300).toBeGreaterThanOrEqual(60);
  });
});

describe("the drawing", () => {
  it("draws the tree from lib/tree.ts and leaves as real leaf shapes with a stalk and a vein", () => {
    expect(src).toContain("tree(treeShape(");
    expect(src).toContain("function LeafShape");
    expect(src).toMatch(/data-part="stem"/);
    expect(src).toMatch(/data-part="vein"/);
    expect(src).not.toContain('borderRadius: "75% 0"');
  });

  it("gives every leaf the same shape, the same above and below its middle vein", () => {
    const d = /const BLADE = "([^"]+)"/.exec(src)![1];
    const nums = d.match(/-?[0-9.]+/g)!.map(Number);
    // M x y C x1 y1, x2 y2, tipX tipY C x3 y3, x4 y4, x y
    expect(nums).toHaveLength(14);
    const mid = nums[1];
    expect(nums[7]).toBe(mid); // the tip is on the middle line
    expect(nums[13]).toBe(mid);
    expect(nums[3] - mid).toBeCloseTo(mid - nums[11], 5); // the upper edge mirrors the lower edge
    expect(nums[5] - mid).toBeCloseTo(mid - nums[9], 5);
    expect(nums[2]).toBe(nums[10]);
    expect(nums[4]).toBe(nums[8]);
  });

  it("hangs each leaf by its stalk from its spot", () => {
    expect(src).toMatch(/transformOrigin/);
  });

  it("has hills and a sky behind the tree, and a soft crown behind the branches", () => {
    expect(src).toMatch(/data-part="hills"/);
    expect(src).toMatch(/data-part="canopy"/);
  });
});

describe("zooming the tree", () => {
  it("zooms towards the crown, where the leaves are, not the trunk", () => {
    expect(src).toMatch(/const focusY = art \? art\.crown\.cy \* w : h \/ 2;/);
    expect(src).toContain("?? maxZoom, w / 2, focusY)");
  });
});

describe("long leaves (a paragraph instead of a few words)", () => {
  it("picks a smaller size for longer text when a leaf is shown big", async () => {
    const { pieceTextSize } = await import("@/lib/boards");
    expect(pieceTextSize("Coffee")).toBe("big");
    expect(pieceTextSize("x".repeat(60))).toBe("medium");
    expect(pieceTextSize("x".repeat(200))).toBe("small");
  });

  it("keeps the shown leaf on the screen: it scrolls inside instead of pushing the buttons away", () => {
    expect(src).toMatch(/max-h-\[calc\(100dvh-9rem\)\][^"]*overflow-y-auto/);
    expect(src).toContain("pieceTextSize(answer.text)");
  });

  it("only uses the pointed leaf shape for short text, so long text stays inside the box", () => {
    expect(src).toMatch(/borderRadius: size === "big" \? "70% 0" : "2.5rem 0.75rem"/);
  });

  it("lists a person's long leaf at full width on the phone, with Change and Remove under it", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { BoardCard } = await import("@/components/vote/BoardCard");
    const html = renderToStaticMarkup(
      createElement(BoardCard, {
        question: "Q",
        color: "#000",
        board: "tree",
        leaves: ["A very long leaf ".repeat(12)],
        disabled: false,
        onSave: () => {},
        onRemove: () => {},
      }),
    );
    expect(html).toMatch(/<li class="flex flex-col/);
    expect(html).toContain("line-clamp-4");
  });
});

describe("the tree on the home page", () => {
  it("is the same drawing as the real board: the same branches and the same leaves, not a sketch of its own", async () => {
    const page = read("../app/page.tsx");
    expect(page).toContain('import { MiniTree } from "@/components/MiniTree"');
    expect(page).not.toContain("function MiniTree");
    const mini = read("../components/MiniTree.tsx");
    expect(mini).toContain('tree("tall")');
    expect(mini).toContain("<TreeArt");
    expect(mini).toContain("<LeafShape");
    expect(mini).toContain("leafStyle(");
    expect(mini).not.toContain("use client"); // the home page stays static
  });

  it("shows a full tree with a leaf for each sample answer, none touching", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { MiniTree, MINI_LEAVES } = await import("@/components/MiniTree");
    const html = renderToStaticMarkup(createElement(MiniTree));
    expect(MINI_LEAVES.length).toBeGreaterThanOrEqual(8);
    for (const text of MINI_LEAVES) expect(html).toContain(text);
    expect(html.match(/data-part="stem"/g)).toHaveLength(MINI_LEAVES.length);
    expect(html).toMatch(/data-part="canopy"/);
    expect(html).toMatch(/role="img"/);
    expect(overlaps(tree("tall"), MINI_LEAVES.length)).toBe(0);
    // sized by the box it sits in, so it fits any screen width
    expect(html).toContain("cqw");
    expect(html).not.toMatch(/overflow-x-auto/);
  });
});
