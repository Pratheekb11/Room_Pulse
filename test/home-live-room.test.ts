// The home page's hook: the room, live. A big screen in a real slide design sits by the headline, phones answer
// beside it and each answer flies up to the screen. Every few seconds it moves on to another design and another
// kind of question, so the first screen shows the product, its colour and its range at once.
// The page around it stays quiet (test/home-quiet.test.ts): colour lives only inside the screen.
import { readFileSync, existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SCENES, LiveRoom } from "@/components/home/LiveRoom";
import { THEMES, THEME_IDS, themeStyle } from "@/lib/themes";
import { KIND_INFO } from "@/lib/kinds";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const room = read("components/home/LiveRoom.tsx");
const css = read("app/globals.css");
const hero = page.slice(page.indexOf("<h1"), page.indexOf("</section>"));

describe("the hook is in the first screen", () => {
  it("the hero shows the live room beside the headline, and the old grey demo is gone", () => {
    expect(hero).toContain("<LiveRoom");
    expect(page).not.toContain("LiveDemo");
    expect(existsSync(new URL("../components/LiveDemo.tsx", import.meta.url))).toBe(false);
    // side by side on a laptop
    expect(page.slice(page.indexOf("<section"), page.indexOf("<h1"))).toMatch(/lg:grid-cols-\[/);
  });
});

describe("scenes: real designs, real question types", () => {
  it("has at least four scenes, each a different slide design and a different kind of question", () => {
    expect(SCENES.length).toBeGreaterThanOrEqual(4);
    expect(new Set(SCENES.map((s) => s.theme)).size).toBe(SCENES.length);
    expect(new Set(SCENES.map((s) => s.kind)).size).toBe(SCENES.length);
    for (const s of SCENES) expect(THEME_IDS).toContain(s.theme);
  });

  it("names each scene by its question type and design as the product does", () => {
    const kinds = new Set(KIND_INFO.map((k) => k.label));
    for (const s of SCENES) expect(kinds.has(s.kindLabel) || s.kindLabel === "Team activity", s.kindLabel).toBe(true);
  });

  it("shows a dark design and a light one, a quiz and a team activity", () => {
    const dark = SCENES.filter((s) => THEMES.find((t) => t.id === s.theme)!.dark);
    expect(dark.length).toBeGreaterThanOrEqual(1);
    expect(dark.length).toBeLessThan(SCENES.length);
    expect(SCENES.map((s) => s.kind)).toEqual(expect.arrayContaining(["quiz", "tree"]));
  });
});

describe("the screen wears the design", () => {
  it("draws the first scene in its own design's colours and headline font, on the server too", () => {
    const html = renderToStaticMarkup(createElement(LiveRoom));
    const first = SCENES[0];
    const style = themeStyle(first.theme);
    expect(html).toContain(`--color-canvas:${style["--color-canvas"]}`);
    expect(html).toContain(first.question.replace(/'/g, "&#x27;"));
  });

  it("takes its colours from the designs, not colours of its own", () => {
    expect(room).toContain("themeStyle(");
    expect(room).not.toMatch(/#[0-9a-f]{6}\b/i);
  });

  it("the screen's colours change smoothly from one design to the next", () => {
    expect(css).toMatch(/\.room-screen\s*\{[^}]*transition:[^}]*background-color/);
  });
});

// 2026-11-21: no "N people answering" under the picture (people read it as the most a presentation can take), and
// no row of design names under it (not needed: the screen shows the designs by itself).
describe("only the picture, nothing that reads like a limit", () => {
  it("has no people count and no design buttons under the picture", () => {
    const html = renderToStaticMarkup(createElement(LiveRoom));
    expect(html).not.toMatch(/people answering/i);
    expect(html).not.toContain("<button");
    expect(room).not.toContain("aria-pressed");
    for (const t of THEMES) expect(html.replace(/aria-label="[^"]*"/g, "")).not.toContain(`>${t.label}<`);
  });

  it("moves on to the next design by itself", () => {
    expect(room).toMatch(/\(s\.scene \+ 1\) % SCENES\.length/);
  });
});

describe("motion", () => {
  it("each answer flies from a phone up to the screen, inside the picture (nothing past the page edge)", () => {
    expect(css).toMatch(/\.room-fly\s*\{[^}]*animation: room-fly/);
    expect(css).toMatch(/@keyframes room-fly/);
    const at = css.indexOf("@keyframes room-fly");
    expect(css.slice(at, css.indexOf("\n}", at))).not.toMatch(/translateX/);
    expect(room).toMatch(/overflow-hidden|overflow-clip/);
  });

  it("stays still for people who ask for reduced motion, and pauses when off screen or in a hidden tab", () => {
    expect(room).toContain("prefers-reduced-motion: reduce");
    expect(room).toContain("IntersectionObserver");
    expect(room).toContain("visibilityState");
    const home = css.slice(css.indexOf(":root:has(.quiet) {"));
    const reduced = home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".room-fly");
  });

  it("is a picture to screen readers", () => {
    expect(room).toMatch(/role="img"/);
    expect(room).toMatch(/aria-label=\{/);
  });
});

// "Dynamic and just cool" (2026-11-21): the room moves like a real one. Answers overlap in the air on curved
// paths and land with a ping, the next design sweeps across the screen, the screen's light spills onto the dark
// page, the phones float, the picture leans towards the pointer on a laptop and a quiz ends in a burst.
describe("the room feels alive", () => {
  const num = (name: string) => Number(room.match(new RegExp(`const ${name} = (\\d+)`))![1]);
  const keyframes = (name: string) => {
    const at = css.indexOf(`@keyframes ${name}`);
    expect(at, name).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("\n}", at));
  };
  const reduced = (() => {
    const home = css.slice(css.indexOf(":root:has(.quiet) {"));
    return home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
  })();

  it("answers come quickly and more than one can be in the air at once", () => {
    expect(num("TICK")).toBeLessThanOrEqual(1000);
    expect(num("FLIGHT")).toBeGreaterThan(num("TICK"));
    // every answer between the last one shown and the last one sent is drawn
    expect(room).toMatch(/\.map\(\(i\) => \(\s*<Flight/);
  });

  it("answers fly on a curve with a glowing tail and land with a ping", () => {
    expect(keyframes("room-fly")).toMatch(/50%/);
    expect(css).toMatch(/\.room-fly\s*\{[^}]*box-shadow/);
    expect(room).toContain("room-ping");
    keyframes("room-ping");
  });

  it("the next design sweeps across the screen over the one before", () => {
    expect(room).toContain("room-wipe");
    expect(keyframes("room-wipe")).toMatch(/clip-path/);
    expect(room).toMatch(/onAnimationEnd/);
  });

  it("the screen's light spills onto the page in the design's colour", () => {
    expect(room).toContain("room-glow");
    // a soft gradient that eases between designs' colours (no blur filter: see test/motion.test.ts)
    expect(css).toMatch(/\.room-glow\s*\{[^}]*radial-gradient/);
    expect(css).toMatch(/\.room-glow\s*\{[^}]*transition:[^}]*--glow/);
  });

  it("phones float, tapped answers ripple, and the count pops", () => {
    keyframes("room-float");
    keyframes("room-tap");
    expect(room).toContain("room-float");
    expect(room).toContain("room-tap");
    expect(room).toMatch(/key=\{people\}/);
  });

  it("leans towards the pointer on a laptop only (not on touch, not with reduced motion)", () => {
    expect(room).toContain("(pointer: fine)");
    expect(room).toMatch(/--tilt-x/);
    expect(css).toMatch(/\.room-tilt\s*\{[^}]*perspective|perspective[^}]*\}[\s\S]*\.room-tilt/);
  });

  it("a quiz ends in a burst on the right answer", () => {
    expect(room).toContain("room-burst");
    keyframes("room-burst");
  });

  it("all of it stays still with reduced motion", () => {
    for (const c of [".room-ping", ".room-float", ".room-tap", ".room-burst", ".room-wipe"]) expect(reduced, c).toContain(c);
  });
});

// Owner, 2026-11-22 (phone): the quiz screen ("Jupiter") hung for half a second before the tree scene. The tree's
// shape is worked out the first time it's needed, which was the moment of the hand-over (513 ms frame at 4x CPU).
describe("the tree scene doesn't stall the hand-over", () => {
  const room = readFileSync(new URL("../components/home/LiveRoom.tsx", import.meta.url), "utf8");
  it("works the tree out while the browser is idle, long before its scene", () => {
    expect(room).toMatch(/requestIdleCallback[\s\S]{0,400}tree\("wide"\)|tree\("wide"\)[\s\S]{0,400}requestIdleCallback/);
    expect(room).toMatch(/leafSize\(s\.leaves\.length\)/);
  });

  it("builds the next screen underneath while the result is held, so the hand-over only reveals it", () => {
    expect(room).toMatch(/next: boolean/);
    // a screen keeps its key from being built underneath to being shown and after the wipe: never built twice
    expect(room).not.toMatch(/key=\{`\$\{scene\.id\}-\$\{state\.from/);
    expect(room).toMatch(/key=\{l\.scene\.id\}/);
    // built but not painted while it waits
    expect(room).toMatch(/l\.z === 0 \? "invisible"/);
  });
});
