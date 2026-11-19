// The whole site in the home page's quiet style: the app's own screens (sign-in, dashboard, builder, edit,
// report, password and email pages, 404) are near-black and soft grey, and "Quiet" is a slide design of its own,
// the default for new presentations. Voters' phones and the big screen keep whichever design the presenter picks.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_IDS, getTheme, recommendTheme, themeStyle } from "@/lib/themes";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const css = read("app/globals.css");
const block = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
};
const varIn = (text: string, name: string) => new RegExp(`--color-${name}: (#[0-9a-f]{6})`).exec(text)?.[1];

describe("Quiet, the slide design", () => {
  it("is a design of its own and the default for new presentations", () => {
    expect(THEME_IDS).toContain("quiet");
    expect(DEFAULT_THEME).toBe("quiet");
    const t = getTheme("quiet");
    expect(t.dark).toBe(true);
    expect(t.font).toBe("grotesk");
  });

  it("sets headlines in the regular weight, like the home page", () => {
    expect(themeStyle("quiet")["--display-weight"]).toBe("400");
    expect(themeStyle("paper")["--display-weight"]).toBe("600");
  });

  it("is the same colours the site's own screens use", () => {
    const site = block(":root:has(.quiet)");
    const c = getTheme("quiet").colors;
    const pairs: [string, string][] = [
      ["canvas", c.canvas],
      ["white", c.surface],
      ["ink", c.ink],
      ["ink-soft", c.inkSoft],
      ["muted", c.muted],
      ["muted-soft", c.mutedSoft],
      ["line", c.line],
      ["line-strong", c.lineStrong],
      ["primary", c.primary],
      ["error", c.error],
    ];
    for (const [name, value] of pairs) expect(varIn(site, name), name).toBe(value);
  });

  it("is what the builder suggests unless the presentation clearly suits another", () => {
    const pick = (title: string, kinds: ("poll" | "quiz" | "qa")[] = ["poll"]) => recommendTheme({ title, kinds }).id;
    expect(pick("Team lunch ideas")).toBe("quiet");
    expect(pick("Sprint 42 retro")).toBe("quiet");
    expect(pick("Q3 all hands")).toBe("quiet");
    expect(pick("Dev meetup: AI tools")).toBe("quiet");
    expect(pick("Friday trivia", ["quiz"])).toBe("arcade");
    expect(pick("Anime club night")).toBe("anime");
    expect(pick("Diwali party")).toBe("blush");
  });

  it("is put on the page like any other design (only Paper is the page's built-in look)", () => {
    const hook = read("components/useDocumentTheme.ts");
    expect(hook).toMatch(/theme === "paper"/);
    expect(hook).not.toMatch(/theme === DEFAULT_THEME/);
  });

  it("is allowed by the database, with the change for production in its own file", () => {
    expect(read("db/schema.sql")).toMatch(/sessions_theme_check\s+check \(theme in \([^)]*'quiet'/);
    const file = "db/2026-11-19-quiet-design.sql";
    expect(existsSync(new URL(`../${file}`, import.meta.url))).toBe(true);
    const sql = read(file);
    expect(sql).toMatch(/drop constraint if exists sessions_theme_check/);
    for (const id of THEME_IDS) expect(sql, id).toContain(`'${id}'`);
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
    expect(css).toMatch(/\.enter\s*\{[^}]*animation:[^;]*calc\(var\(--i/);
    for (const f of ["components/admin/AuthScreen.tsx", "components/auth/AuthShell.tsx", "components/admin/AdminApp.tsx", "components/admin/PresentationForm.tsx", "components/admin/ReportApp.tsx", "components/StatusScreens.tsx"])
      expect(read(f), f).toMatch(/\benter\b/);
    // presentations and questions stagger by their place in the list
    expect(read("components/admin/AdminApp.tsx")).toMatch(/className="enter[^"]*"[^>]*style=\{\{ "--i": i/);
    expect(read("components/admin/PresentationForm.tsx")).toMatch(/enter[^"]*"[^>]*\n?[^>]*"--i": i/);
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
