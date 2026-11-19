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
const quiet = /:root:has\(\.quiet\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
const scoped = (name: string) => new RegExp(`--color-${name}: (#[0-9a-f]{6})`).exec(quiet)?.[1] ?? "";

describe("two tones", () => {
  it("the page swaps the colour variables for near-black and soft grey, so shared pieces follow", () => {
    expect(page).toMatch(/className="quiet home-quiet /);
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
    expect(css).toMatch(/:root:has\(\.quiet\) body[^{]*\{[^}]*background/);
  });

  it("has no neon, glow, hard shadows, stickers or emoji", () => {
    expect(css).not.toMatch(/--color-volt/);
    expect(page).not.toMatch(/volt|shadow-\[|Sticker|Spotlight|Tilt|SpinBadge|Marquee|halftone|rotate-/);
    expect(page).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const gone of ["Marquee", "SpinBadge", "Spotlight", "Tilt"]) expect(existsSync(new URL(`../components/home/${gone}.tsx`, import.meta.url)), gone).toBe(false);
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
    expect(list).toMatch(/\brule\b/);
    expect(list).not.toMatch(/rounded-/);
  });
});

describe("motion that feels designed", () => {
  it("headlines rise word by word from behind a mask, keeping the spaces", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Words } = await import("@/components/home/Words");
    const html = renderToStaticMarkup(createElement(Words, { text: "Know what the room" }));
    expect(html.replace(/<[^>]+>/g, "")).toBe("Know what the room");
    expect(html.match(/class="w"/g)).toHaveLength(4);
    expect(html).toContain("--i:3");
    expect(css).toMatch(/\.w > span\s*\{[^}]*animation:[^;]*1[0-9]{3}ms/);
    expect(css).toMatch(/calc\(var\(--i/);
    // the headline and every section title
    const h1 = page.slice(page.indexOf("<h1"), page.indexOf("</h1>"));
    expect(h1).toContain("<Words");
    expect(page.match(/<h2[^>]*>\s*<Words/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("section titles wait until they're scrolled to", () => {
    expect(css).toMatch(/\[data-shown="false"\] \.w > span\s*\{[^}]*animation: none/);
  });

  it("hairlines draw in from the left, one after another, when scrolled to", () => {
    expect(css).toMatch(/\.rule::before\s*\{[^}]*transform-origin: left/);
    expect(css).toMatch(/@keyframes rule/);
    expect(css).toMatch(/\[data-shown="false"\] \.rule::before[^{]*\{[^}]*animation: none/);
    const pieces = page + read("components/home/ActivityList.tsx") + read("components/FeatureList.tsx");
    expect(pieces.match(/\brule\b/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("a hairline grows down the middle, like a thread to the next part", () => {
    expect(page).toContain('className="thread');
    expect(css).toMatch(/@keyframes thread/);
  });

  it("the logo's pulse draws itself as the page opens", () => {
    expect(css).toMatch(/\.quiet \.logo-mark path\s*\{[^}]*stroke-dasharray/);
  });

  it("scrolling moves things: the headline drifts away, the demo settles in, the tree floats", () => {
    const scroll = css.slice(css.indexOf("@supports (animation-timeline: view())"));
    expect(scroll).toMatch(/animation-timeline: scroll\(root\)/);
    expect(scroll).toMatch(/animation-timeline: view\(\)/);
    for (const cls of ["drift", "settle", "float-scroll"]) {
      expect(scroll, cls).toContain(`.${cls}`);
      expect(page, cls).toContain(cls);
    }
    // only for people who haven't asked for less motion
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*\{\s*@supports \(animation-timeline: view\(\)\)/);
  });

  it("links underline with a sweep on hover", () => {
    expect(css).toMatch(/\.sweep\s*\{[^}]*background-size/);
    expect(css).toMatch(/\.sweep:hover[^{]*\{[^}]*background-size: 100% 1px/);
    expect(page.match(/sweep/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("a heartbeat runs along the pulse mark at the end", () => {
    expect(page).toContain("heartbeat");
    expect(css).toMatch(/\.heartbeat\s*\{[^}]*animation:[^;]*infinite/);
  });

  it("sections fade in when scrolled to, hidden only once the browser has checked", () => {
    const reveal = read("components/home/Reveal.tsx");
    expect(reveal).toContain("IntersectionObserver");
    expect(reveal).toMatch(/data-shown=\{shown === null \? undefined : shown\}/);
    expect(css).toMatch(/\.reveal\[data-shown="false"\]\s*\{[^}]*opacity: 0/);
    expect(page.match(/<Reveal/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("nothing moves for people who ask for reduced motion", () => {
    const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)") - 1);
    const home = css.slice(css.indexOf(":root:has(.quiet) {"));
    const quietReduced = home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const sel of [".reveal[data-shown]", ".thread", ".w > span", ".rule::before", ".heartbeat"]) expect(quietReduced, sel).toContain(sel);
    expect(reduced).toBeTruthy();
  });
});

describe("the demo fits the page", () => {
  it("scores with numbers, not emoji faces, in the page's own tones", () => {
    const demo = read("components/LiveDemo.tsx");
    expect(demo).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(demo).not.toMatch(/#[0-9a-f]{6}/i);
  });
});

describe("team activities: a few up front, the rest a tap away", () => {
  it("shows 4 activities with what they are and how long they take, then a button for the rest", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { ACTIVITIES } = await import("@/lib/activities");
    const { ActivityList } = await import("@/components/home/ActivityList");
    const items = ACTIVITIES.map((a) => ({ id: a.id, label: a.label, blurb: a.blurb, minutes: a.minutes }));
    const html = renderToStaticMarkup(createElement(ActivityList, { items }));
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
    for (const a of ACTIVITIES.slice(0, 4)) {
      expect(html).toContain(esc(a.blurb));
      expect(html).toContain(`${a.minutes} min`);
    }
    // the rest are listed (for search engines and screen readers once opened), folded away until asked for
    for (const a of ACTIVITIES.slice(4)) expect(html).toContain(esc(a.label));
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="more-activities"/);
    expect(html).toContain(`See all ${ACTIVITIES.length} activities`);
    expect(html).toMatch(/id="more-activities"[^>]*data-open="false"/);
    expect(html).toMatch(/<div[^>]*inert/);
    expect(page).toContain("<ActivityList");
  });

  it("unfolds with a drop-down: the box grows, then the names slide in one after another", () => {
    expect(css).toMatch(/\.unfold\s*\{[^}]*grid-template-rows: 0fr[^}]*transition: grid-template-rows/);
    expect(css).toMatch(/\.unfold\[data-open="true"\]\s*\{[^}]*grid-template-rows: 1fr/);
    expect(css).toMatch(/\.unfold\[data-open="true"\] \.unfold-item\s*\{[^}]*transition-delay: calc\(var\(--j/);
  });
});

describe("what you can do: a few up front, the rest a tap away", () => {
  it("shows 4 features, then a button that unfolds the rest and the question types", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { FeatureList } = await import("@/components/FeatureList");
    const { productFeatures } = await import("@/lib/features");
    const { KIND_INFO } = await import("@/lib/kinds");
    const all = productFeatures({ ai: true });
    const html = renderToStaticMarkup(createElement(FeatureList, { ai: true }));
    const shown = html.slice(0, html.indexOf('id="more-features"'));
    const folded = html.slice(html.indexOf('id="more-features"'));
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
    for (const f of all.slice(0, 4)) expect(shown).toContain(esc(f.title));
    for (const f of all.slice(4)) expect(folded).toContain(esc(f.title));
    for (const k of KIND_INFO) expect(folded).toContain(esc(k.label));
    expect(html).toMatch(/aria-controls="more-features"/);
    expect(html).toContain(`See all ${all.length} features`);
  });

  it("activities and features fold the same way (one Fold)", () => {
    expect(read("components/FeatureList.tsx")).toContain("<Fold");
    expect(read("components/home/ActivityList.tsx")).toContain("<Fold");
    const fold = read("components/home/Fold.tsx");
    expect(fold).toContain('className="unfold"');
    expect(fold).toMatch(/inert=\{!open\}/);
  });
});

describe("flow: light runs along the lines, like the heartbeat", () => {
  it("a signal drops down each thread", () => {
    expect(css).toMatch(/\.thread::after\s*\{[^}]*animation: signal[^;]*infinite/);
    expect(css).toMatch(/@keyframes signal/);
  });

  it("How it works passes a light from step to step", () => {
    expect(css).toMatch(/\.glint\s*\{[^}]*animation: glint[^;]*calc\(var\(--i[^;]*infinite/);
    const how = page.slice(page.indexOf('id="how-h"'), page.indexOf('aria-labelledby="activities-h"'));
    expect(how).toMatch(/className="glint"[^>]*"--i": i/);
  });

  it("each vote in the demo sends a light from the phone to the results", () => {
    const demo = read("components/LiveDemo.tsx");
    expect(demo).toMatch(/key=\{`glint-\$\{tap\.tick\}`\}[^>]*className="glint-once/);
    expect(css).toMatch(/\.glint-once\s*\{[^}]*animation: glint-once/);
  });

  it("links light up along their line on hover", () => {
    expect(css).toMatch(/\.link-row:hover::after[^{]*\{[^}]*animation: glint-once/);
  });

  it("never reaches past the edge of the page (lights move inside their line, not across the page)", () => {
    for (const sel of [".glint", ".glint-once"]) {
      const at = css.indexOf(`${sel} {`);
      const rule = css.slice(at, css.indexOf("}", at));
      expect(rule, sel).not.toMatch(/translateX/);
    }
    for (const kf of ["glint", "glint-once"]) {
      const at = css.indexOf(`@keyframes ${kf} {`);
      const body = css.slice(at, css.indexOf("\n}", at));
      expect(body, kf).not.toMatch(/translateX/);
    }
  });

  it("all of it rests for reduced motion", () => {
    const home = css.slice(css.indexOf(":root:has(.quiet) {"));
    const reduced = home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
    for (const sel of [".thread::after", ".glint", ".glint-once"]) expect(reduced, sel).toContain(sel);
  });
});
