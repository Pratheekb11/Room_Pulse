// Option colours follow the slide design (2026-11-15): each design has its own set of eight option
// colours (card headers, bars, slices, chips), so Harbour isn't dressed in Paper's peach and Paper
// isn't the old cream-and-orange look. Plain designs (Mono) keep the default set, which turns grey.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOPIC_COLORS, TOPIC_INKS, contrastRatio, readableOn, topicColor, topicInk } from "@/lib/colors";
import { THEMES, themeStyle } from "@/lib/themes";

const INK = "#26251e";

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const distance = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

describe("each colourful design has its own option colours", () => {
  const colourful = THEMES.filter((t) => !t.plain);

  it.each(colourful.map((t) => [t.id, t] as const))("%s has eight of its own", (_id, t) => {
    expect(t.topics, t.id).toBeDefined();
    expect(t.topics).toHaveLength(8);
    for (const c of t.topics!) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    // not the default set
    expect(t.topics!.filter((c, i) => c === TOPIC_COLORS[i]).length).toBeLessThan(2);
  });

  // at least as far apart as the closest pair of the default set (~30)
  it.each(colourful.map((t) => [t.id, t] as const))("%s: the eight are easy to tell apart", (_id, t) => {
    const set = t.topics!;
    for (let i = 0; i < set.length; i++)
      for (let j = i + 1; j < set.length; j++) expect(distance(set[i], set[j]), `${t.id} ${set[i]} vs ${set[j]}`).toBeGreaterThan(32);
  });

  it.each(colourful.map((t) => [t.id, t] as const))("%s: dark text reads on every option colour (cards, tiles)", (_id, t) => {
    for (const c of t.topics!) {
      expect(contrastRatio(INK, c), `${t.id} ${c}`).toBeGreaterThanOrEqual(4.5);
      // components pick text colour from the default set's colour; both must pick ink
      expect(readableOn(c), `${t.id} ${c}`).toBe(INK);
    }
  });

  it("the default set also takes dark text, so the fallback picks the same text colour", () => {
    for (const c of TOPIC_COLORS) expect(readableOn(c)).toBe(INK);
  });

  it("puts them on the page as CSS variables", () => {
    for (const t of colourful) {
      const style = themeStyle(t.id);
      t.topics!.forEach((c, i) => expect(style[`--topic-${i}`], `${t.id} ${i}`).toBe(c));
    }
  });

  it("plain designs set the default set themselves, so they never pick up Paper's from the page", () => {
    for (const t of THEMES.filter((x) => x.plain)) {
      expect(t.topics).toBeUndefined();
      const style = themeStyle(t.id);
      TOPIC_COLORS.forEach((c, i) => expect(style[`--topic-${i}`]).toBe(c));
      TOPIC_INKS.forEach((c, i) => expect(style[`--topic-ink-${i}`]).toBe(c));
    }
  });

  // Paper is the page's own look (no variables are set for it), so globals.css carries its option colours
  it("app/globals.css carries Paper's option colours and inks", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const style = themeStyle("paper");
    for (let i = 0; i < 8; i++) {
      expect(css).toContain(`--topic-${i}: ${style[`--topic-${i}`]};`);
      expect(css).toContain(`--topic-ink-${i}: ${style[`--topic-ink-${i}`]};`);
    }
  });

  // the home page's chips and demo bars use the pastel tokens; they match Paper's option colours, not the old cream-era peach
  it("app/globals.css's pastel set comes from Paper's option colours", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const paper = THEMES.find((t) => t.id === "paper")!;
    for (const token of ["peach", "coral", "sky"]) {
      const value = new RegExp(`--color-${token}: (#[0-9a-f]{6});`).exec(css)![1];
      expect(paper.topics, token).toContain(value);
    }
  });

  it("coloured words get a readable ink of the design's own colour, on light and dark designs", () => {
    for (const t of colourful) {
      const style = themeStyle(t.id);
      for (let i = 0; i < 8; i++) {
        const ink = style[`--topic-ink-${i}`];
        expect(ink, `${t.id} ${i}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrastRatio(ink, t.colors.surface), `${t.id} word ${i}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(ink, t.colors.canvas), `${t.id} word ${i} on canvas`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("option colours read the design's variables", () => {
  it("topicColor and topicInk use --topic-N with the default set behind it", () => {
    for (let i = 0; i < 8; i++) {
      expect(topicColor(i)).toContain(`var(--topic-${i}, ${TOPIC_COLORS[i]})`);
      expect(topicInk(i)).toContain(`var(--topic-ink-${i}, `);
    }
    expect(topicColor(9)).toContain("var(--topic-1, ");
  });

  // var() isn't allowed in SVG presentation attributes (stroke="…"), only in CSS
  it("SVG shapes take option colours through style, not attributes", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) files.push(p);
      }
    };
    walk(new URL("../components", import.meta.url).pathname);
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/\b(stroke|fill)=\{(topicColor|topicInk)\(/);
  });
});
