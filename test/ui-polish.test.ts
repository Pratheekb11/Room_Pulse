// Front-end polish (2026-11-15): the question always shows, text is readable, phones reach the
// question sooner, the presenter's controls are calmer, and score colours follow the slide design.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StepIntro, VoterHeader } from "@/components/VoterChrome";
import { contrastRatio, heatStops, scaleColor } from "@/lib/colors";
import { THEMES, getTheme } from "@/lib/themes";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("the question is always on screen", () => {
  it("a phone shows the Score items question even when it's the only question", () => {
    const out = html(createElement(StepIntro, { name: "Which project should we build first?" }));
    expect(out).toContain("Which project should we build first?");
  });

  it("shows the Score items question as a heading of its own, not tacked onto a level count", () => {
    const out = html(createElement(StepIntro, { name: "Which project first?" }));
    expect(out).toMatch(/<h2[^>]*>Which project first\?<\/h2>/);
  });

  it("the big screen titles every Score items view with the question", () => {
    const dash = read("components/DashboardApp.tsx");
    // colour grid, score spread and summary each sit under the question's own title
    const rating = dash.slice(dash.indexOf(') : view === "heatmap" ? ('), dash.indexOf("</FitToScreen>"));
    expect(rating).toContain("<QuestionTitle");
    expect(rating.match(/<QuestionTitle/g)!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("phones reach the question sooner", () => {
  it("no 'Level 2 of 4' line above a card that already says which question it is", () => {
    const out = html(createElement(StepIntro, {}));
    expect(out).not.toMatch(/Level/);
    expect(out).toBe("");
  });

  it("the line under the title is short enough for one line on a phone", () => {
    const out = html(createElement(VoterHeader, { title: "Retro", theme: "paper", decor: true, score: null }));
    const line = /<p[^>]*>([^<]+)<\/p>/.exec(out)![1];
    expect(line.length).toBeLessThanOrEqual(48);
    expect(line).toContain("Your answers are anonymous.");
  });

  it("the illustration by the title is smaller on a phone", () => {
    const src = read("components/VoterChrome.tsx");
    expect(src).not.toMatch(/className="h-20 w-20 shrink-0"/);
  });
});

describe("text is readable in every design (WCAG AA)", () => {
  it.each(THEMES.map((t) => [t.id, t] as const))("%s: button labels and quiet text reach 4.5:1", (_id, t) => {
    const c = t.colors;
    // text-white on bg-primary: buttons are 14 to 16px bold, which is not "large text"
    expect(contrastRatio(c.surface, c.primary), "button").toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.surface, c.primaryActive), "pressed button").toBeGreaterThanOrEqual(4.5);
    for (const bg of [c.canvas, c.surface]) expect(contrastRatio(c.muted, bg), "muted text").toBeGreaterThanOrEqual(4.5);
    // placeholders and sample text in the demos
    for (const bg of [c.canvas, c.surface]) expect(contrastRatio(c.mutedSoft, bg), "placeholder").toBeGreaterThanOrEqual(3);
  });

  it("the home page's colours are the default design's", () => {
    const css = read("app/globals.css");
    const paper = getTheme("paper").colors;
    const v = (name: string) => new RegExp(`--color-${name}:\\s*([^;]+);`).exec(css)![1].trim().toLowerCase();
    expect(v("primary")).toBe(paper.primary);
    expect(v("primary-active")).toBe(paper.primaryActive);
    expect(v("muted")).toBe(paper.muted);
    expect(v("muted-soft")).toBe(paper.mutedSoft);
    expect(v("ink")).toBe(paper.ink);
    expect(v("canvas")).toBe(paper.canvas);
  });
});

describe("the presenter's controls", () => {
  const dash = read("components/DashboardApp.tsx");
  const controls = dash.slice(dash.indexOf("controls={"), dash.indexOf("<div className=\"flex min-h-0 flex-1"));

  it("keep the everyday ones in view and put the rest in a More menu", () => {
    expect(controls).toContain("<MoreMenu");
    const menu = controls.slice(controls.indexOf("<MoreMenu"));
    for (const label of ["Fit to screen", "Full screen", "Report (PDF)", "Edit questions"]) expect(menu).toContain(label);
  });

  it("Fit to screen still has its shortcut and says when it's on", () => {
    expect(dash).toMatch(/key\.toLowerCase\(\) === "f"/);
    expect(controls).toMatch(/fit && \(/);
  });

  it("the More menu stays inside the screen and closes with Esc or a tap outside", () => {
    const chrome = read("components/ScreenChrome.tsx");
    expect(chrome).toContain("export function MoreMenu");
    expect(chrome).toMatch(/Escape/);
    expect(chrome).toMatch(/role="menu"/);
  });

  it("the status pills are smaller on a phone so the results come up sooner", () => {
    const chrome = read("components/ScreenChrome.tsx");
    expect(chrome).toMatch(/VotingPills[\s\S]*text-sm[^"]*sm:text-lg/);
  });
});

describe("score colours follow the slide design", () => {
  it("builds the scale from the design's main colour", () => {
    const blue = heatStops(getTheme("harbour"));
    const orange = heatStops(getTheme("paper"));
    expect(blue).not.toEqual(orange);
    // light to dark: darker = stronger, as the legend says
    const lum = (rgb: number[]) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    for (const stops of [blue, orange]) for (let i = 1; i < stops.length; i++) expect(lum(stops[i])).toBeLessThan(lum(stops[i - 1]));
    // the blue design's strongest score is blue, not orange
    const [r, , b] = blue[blue.length - 2];
    expect(b).toBeGreaterThan(r);
  });

  it("yellow designs build their scale from a warmer colour, so strong scores don't turn olive", () => {
    for (const id of ["chalk", "arcade"]) {
      const [r, g, b] = heatStops(getTheme(id)).at(-2)!;
      expect(r, id).toBeGreaterThan(g * 1.6);
      expect(r, id).toBeGreaterThan(b);
    }
  });

  it.each(THEMES.map((t) => [t.id, t] as const))("%s: every score reads (4.5:1)", (_id, t) => {
    const stops = heatStops(t);
    for (let v = 1; v <= 10; v += 0.5) {
      const c = scaleColor(v, 10, stops);
      const bg = /#[0-9a-f]{6}/i.exec(c.bg)![0];
      expect(contrastRatio(bg, c.fg), `${t.id} ${v}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("every results view that colours scores reads the design's scale", () => {
    for (const f of ["components/Heatmap.tsx", "components/ExecSummary.tsx", "components/ResultsHeatmap.tsx", "components/FocusOverview.tsx", "components/Donut.tsx", "components/TopicDistribution.tsx"]) {
      expect(read(f), f).toContain("useScaleColor");
    }
    expect(read("components/DashboardApp.tsx")).toMatch(/<HeatScale theme=\{session\.theme\}/);
  });
});

describe("the default design has a look of its own (whiteboard, teal marker, sticky notes)", () => {
  const paper = getTheme("paper");
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const hue = (h: string) => {
    const [r, g, b] = rgb(h).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    const x = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (x * 60 + 360) % 360;
  };

  it("isn't cream with an orange button", () => {
    const [r, , b] = rgb(paper.colors.canvas);
    expect(r - b, "canvas leans warm (cream)").toBeLessThanOrEqual(2);
    const h = hue(paper.colors.primary);
    expect(h < 0 || h > 60, `primary hue ${h}`).toBe(true);
  });

  it("uses a teal marker colour, unlike Harbour's blue and Forest's green", () => {
    const h = hue(paper.colors.primary);
    expect(h).toBeGreaterThanOrEqual(160);
    expect(h).toBeLessThanOrEqual(185);
    for (const other of ["harbour", "forest", "neon"]) expect(getTheme(other).colors.primary).not.toBe(paper.colors.primary);
  });

  it("highlights in sticky-note yellow", () => {
    const h = hue(paper.colors.sun);
    expect(h).toBeGreaterThanOrEqual(42);
    expect(h).toBeLessThanOrEqual(56);
  });

  it("the browser bar and emails use the same colours", () => {
    expect(read("app/layout.tsx")).toContain(`themeColor: "${paper.colors.canvas}"`);
    expect(read("lib/email.ts")).toContain(`background:${paper.colors.primary}`);
  });

  it("says what it looks like", () => {
    expect(paper.blurb).toMatch(/whiteboard/i);
  });
});
