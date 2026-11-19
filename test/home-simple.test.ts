// The home page is short: one clear thing to do, pictures and chips instead of walls of cards.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeatureList } from "@/components/FeatureList";
import { productFeatures } from "@/lib/features";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const hero = page.slice(page.indexOf("<h1"), page.indexOf("</section>"));

describe("the hero has one clear thing to do", () => {
  it("one Create button, one line saying it's free with no sign-up, and the walkthrough link", () => {
    expect(hero.match(/Create a presentation/g)).toHaveLength(1);
    expect(hero).toMatch(/no sign-up/i);
    expect(hero).toContain("<HowToButton");
    // no card full of ticks and small print round the button
    expect(page).not.toContain("GUEST_POINTS");
    expect(hero).not.toMatch(/Save an account later/);
  });

  it("keeps joining with a code right there, as one short line and a box", () => {
    expect(hero).toContain("<JoinForm");
    expect(hero).toMatch(/Have a code\?/);
  });
});

describe("the page is short", () => {
  it("has five sections at most", () => {
    expect(page.match(/<section/g)!.length).toBeLessThanOrEqual(5);
  });

  // Activities: four with a line each, the rest folded behind a button (test/home-quiet.test.ts); question types as short labels.
  it("shows activities and question types briefly, not a card of text each", () => {
    expect(page).toContain("ACTIVITIES.map");
    expect(page).toContain("KIND_INFO.map");
    expect(page).not.toMatch(/>\s*\{a\.blurb\}\s*</);
    expect(page).not.toMatch(/>\s*\{k\.hint\}\s*</);
    // question types sit with the features, not in a section of their own
    expect(page).not.toContain('aria-labelledby="types-h"');
  });

  it("keeps the three steps to a few words each", () => {
    const bodies = [...page.matchAll(/body: "([^"]+)"/g)].map((m) => m[1]);
    expect(bodies).toHaveLength(3);
    for (const b of bodies) expect(b.length, b).toBeLessThanOrEqual(60);
  });
});

describe("what you can do, at a glance", () => {
  it("gives every feature a line of a few words", () => {
    for (const f of productFeatures({ ai: true })) {
      expect(f.short.length, f.title).toBeGreaterThan(8);
      expect(f.short.length, f.title).toBeLessThanOrEqual(42);
    }
  });

  it("shows the short line on the home page, not the long one", () => {
    const html = renderToStaticMarkup(createElement(FeatureList, { ai: true }));
    for (const f of productFeatures({ ai: true })) {
      expect(html).toContain(f.title);
      expect(html).toContain(f.short.replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
      expect(html).not.toContain(f.body.slice(0, 40).replace(/&/g, "&amp;").replace(/'/g, "&#x27;"));
    }
  });
});

describe("the tree comes alive when you scroll to it", () => {
  it("grows its leaves one after another once it's on screen", () => {
    const mini = read("components/MiniTree.tsx");
    expect(mini).toContain("<GrowOnView");
    expect(mini).toContain("animate-grow");
    expect(mini).toContain("animationDelay");
    const grow = read("components/GrowOnView.tsx");
    expect(grow).toContain("IntersectionObserver");
    // hidden only once the browser has checked it's off screen: without JavaScript the leaves just show
    expect(grow).toMatch(/data-seen=\{seen === null \? undefined : seen\}/);
    expect(read("app/globals.css")).toMatch(/\[data-seen="false"\] \.animate-grow\s*\{[^}]*animation: none/);
  });
});
