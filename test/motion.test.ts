// Smooth motion (2026-11-22): a user called the animations "janky, clanky, not smooth". Measured at 4x CPU
// throttle, the home page dropped 11–16% of frames on a laptop: the live room's glow was a big `filter: blur()`
// that scaled forever (the blur redrew every frame) and the pointer tilt redrew the whole picture on every move.
// Builder rows were keyed by their place, so adding or removing one faded the wrong row.
// Rules: animate only transform and opacity (the browser hands those to the GPU), unless listed below with a
// reason; app screens settle quickly.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filledRows, insertAfter, pasteInto, withKeys, type Row } from "@/lib/list-edit";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const css = read("app/globals.css");

/** Every @keyframes block with the properties it animates. */
function keyframes(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let i = re.lastIndex;
    let depth = 1;
    while (depth && i < css.length) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
      i++;
    }
    const body = css.slice(re.lastIndex, i - 1);
    out.set(m[1], new Set([...body.matchAll(/([a-z-]+)\s*:/g)].map((x) => x[1])));
  }
  return out;
}
/** A rule's declarations (first match). */
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};

const CHEAP = new Set(["transform", "opacity", "scale", "translate", "rotate"]);
/** Allowed anyway, and why. Anything else that repaints every frame fails. */
const ALLOWED: Record<string, string> = {
  flash: "one 900ms flash on a heatmap cell when a score lands, not a loop",
  draw: "a small SVG line drawing itself once",
  "draw-line": "the logo's pulse line drawing itself once",
  heartbeat: "a 1px SVG line on the home page; tiny to repaint",
  glint: "a light moving along a 1px hairline; tiny to repaint, and translateX once made phones scroll sideways",
  "glint-once": "the same light, once on hover",
  "room-wipe": "the live room's design change every few seconds; measured: no dropped frames",
};

describe("animations move only transform and opacity", () => {
  it("every keyframe animates cheap properties, or is listed with a reason", () => {
    for (const [name, props] of keyframes()) {
      if (ALLOWED[name]) continue;
      for (const p of props) expect(CHEAP.has(p), `@keyframes ${name} animates ${p}`).toBe(true);
    }
  });

  it("the allow list has no stale entries", () => {
    const names = keyframes();
    for (const name of Object.keys(ALLOWED)) expect(names.has(name), name).toBe(true);
  });

  it("the live dot and the waiting room's QR pulse with a ring that scales and fades, not a box-shadow", () => {
    expect(css).not.toMatch(/@keyframes live\s/);
    expect(css).not.toMatch(/@keyframes waiting-glow\b/);
    expect(read("components/LiveBadge.tsx")).not.toContain("animate-live");
    expect(read("components/LiveBadge.tsx")).toContain("live-ring");
    expect(rule(".live-ring::after")).toMatch(/animation:/);
    expect(rule(".waiting-qr::after")).toMatch(/animation:/);
  });
});

describe("the live room's glow and tilt", () => {
  it("the glow is a soft gradient, not a blur filter (a blur that moves redraws every frame)", () => {
    const glow = rule(".room-glow");
    expect(glow).not.toMatch(/filter:/);
    expect(glow).toMatch(/radial-gradient/);
    // the colour still eases from one design to the next
    expect(css).toMatch(/@property --glow\s*\{[^}]*syntax:\s*"<color>"/);
    expect(glow).toMatch(/transition:[^;]*--glow/);
  });

  it("the tilting picture is its own layer, so leaning it doesn't redraw it", () => {
    expect(rule("[data-tilt].room-tilt")).toMatch(/will-change: transform/);
  });
});

describe("app screens settle quickly", () => {
  it("blocks rise in under half a second, and a long list doesn't keep the last one waiting", () => {
    const enter = rule(".enter");
    const ms = Number(enter.match(/animation: enter (\d+)ms/)?.[1]);
    expect(ms).toBeLessThanOrEqual(450);
    // the stagger stops growing after a few blocks
    expect(enter).toMatch(/min\(var\(--i, 0\), \d+\)/);
  });

  it("dialogs open in under 300ms", () => {
    const ms = Number(css.match(/animation: dialog-in (\d+)ms/)?.[1]);
    expect(ms).toBeLessThanOrEqual(300);
  });
});

describe("builder rows keep their identity", () => {
  it("rows get a stable key, so adding or removing one animates the right row", () => {
    const rows = withKeys<Row>([{ name: "A" }, { name: "B" }]);
    expect(rows[0].key).toBeTruthy();
    expect(rows[0].key).not.toBe(rows[1].key);
    // keys survive another pass, and rows that have one keep it
    expect(withKeys(rows).map((r) => r.key)).toEqual(rows.map((r) => r.key));
    const added = insertAfter(rows, 0, 10);
    expect(added[0].key).toBe(rows[0].key);
    expect(added[2].key).toBe(rows[1].key);
    expect(added[1].key).toBeTruthy();
    expect(new Set(added.map((r) => r.key)).size).toBe(3);
    const pasted = pasteInto(rows, 1, "x\ny\nz", 10)!.items;
    expect(new Set(pasted.map((r) => r.key)).size).toBe(pasted.length);
  });

  it("the key never reaches the server", () => {
    const rows: Row[] = withKeys([{ name: " A " }]);
    expect(filledRows(rows)[0]).toEqual({ name: "A" });
  });

  it("the list editor keys rows by that key, not by their place", () => {
    const list = read("components/admin/ListEditor.tsx");
    expect(list).not.toMatch(/key=\{row\.id \?\? `new-\$\{i\}`\}/);
    expect(list).toMatch(/key=\{row\.id \?\? row\.key/);
  });
});
