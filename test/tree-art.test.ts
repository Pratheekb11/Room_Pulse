// The motivation tree's drawing: a branching tree whose leaves sit on its branches,
// each attached by its stem and growing away from the trunk.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boardSpot } from "@/lib/boards";
import { leafSide, TREE_BRANCHES, treeFork } from "@/lib/tree";

const dist = (p: { x: number; y: number }, s: (typeof TREE_BRANCHES)[number]) => {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const t = Math.max(0, Math.min(1, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy));
};

describe("the tree's branches", () => {
  it("are drawn the same way every time", async () => {
    const again = await import("@/lib/tree");
    expect(again.TREE_BRANCHES).toEqual(TREE_BRANCHES);
    expect(TREE_BRANCHES.length).toBeGreaterThan(40);
  });

  it("start at the top of the trunk, in the middle", () => {
    const fork = treeFork();
    expect(fork.x).toBeCloseTo(0.5, 5);
    expect(fork.y).toBeGreaterThan(0.9);
    expect(TREE_BRANCHES.some((b) => b.x1 === fork.x && b.y1 === fork.y)).toBe(true);
  });

  it("get thinner towards the tips", () => {
    for (const b of TREE_BRANCHES) expect(b.w2).toBeLessThanOrEqual(b.w1);
    const thickest = Math.max(...TREE_BRANCHES.map((b) => b.w1));
    const tips = TREE_BRANCHES.filter((b) => b.tip);
    expect(tips.length).toBeGreaterThan(20);
    for (const b of tips) expect(b.w2).toBeLessThan(thickest / 4);
  });

  it("stay inside the round crown", () => {
    for (const b of TREE_BRANCHES) {
      expect(Math.hypot(b.x2 - 0.5, b.y2 - 0.5)).toBeLessThanOrEqual(0.5);
    }
  });

  it("reach every part of the crown, so leaves spread over the whole tree", () => {
    const ends = TREE_BRANCHES.filter((b) => b.tip);
    const xs = ends.map((b) => b.x2);
    const ys = ends.map((b) => b.y2);
    expect(Math.min(...xs)).toBeLessThan(0.15);
    expect(Math.max(...xs)).toBeGreaterThan(0.85);
    expect(Math.min(...ys)).toBeLessThan(0.15);
  });
});

describe("where leaves sit", () => {
  it("on a branch, every one of the first 120", () => {
    for (let i = 0; i < 120; i++) {
      const p = boardSpot("tree", i);
      const nearest = Math.min(...TREE_BRANCHES.map((b) => dist(p, b)));
      expect(nearest, `leaf ${i}`).toBeLessThan(0.005);
    }
  });

  it("has room for 100 leaves, each on its own spot", () => {
    const pts = Array.from({ length: 100 }, (_, i) => boardSpot("tree", i));
    let closest = Infinity;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) closest = Math.min(closest, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
    expect(closest).toBeGreaterThan(0.03);
  });

  it("on the outer branches, not on the trunk", () => {
    const fork = treeFork();
    for (let i = 0; i < 120; i++) expect(boardSpot("tree", i).y).toBeLessThan(fork.y - 0.05);
  });

  it("growing away from the trunk: right of the middle they point right, left of it they point left", () => {
    expect(leafSide({ x: 0.8, y: 0.4 }, "a")).toBe(1);
    expect(leafSide({ x: 0.2, y: 0.4 }, "a")).toBe(-1);
    // near the middle either way, the same for an answer every time
    const s = leafSide({ x: 0.5, y: 0.2 }, "abc");
    expect([1, -1]).toContain(s);
    expect(leafSide({ x: 0.5, y: 0.2 }, "abc")).toBe(s);
  });
});

describe("the drawing", () => {
  const src = readFileSync(new URL("../components/results/BoardView.tsx", import.meta.url), "utf8");

  it("draws the branches from TREE_BRANCHES and leaves as real leaf shapes with a stem and a vein", () => {
    expect(src).toContain("TREE_BRANCHES");
    expect(src).toContain("function LeafShape");
    expect(src).toMatch(/data-part="stem"/);
    expect(src).toMatch(/data-part="vein"/);
    expect(src).not.toContain('borderRadius: "75% 0"');
  });

  it("hangs each leaf by its stem from its spot, on the side away from the trunk", () => {
    expect(src).toContain("leafSide(");
    expect(src).toMatch(/transformOrigin/);
  });

  it("has hills and a sky behind the tree", () => {
    expect(src).toMatch(/data-part="hills"/);
  });
});

describe("zooming the tree", () => {
  it("zooms towards the crown, where the leaves are, not the trunk", () => {
    const src = readFileSync(new URL("../components/results/BoardView.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/const focusY = board === "tree" \? h \* 0\.3 : h \/ 2;/);
    expect(src).toContain("?? maxZoom, w / 2, focusY)");
  });
});
