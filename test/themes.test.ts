import { describe, expect, it } from "vitest";
import { contrastRatio, topicInk } from "@/lib/colors";
import { DEFAULT_THEME, THEMES, THEME_IDS, getTheme, recommendTheme, themeStyle } from "@/lib/themes";
import { TEMPLATES } from "@/lib/templates";
import { createSessionSchema, editSessionSchema } from "@/lib/validation";

describe("slide designs", () => {
  it("offers a handful of looks, light and dark, with Paper (the current look) as the default", () => {
    expect(DEFAULT_THEME).toBe("paper");
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
    expect(THEMES.length).toBeGreaterThanOrEqual(11);
    // the usual families of slide design are all there
    expect(new Set(THEMES.map((t) => t.style))).toEqual(
      new Set(["Minimal", "Professional", "Nature", "Elegant", "Playful", "Anime", "Classroom", "Dark", "Tech", "Bold"]),
    );
    expect(THEMES.some((t) => t.dark)).toBe(true);
    expect(THEMES.some((t) => !t.dark)).toBe(true);
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.blurb.length).toBeGreaterThan(0);
    }
  });

  it.each(THEMES.map((t) => [t.id, t] as const))("%s keeps text readable (WCAG AA)", (_id, t) => {
    const c = t.colors;
    // body text on the page and on cards
    for (const bg of [c.canvas, c.surface]) {
      expect(contrastRatio(c.ink, bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(c.inkSoft, bg)).toBeGreaterThanOrEqual(4.5);
    }
    // inverted chips (bg-ink text-white) and the main button (bg-primary text-white)
    expect(contrastRatio(c.surface, c.ink)).toBeGreaterThanOrEqual(7);
    // button labels are large bold text (AA large: 3:1); text-white reads the surface colour
    expect(contrastRatio(c.surface, c.primary)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.error, c.surface)).toBeGreaterThanOrEqual(4.5);
    // notices drawn on the tint colours with ink text
    for (const tint of [c.sun, c.mint, c.lavender]) expect(contrastRatio(c.ink, tint)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES.map((t) => [t.id, t] as const))("%s gives chart words and warnings a readable colour", (_id, t) => {
    const style = themeStyle(t.id);
    expect(contrastRatio(style["--color-warn"], t.colors.surface)).toBeGreaterThanOrEqual(4.5);
    for (let i = 0; i < 8; i++) {
      const ink = style[`--topic-ink-${i}`] ?? topicInk(i);
      expect(contrastRatio(ink, t.colors.surface), `${t.id} word ${i}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("only the anime design has a background pattern (halftone dots); the others clear it", () => {
    expect(themeStyle("anime")["--theme-pattern"]).toMatch(/radial-gradient/);
    for (const t of THEMES.filter((x) => x.id !== "anime")) expect(themeStyle(t.id)["--theme-pattern"]).toBe("none");
  });

  it("unknown or missing ids fall back to the default", () => {
    expect(getTheme("nope").id).toBe("paper");
    expect(getTheme(undefined).id).toBe("paper");
    expect(getTheme("chalk").id).toBe("chalk");
  });

  it("turns a theme into the CSS variables the app's colours read", () => {
    const style = themeStyle("midnight");
    const m = getTheme("midnight").colors;
    expect(style["--color-canvas"]).toBe(m.canvas);
    expect(style["--color-white"]).toBe(m.surface);
    expect(style["--color-ink"]).toBe(m.ink);
    expect(style["--color-primary"]).toBe(m.primary);
    expect(style.colorScheme).toBe("dark");
    expect(themeStyle("paper").colorScheme).toBe("light");
  });
});

describe("recommendTheme", () => {
  const kinds = (...k: string[]) => k as never[];

  it("suggests a bold arcade look when there's a quiz", () => {
    expect(recommendTheme({ title: "Friday fun", kinds: kinds("poll", "quiz") }).id).toBe("arcade");
  });

  it("suggests a calm look for retros and standups", () => {
    expect(recommendTheme({ title: "Sprint retro", kinds: kinds("poll", "text") }).id).toBe("harbour");
    expect(recommendTheme({ title: "Daily standup", kinds: kinds("words") }).id).toBe("harbour");
  });

  it("suggests the chalkboard for workshops, classes and icebreakers", () => {
    expect(recommendTheme({ title: "Meetup icebreaker", kinds: kinds("words") }).id).toBe("chalk");
    expect(recommendTheme({ title: "React workshop", kinds: kinds("poll") }).id).toBe("chalk");
  });

  it("suggests a dark look for talks and evening events", () => {
    expect(recommendTheme({ title: "Keynote Q&A", kinds: kinds("qa") }).id).toBe("midnight");
    expect(recommendTheme({ title: "Anything", kinds: kinds("qa") }).id).toBe("midnight");
  });

  it("suggests the warm blush look for celebrations", () => {
    expect(recommendTheme({ title: "Team party", kinds: kinds("poll") }).id).toBe("blush");
  });

  it("suggests Neon for tech crowds, Pop for fun, Forest for the outdoors, Harbour for business", () => {
    expect(recommendTheme({ title: "Hackathon kickoff", kinds: kinds("poll") }).id).toBe("neon");
    expect(recommendTheme({ title: "Frontend dev meetup", kinds: kinds("poll") }).id).toBe("neon");
    expect(recommendTheme({ title: "Family fun day", kinds: kinds("poll") }).id).toBe("pop");
    expect(recommendTheme({ title: "Sustainability town hall", kinds: kinds("poll") }).id).toBe("forest");
    expect(recommendTheme({ title: "Q3 all-hands", kinds: kinds("poll") }).id).toBe("harbour");
  });

  it("suggests the anime look for anime, manga and cosplay crowds", () => {
    expect(recommendTheme({ title: "Anime club watch party", kinds: kinds("poll") }).id).toBe("anime");
    expect(recommendTheme({ title: "Manga & cosplay meetup", kinds: kinds("words") }).id).toBe("anime");
    // a quiz still wins: Arcade is made for the timer and leaderboard
    expect(recommendTheme({ title: "Anime trivia", kinds: kinds("quiz") }).id).toBe("arcade");
  });

  it("falls back to Paper and always says why", () => {
    const r = recommendTheme({ title: "Event feedback", kinds: kinds("rating", "text") });
    expect(r.id).toBe("paper");
    for (const t of ["", "Sprint retro", "Quiz night", "Workshop"])
      expect(recommendTheme({ title: t, kinds: kinds("poll") }).reason.length).toBeGreaterThan(10);
  });

  it("recommends a real theme for every template", () => {
    for (const t of TEMPLATES)
      expect(THEME_IDS).toContain(recommendTheme({ title: t.plan.title, kinds: t.plan.questions.map((q) => q.kind) }).id);
  });
});

describe("theme in requests", () => {
  const base = { title: "x", focusTopics: [{ name: "Q", kind: "poll", topics: ["a", "b"] }], criteria: [] };

  it("create defaults to paper, accepts known themes, rejects unknown ones", () => {
    expect(createSessionSchema.parse(base).theme).toBe("paper");
    expect(createSessionSchema.parse({ ...base, theme: "chalk" }).theme).toBe("chalk");
    expect(createSessionSchema.safeParse({ ...base, theme: "sparkly" }).success).toBe(false);
  });

  it("edit leaves the theme alone unless one is given", () => {
    const edit = { ...base, scaleMax: 5, lowLabel: "Low", highLabel: "High", focusTopics: [{ name: "Q", kind: "poll", topics: [{ name: "a" }, { name: "b" }] }] };
    expect(editSessionSchema.parse(edit).theme).toBeUndefined();
    expect(editSessionSchema.parse({ ...edit, theme: "arcade" }).theme).toBe("arcade");
    expect(editSessionSchema.safeParse({ ...edit, theme: "sparkly" }).success).toBe(false);
  });
});
