// The home page has a duotone look and moves: two strong colours (cobalt and volt), giant type that rises in,
// a marquee of question types, sections that reveal as you scroll, a pointer-following glow and a tilting demo.
// Motion never hides anything without JavaScript and stops for people who ask for reduced motion.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KIND_INFO } from "@/lib/kinds";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const css = read("app/globals.css");

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h: string) => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const token = (name: string) => new RegExp(`--color-${name}: (#[0-9a-f]{6})`).exec(css)![1];

describe("two strong colours", () => {
  it("defines a volt partner for the cobalt, readable on it and under ink", () => {
    const volt = token("volt");
    const primary = token("primary");
    expect(contrast(volt, primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(volt, token("ink"))).toBeGreaterThanOrEqual(7);
    expect(contrast("#ffffff", primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("the hero and the last call are cobalt panels with volt accents", () => {
    const hero = page.slice(page.indexOf("<Spotlight"), page.indexOf("</section>"));
    expect(hero).toContain("bg-primary");
    expect(hero).toMatch(/volt/);
    const last = page.slice(page.lastIndexOf("<section"));
    expect(last).toContain("bg-primary");
  });
});

describe("the headline arrives word by word", () => {
  it("splits the h1 into words that rise in one after another", () => {
    const h1 = page.slice(page.indexOf("<h1"), page.indexOf("</h1>"));
    expect(h1).toContain("<Words");
    const words = read("components/home/Words.tsx");
    expect(words).toContain("word-rise");
    expect(words).toContain("animationDelay");
    expect(css).toMatch(/\.word-rise\s*\{[^}]*animation:/);
  });

  it("keeps the spaces between words: they sit between the masks, where an inline-block can't swallow them", async () => {
    const { Words } = await import("@/components/home/Words");
    const html = renderToStaticMarkup(createElement(Words, { text: "Know what the room" }));
    expect(html.match(/<\/span><\/span> <span class="word-mask">/g)).toHaveLength(3);
    expect(html.replace(/<[^>]+>/g, "")).toBe("Know what the room");
  });

  it("the spinning badge's words fit once round the circle, without running into themselves", () => {
    expect(read("components/home/SpinBadge.tsx")).toMatch(/textLength=/);
  });

  it("marks one word with a volt highlighter that sweeps in", () => {
    expect(css).toMatch(/\.marker\s*\{[^}]*background/);
    expect(page).toContain('className="marker');
  });
});

describe("a marquee of question types", () => {
  it("scrolls every question type past, twice over so it loops without a jump", async () => {
    const { Marquee } = await import("@/components/home/Marquee");
    const html = renderToStaticMarkup(createElement(Marquee, { items: KIND_INFO.map((k) => k.label) }));
    for (const k of KIND_INFO) expect(html.split(k.label.replace(/&/g, "&amp;")).length - 1, k.label).toBe(2);
    // the copy is for the loop only, so screen readers hear the list once
    expect(html).toMatch(/aria-hidden="true"/);
    expect(css).toMatch(/@keyframes marquee/);
    expect(page).toContain("<Marquee");
  });

  it("is not a section of its own (the page stays at five)", () => {
    expect(page.match(/<section/g)!.length).toBeLessThanOrEqual(5);
  });
});

describe("sections reveal as you scroll", () => {
  it("hides them only once the browser has checked they're off screen", () => {
    const reveal = read("components/home/Reveal.tsx");
    expect(reveal).toContain("IntersectionObserver");
    expect(reveal).toMatch(/data-shown=\{shown === null \? undefined : shown\}/);
    expect(css).toMatch(/\[data-shown="false"\][^{]*\{[^}]*opacity: 0/);
    expect(page.match(/<Reveal/g)!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("the hero responds to the pointer", () => {
  it("a glow follows the pointer and the demo tilts towards it, both skipped for reduced motion", () => {
    const spot = read("components/home/Spotlight.tsx");
    expect(spot).toContain("--spot-x");
    expect(spot).toContain("prefers-reduced-motion");
    const tilt = read("components/home/Tilt.tsx");
    expect(tilt).toContain("prefers-reduced-motion");
    expect(tilt).toMatch(/rotateX|--tilt-x/);
    expect(page).toContain("<Spotlight");
    expect(page).toContain("<Tilt");
  });

  it("a badge spins slowly beside the demo", () => {
    expect(css).toMatch(/@keyframes spin-slow/);
    expect(page).toContain("<SpinBadge");
  });
});

describe("motion stays kind", () => {
  it("reduced motion stops the marquee, the spin and the reveals", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/marquee|\.marquee-track/);
    expect(reduced).toMatch(/data-shown/);
  });

  it("the wordmark has a light version for cobalt panels", async () => {
    const { Logo } = await import("@/components/Logo");
    const light = renderToStaticMarkup(createElement(Logo, { tone: "light" }));
    expect(light).toContain("text-white");
    const dark = renderToStaticMarkup(createElement(Logo));
    expect(dark).toContain("text-ink");
  });
});
