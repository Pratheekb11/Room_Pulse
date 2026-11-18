// The home page is quiet: two tones (near-black and soft grey), one weight of type, hairlines, lots of room,
// and one small accent. Motion is slow and small: lines fade up, a hairline grows, sections fade in as you scroll.
// No neon, no stickers, no glow, no hard shadows, no pills, nothing spinning or scrolling by itself.
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
const quiet = /\.home-quiet\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
const scoped = (name: string) => new RegExp(`--color-${name}: (#[0-9a-f]{6})`).exec(quiet)?.[1] ?? "";

describe("two tones", () => {
  it("the page swaps the colour variables for near-black and soft grey, so shared pieces follow", () => {
    expect(page).toMatch(/className="home-quiet /);
    const canvas = scoped("canvas");
    const ink = scoped("ink");
    expect(canvas).toMatch(/^#1[0-9a-f]{5}$/);
    expect(contrast(ink, canvas)).toBeGreaterThanOrEqual(9);
    // quieter text still reads (WCAG AA)
    expect(contrast(scoped("muted"), canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(scoped("ink-soft"), canvas)).toBeGreaterThanOrEqual(4.5);
    // cards are a shade off the canvas, not white
    expect(contrast(scoped("white"), canvas)).toBeLessThan(1.3);
  });

  it("the space round the page is dark too, not the light canvas", () => {
    expect(css).toMatch(/:has\(\.home-quiet\)[^{]*\{[^}]*background/);
  });

  it("has no neon, glow, hard shadows, stickers or emoji", () => {
    expect(css).not.toMatch(/--color-volt/);
    expect(page).not.toMatch(/volt|shadow-\[|Sticker|Spotlight|Tilt|SpinBadge|Marquee|halftone|rotate-/);
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const gone of ["Marquee", "SpinBadge", "Spotlight", "Tilt", "Words"]) expect(existsSync(new URL(`../components/home/${gone}.tsx`, import.meta.url)), gone).toBe(false);
    expect(css).not.toMatch(/\.pop-btn|\.lift|\.wiggle|\.marquee|\.spin-slow|\.spotlight/);
  });
});

describe("one weight of type", () => {
  it("headlines are large, regular weight and tightly set", () => {
    const h1 = /<h1 className="([^"]+)"/.exec(page)![1];
    expect(h1).toContain("font-display");
    expect(h1).toContain("font-normal");
    expect(h1).toMatch(/tracking-\[-0\.0[3-5]\d*em\]/);
    // every h2 uses the shared H2 classes, which are regular weight
    expect(/const H2 = "([^"]+)"/.exec(page)![1]).toContain("font-normal");
    const h2s = [...page.matchAll(/<h2[^>]*className=\{([^}]+)\}/g)].map((m) => m[1]);
    expect(h2s.length).toBeGreaterThanOrEqual(3);
    expect(page.match(/<h2/g)!.length).toBe(h2s.length);
    for (const h of h2s) expect(h).toMatch(/^(H2|`\$\{H2)/);
  });

  it("the quiet scope sets headlines to the regular weight", () => {
    expect(quiet).toMatch(/--display-weight: 400/);
  });
});

describe("hairlines, not boxes", () => {
  it("links are rows on a hairline with an arrow that moves on hover", () => {
    expect(page).toContain("<LinkRow");
    const row = read("components/home/LinkRow.tsx");
    expect(row).toMatch(/border-t/);
    expect(row).toContain("<svg");
    expect(css).toMatch(/\.link-row:hover \.link-arrow[^{]*\{[^}]*transform/);
  });

  it("the features are a list of rows, not tiles", () => {
    const list = read("components/FeatureList.tsx");
    expect(list).toMatch(/border-t/);
    expect(list).not.toMatch(/rounded-/);
  });
});

describe("slow, small motion", () => {
  it("the headline's lines fade up behind a mask, one after the other", () => {
    expect(page).toContain('className="line-mask"');
    expect(css).toMatch(/\.line-rise\s*\{[^}]*animation:[^;]*1[0-9]{3}ms/);
  });

  it("a hairline grows down the middle, like a thread to the next part", () => {
    expect(page).toContain('className="thread');
    expect(css).toMatch(/@keyframes thread/);
  });

  it("sections fade in when scrolled to, hidden only once the browser has checked", () => {
    const reveal = read("components/home/Reveal.tsx");
    expect(reveal).toContain("IntersectionObserver");
    expect(reveal).toMatch(/data-shown=\{shown === null \? undefined : shown\}/);
    expect(css).toMatch(/\.reveal\[data-shown="false"\]\s*\{[^}]*opacity: 0/);
    expect(page.match(/<Reveal/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("nothing moves for people who ask for reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.reveal\[data-shown\]/);
    expect(reduced).toMatch(/\.thread/);
  });
});

describe("the demo fits the page", () => {
  it("scores with numbers, not emoji faces, in the page's own tones", () => {
    const demo = read("components/LiveDemo.tsx");
    expect(demo).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(demo).not.toMatch(/#[0-9a-f]{6}/i);
  });
});
