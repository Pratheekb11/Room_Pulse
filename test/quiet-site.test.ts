// The whole site in the home page's quiet style: the app's own screens (sign-in, dashboard, builder, edit,
// report, password and email pages, 404) are near-black and soft grey. Voters' phones and the big screen keep
// whichever slide design the presenter picks (Paper by default), so presentations look as they did.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_IDS } from "@/lib/themes";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const css = read("app/globals.css");

// The site's own screens are dark; presentations keep the slide designs as they are on main, so this needs
// no database change (2026-11-20: a "Quiet" slide design was tried and dropped for that reason).
describe("no database change needed", () => {
  it("adds no slide design: the designs are exactly the ones the database allows", () => {
    expect(DEFAULT_THEME).toBe("paper");
    expect(THEME_IDS).not.toContain("quiet" as never);
    const allowed = /sessions_theme_check\s+check \(theme in \(([^)]*)\)\)/.exec(read("db/schema.sql"))![1];
    expect(allowed.split(",").map((t) => t.trim().replace(/'/g, ""))).toEqual([...THEME_IDS]);
  });

  // The Quiet branch (2026-11-18 to 11-20) brought no database file. The UX round's "Follow me" (2026-11-21) is the
  // next change, in its own file (test/follow.test.ts).
  it("brings no new database files", () => {
    const files = readdirSync(new URL("../db/", import.meta.url)).filter((f) => /^2026-11-(1[89]|20)/.test(f));
    expect(files).toEqual([]);
  });
});

describe("the site's own screens", () => {
  const quietPages = [
    "app/page.tsx",
    "app/admin/page.tsx",
    "app/admin/edit/[code]/page.tsx",
    "app/admin/report/[code]/page.tsx",
    "app/forgot/page.tsx",
    "app/reset/page.tsx",
    "app/verify/page.tsx",
    "app/not-found.tsx",
  ];

  it("carry the quiet marker, which turns the whole page dark (dialogs included)", () => {
    for (const f of quietPages) expect(read(f), f).toMatch(/className="quiet[ "]/);
    // set on the root, so layers rendered into <body> (dialogs, sheets) follow
    expect(css).toMatch(/:root:has\(\.quiet\)\s*\{[^}]*--color-canvas/);
    expect(css).toMatch(/:root:has\(\.quiet\)[^{]*\{[^}]*background-color/);
  });

  it("darken the browser bar too", () => {
    for (const f of quietPages) expect(read(f), f).toMatch(/themeColor: "#131314"/);
  });

  it("leave voters' phones and the big screen to the presentation's design", () => {
    for (const f of ["app/s/[code]/page.tsx", "app/s/[code]/results/page.tsx", "app/s/[code]/dashboard/page.tsx", "components/VoteApp.tsx", "components/DashboardApp.tsx"])
      expect(read(f), f).not.toMatch(/className="quiet[ "]/);
  });

  it("print the report light, so it reads on paper", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/:root:has\(\.quiet\)\s*\{[^}]*--color-ink: #0f1115/);
    expect(print).toMatch(/:root:has\(\.quiet\)\s*\{[^}]*--color-white: #ffffff/);
  });

  it("keep every QR code on real white, so it scans on a dark page", () => {
    const card = read("components/admin/SessionCard.tsx");
    const qr = card.slice(card.lastIndexOf("<div", card.indexOf("<QRCodeSVG")), card.indexOf("<QRCodeSVG"));
    expect(qr).toMatch(/backgroundColor: "#ffffff"/);
  });
});

describe("the site's own screens move like the home page", () => {
  const titles: [string, RegExp][] = [
    ["components/admin/AuthScreen.tsx", /<h1[^>]*>\s*<Words/],
    ["components/auth/AuthShell.tsx", /<h1[^>]*>\s*<Words/],
    ["components/StatusScreens.tsx", /<h1[^>]*>\s*<Words/],
    ["components/admin/AdminApp.tsx", /<h2 id="sessions-h"[^>]*>\s*<Words/],
    ["components/admin/PresentationForm.tsx", /<h2[^>]*>\s*<Words/],
    ["components/admin/ReportApp.tsx", /<h1[^>]*>\s*<Words/],
  ];

  it("page titles rise word by word", () => {
    for (const [f, re] of titles) expect(read(f), f).toMatch(re);
  });

  it("cards and blocks rise in one after another (--i)", () => {
    expect(css).toMatch(/\.enter\s*\{[^}]*animation:[^;]*calc\((min\()?var\(--i/);
    for (const f of ["components/admin/AuthScreen.tsx", "components/auth/AuthShell.tsx", "components/admin/AdminApp.tsx", "components/admin/PresentationForm.tsx", "components/admin/ReportApp.tsx", "components/StatusScreens.tsx"])
      expect(read(f), f).toMatch(/\benter\b/);
    // presentations and questions stagger by their place in the list
    expect(read("components/admin/AdminApp.tsx")).toMatch(/className="enter[^"]*"[^>]*style=\{\{ "--i": i/);
    // the builder's question list
    expect(read("components/admin/builder/QuestionRail.tsx")).toMatch(/\benter\b[\s\S]{0,200}"--i": i/);
  });

  it("the logo's pulse draws itself on every page of the site", () => {
    expect(read("components/Logo.tsx")).toContain('className="logo-mark');
    expect(css).toMatch(/\.quiet \.logo-mark path\s*\{[^}]*stroke-dasharray/);
  });

  it("dialogs fade in and rise; their backdrops fade", () => {
    expect(css).toMatch(/:root:has\(\.quiet\) \[aria-modal="true"\][^{]*\{[^}]*animation: dialog-in/);
    expect(css).toMatch(/@keyframes dialog-in/);
    expect(css).toMatch(/:root:has\(\.quiet\) \.fixed\.inset-0\[class\*="bg-ink\/"\]:has\(> \[aria-modal="true"\]\)[^{]*\{[^}]*animation: fade/);
    // a solid full-page layer never fades (the page behind would show through)
    expect(css).not.toMatch(/:root:has\(\.quiet\) \.fixed\.inset-0:has/);
  });

  it("menus drop down when opened", () => {
    expect(css).toMatch(/\.quiet details\[open\] > summary \+ \*\s*\{[^}]*animation: drop-down/);
    expect(css).toMatch(/@keyframes drop-down\s*\{[^}]*translateY\(-/);
  });

  it("nothing is caught half-way when the report prints", () => {
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toMatch(/\.enter,\s*\.w > span\s*\{[^}]*animation: none !important/);
  });

  it("reduced motion settles everything at once", () => {
    const home = css.slice(css.indexOf(":root:has(.quiet) {"));
    const reduced = home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".enter");
  });
});

describe("See how it works fits its box", () => {
  // Measured in a browser (2026-11-19): Score items with three items and "Scores go from" needs about 385px
  // on a phone (the four type chips wrap onto two lines) and 375px on a laptop; the box was 360px, so the
  // Create button was cut off. The box is fixed (steps mustn't make it jump), so it must fit the tallest step.
  it("gives the demo room for its tallest step", () => {
    const demo = read("components/HowToDemo.tsx");
    const sizes = [...demo.matchAll(/h-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    const compact = Number(/compact \? "h-\[(\d+)px\]"/.exec(demo)![1]);
    expect(compact).toBeGreaterThanOrEqual(400);
    expect(Math.min(...sizes.filter((n) => n >= 300))).toBeGreaterThanOrEqual(400);
  });
});
