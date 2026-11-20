import { TOPIC_COLORS, TOPIC_INKS, readableShade } from "./colors";
import type { QuestionKind } from "./types";

// Slide designs: how a presentation looks on the big screen and on voters' phones.
// Each one swaps the colour variables the whole app reads (see app/globals.css), so every
// screen follows without per-component changes. `surface` replaces white, so in dark designs
// `bg-white` cards turn dark and `text-white` on buttons turns dark too.

export const THEME_IDS = ["paper", "mono", "harbour", "forest", "blush", "pop", "anime", "chalk", "midnight", "neon", "arcade"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "paper";

export interface ThemeColors {
  canvas: string;
  canvasSoft: string;
  surface: string;
  surfaceStrong: string;
  ink: string;
  inkSoft: string;
  muted: string;
  mutedSoft: string;
  line: string;
  lineSoft: string;
  lineStrong: string;
  primary: string;
  primaryActive: string;
  sun: string;
  mint: string;
  lavender: string;
  error: string;
  success: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  /** One line on when it suits. */
  blurb: string;
  /** The family of slide design it belongs to (Minimal, Dark, Playful…), shown as a tag. */
  style: string;
  dark: boolean;
  /** Headline typeface (body text stays the same everywhere). */
  font: "grotesk" | "sans" | "serif" | "chalk" | "poster" | "mono" | "anime";
  /** Plain design: option colours, score colours and illustrations turn grey (`--theme-chroma: 0%`). */
  plain?: boolean;
  /** Background pattern drawn behind everything (CSS image), e.g. halftone dots. */
  pattern?: { image: string; size: string };
  /** The colour score scales are built from (colour grid, heatmap), when the main colour shades badly (yellow turns olive). */
  heat?: string;
  /** The design's eight option colours (card headers, bars, slices, chips), all light enough for dark text. Plain designs keep the default set. */
  topics?: string[];
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: "paper",
    style: "Minimal",
    label: "Paper",
    blurb: "Clean white, a vivid cobalt and sticky-note yellow. Fits almost anything.",
    dark: false,
    font: "grotesk",
    topics: ["#aebdfb", "#ffe08a", "#f6a9a0", "#9fdcb8", "#d4b8f6", "#c6e48f", "#a6e3f0", "#efb3d8"],
    colors: {
      canvas: "#f7f7f8",
      canvasSoft: "#fbfbfc",
      surface: "#ffffff",
      surfaceStrong: "#e4e5ea",
      ink: "#0f1115",
      inkSoft: "#3f434b",
      muted: "#5d616a",
      mutedSoft: "#858a94",
      line: "#e2e3e8",
      lineSoft: "#eeeff2",
      lineStrong: "#c8cad2",
      primary: "#2747f5",
      primaryActive: "#1a34cf",
      sun: "#ffe58a",
      mint: "#b3e5cc",
      lavender: "#cfd6fc",
      error: "#cf2747",
      success: "#1b7f5e",
    },
  },
  {
    id: "mono",
    style: "Minimal",
    label: "Mono",
    blurb: "Black on white, nothing extra. The easiest to read.",
    dark: false,
    plain: true,
    font: "sans",
    colors: {
      canvas: "#ffffff",
      canvasSoft: "#fafafa",
      surface: "#ffffff",
      surfaceStrong: "#e5e5e5",
      ink: "#000000",
      inkSoft: "#333333",
      muted: "#555555",
      mutedSoft: "#777777",
      line: "#d4d4d4",
      lineSoft: "#e5e5e5",
      lineStrong: "#1a1a1a",
      primary: "#111111",
      primaryActive: "#000000",
      sun: "#efefef",
      mint: "#e0e0e0",
      lavender: "#d6d6d6",
      error: "#b00020",
      success: "#1a1a1a",
    },
  },
  {
    id: "harbour",
    style: "Professional",
    label: "Harbour",
    blurb: "Cool blues. Calm for retros and standups.",
    dark: false,
    font: "sans",
    topics: ["#9cc0ea", "#8fd3cf", "#f2c38b", "#c3aee8", "#f0a3a0", "#a9d6a5", "#d6c7a8", "#e8b2cc"],
    colors: {
      canvas: "#eef3f7",
      canvasSoft: "#f4f7fa",
      surface: "#ffffff",
      surfaceStrong: "#dbe4ec",
      ink: "#14273a",
      inkSoft: "#45596c",
      muted: "#607081",
      mutedSoft: "#808d9a",
      line: "#dbe4ec",
      lineSoft: "#e6edf3",
      lineStrong: "#bccbd8",
      primary: "#1f64b5",
      primaryActive: "#17528f",
      sun: "#f3e7d3",
      mint: "#cfe8d4",
      lavender: "#e1d8f0",
      error: "#c62b4f",
      success: "#1d7a5a",
    },
  },
  {
    id: "forest",
    style: "Nature",
    label: "Forest",
    blurb: "Sage and moss with a serif. Earthy and calm.",
    dark: false,
    font: "serif",
    topics: ["#a8d08d", "#e8c77a", "#9fc7b4", "#d9a98a", "#d4e08f", "#b7c4e0", "#e3b3a8", "#c2b8a0"],
    colors: {
      canvas: "#f1f4ec",
      canvasSoft: "#f6f8f2",
      surface: "#ffffff",
      surfaceStrong: "#dde4d5",
      ink: "#1f2a1c",
      inkSoft: "#4f5d4a",
      muted: "#677262",
      mutedSoft: "#848e7f",
      line: "#dde4d5",
      lineSoft: "#e7ece1",
      lineStrong: "#c2ccb8",
      primary: "#3f6f2a",
      primaryActive: "#315821",
      sun: "#f1e8cf",
      mint: "#cfe5c4",
      lavender: "#e0dcef",
      error: "#b3261e",
      success: "#2e7a3a",
    },
  },
  {
    id: "blush",
    style: "Elegant",
    label: "Blush",
    blurb: "Soft rose with a serif. Friendly for parties and socials.",
    dark: false,
    font: "serif",
    topics: ["#f2aebf", "#f6c9a4", "#c9b6e8", "#b7d6c4", "#ebb5e8", "#d9d48f", "#a9c4e2", "#d3b49a"],
    colors: {
      canvas: "#fbf1ee",
      canvasSoft: "#fdf6f4",
      surface: "#ffffff",
      surfaceStrong: "#f0dfdb",
      ink: "#2e1d22",
      inkSoft: "#6b4f56",
      muted: "#81686e",
      mutedSoft: "#9a868a",
      line: "#f0dfdb",
      lineSoft: "#f5e8e5",
      lineStrong: "#dcc4bf",
      primary: "#c2335b",
      primaryActive: "#a32649",
      sun: "#f6e6cf",
      mint: "#d3e9d6",
      lavender: "#e7dcf2",
      error: "#b3261e",
      success: "#1d7a5a",
    },
  },
  {
    id: "pop",
    style: "Playful",
    label: "Pop",
    blurb: "Butter yellow and violet. Loud in a good way.",
    dark: false,
    font: "poster",
    topics: ["#c4a5ff", "#7fe0c4", "#ffb37a", "#7cc8ff", "#ff9fc8", "#ffe066", "#a6e36f", "#ff8fa3"],
    colors: {
      canvas: "#fff6db",
      canvasSoft: "#fffaeb",
      surface: "#ffffff",
      surfaceStrong: "#f0e2b6",
      ink: "#24123d",
      inkSoft: "#5a4870",
      muted: "#7a6a8c",
      mutedSoft: "#968aa3",
      line: "#f0e2b6",
      lineSoft: "#f6ecc9",
      lineStrong: "#dcc78f",
      primary: "#7b2ff7",
      primaryActive: "#6420d6",
      sun: "#ffe9a8",
      mint: "#c8f0d8",
      lavender: "#e3d4ff",
      error: "#b3261e",
      success: "#1d7a5a",
    },
  },
  {
    id: "anime",
    style: "Anime",
    label: "Anime",
    blurb: "Sakura pink, manga halftone dots and bubbly type. For anime clubs and fun crowds.",
    dark: false,
    font: "anime",
    topics: ["#ffb3cf", "#a9d8ff", "#ffd98a", "#c5b3ff", "#9fe3c8", "#ffbfa0", "#e6a8f0", "#b8e08f"],
    pattern: { image: "radial-gradient(rgb(232 36 111 / 0.1) 1.4px, transparent 1.6px)", size: "14px 14px" },
    colors: {
      canvas: "#fff0f5",
      canvasSoft: "#fff6f9",
      surface: "#ffffff",
      surfaceStrong: "#fbd9e6",
      ink: "#2a1638",
      inkSoft: "#5f4a73",
      muted: "#7c688d",
      mutedSoft: "#9787a4",
      line: "#f8d6e4",
      lineSoft: "#fbe5ee",
      lineStrong: "#eab3c9",
      primary: "#e1236c",
      primaryActive: "#c81a5c",
      sun: "#fff1c7",
      mint: "#c9f1e3",
      lavender: "#e2d9ff",
      error: "#b3261e",
      success: "#1d7a5a",
    },
  },
  {
    id: "chalk",
    style: "Classroom",
    label: "Chalkboard",
    blurb: "Green board, chalk lettering. For workshops and classes.",
    dark: true,
    font: "chalk",
    topics: ["#f2d65c", "#f4a6a6", "#9fd4f0", "#b5e3a1", "#f7b98a", "#d2b8f2", "#ece9dc", "#8fe0d0"],
    heat: "#f08a3c",
    colors: {
      canvas: "#1f2b25",
      canvasSoft: "#22302a",
      surface: "#263530",
      surfaceStrong: "#34453d",
      ink: "#f3f1e7",
      inkSoft: "#c3c8bd",
      muted: "#9aa397",
      mutedSoft: "#7d877b",
      line: "#34453d",
      lineSoft: "#2d3c35",
      lineStrong: "#4a5e54",
      primary: "#f2d65c",
      primaryActive: "#e6c53a",
      sun: "#4a4325",
      mint: "#2e5a40",
      lavender: "#3f3a5a",
      error: "#ff8a9a",
      success: "#7fd6a8",
    },
  },
  {
    id: "midnight",
    style: "Dark",
    label: "Midnight",
    blurb: "Dark and easy on the eyes in a dim room. For talks.",
    dark: true,
    font: "serif",
    topics: ["#ff9f80", "#8fb8ff", "#f7d488", "#b9a3ff", "#7fd9b9", "#ff9cc3", "#9fdcf2", "#d8c3a0"],
    colors: {
      canvas: "#11151c",
      canvasSoft: "#141922",
      surface: "#1a2029",
      surfaceStrong: "#262e3a",
      ink: "#eef1f5",
      inkSoft: "#b4bcc8",
      muted: "#8a93a1",
      mutedSoft: "#6b7482",
      line: "#262e3a",
      lineSoft: "#202733",
      lineStrong: "#3a4555",
      primary: "#ff7a59",
      primaryActive: "#ff6340",
      sun: "#3d3322",
      mint: "#1f4636",
      lavender: "#362f52",
      error: "#ff8197",
      success: "#6fd3a7",
    },
  },
  {
    id: "neon",
    style: "Tech",
    label: "Neon",
    blurb: "Dark with a cyan glow and code type. For dev crowds.",
    dark: true,
    font: "mono",
    topics: ["#3ee0d0", "#ff7ddc", "#b4ff5c", "#9aa5ff", "#ffd15c", "#5cc8ff", "#ff9f80", "#d0a8ff"],
    colors: {
      canvas: "#0b1016",
      canvasSoft: "#0e141b",
      surface: "#121a23",
      surfaceStrong: "#1d2834",
      ink: "#e6fbff",
      inkSoft: "#a5bccb",
      muted: "#7d93a3",
      mutedSoft: "#5e7383",
      line: "#1d2834",
      lineSoft: "#172029",
      lineStrong: "#2f4150",
      primary: "#3ee0d0",
      primaryActive: "#22c9b8",
      sun: "#3a3416",
      mint: "#123d33",
      lavender: "#2c2650",
      error: "#ff7f96",
      success: "#5fe3a1",
    },
  },
  {
    id: "arcade",
    style: "Bold",
    label: "Arcade",
    blurb: "Black and yellow, big poster type. Made for quizzes.",
    dark: true,
    font: "poster",
    topics: ["#ffd400", "#ff7a9c", "#3ad6ff", "#7cff6b", "#c49bff", "#ff9a3c", "#4dffc3", "#ff8ae8"],
    heat: "#ff4d7a",
    colors: {
      canvas: "#121212",
      canvasSoft: "#161616",
      surface: "#1d1d1d",
      surfaceStrong: "#2c2c2c",
      ink: "#fafafa",
      inkSoft: "#bdbdbd",
      muted: "#8f8f8f",
      mutedSoft: "#6e6e6e",
      line: "#2c2c2c",
      lineSoft: "#242424",
      lineStrong: "#444444",
      primary: "#ffd400",
      primaryActive: "#f0c400",
      sun: "#3d3510",
      mint: "#173f2a",
      lavender: "#33284d",
      error: "#ff7a8a",
      success: "#5fd39a",
    },
  },
];

export const isThemeId = (id: unknown): id is ThemeId => typeof id === "string" && (THEME_IDS as readonly string[]).includes(id);

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const FONTS: Record<Theme["font"], string> = {
  grotesk: "var(--font-gabarito), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  serif: "var(--font-newsreader), ui-serif, Georgia, serif",
  chalk: "var(--font-kalam), var(--font-inter), ui-sans-serif, sans-serif",
  poster: "var(--font-archivo-black), var(--font-inter), ui-sans-serif, sans-serif",
  mono: "var(--font-jetbrains), ui-monospace, monospace",
  anime: "var(--font-mochiy), var(--font-inter), ui-rounded, sans-serif",
};

/** CSS variables for a design, as an inline style (preview) or on <html> (live pages). */
export function themeStyle(id: string | null | undefined): Record<string, string> {
  const t = getTheme(id);
  const c = t.colors;
  return {
    "--color-canvas": c.canvas,
    "--color-canvas-soft": c.canvasSoft,
    "--color-white": c.surface,
    "--color-surface-strong": c.surfaceStrong,
    "--color-ink": c.ink,
    "--color-ink-soft": c.inkSoft,
    "--color-muted": c.muted,
    "--color-muted-soft": c.mutedSoft,
    "--color-line": c.line,
    "--color-line-soft": c.lineSoft,
    "--color-line-strong": c.lineStrong,
    "--color-primary": c.primary,
    "--color-primary-active": c.primaryActive,
    "--color-sun": c.sun,
    "--color-mint": c.mint,
    "--color-lavender": c.lavender,
    "--color-error": c.error,
    "--color-success": c.success,
    "--color-warn": t.dark ? "#f5c56b" : "#9a5b00",
    "--font-display": FONTS[t.font],
    // Gabarito reads best a little heavier; the other faces are drawn for 400
    "--display-weight": t.font === "grotesk" || t.font === "sans" ? "600" : "400",
    "--theme-pattern": t.pattern?.image ?? "none",
    // Doodles (components/Doodle.tsx) have dark outlines: a white sticker edge keeps them visible on dark designs.
    "--doodle-halo": t.plain ? "grayscale(1)" : t.dark ? "drop-shadow(0 0 1.2px #fff) drop-shadow(0 0 1.2px #fff)" : "none",
    "--theme-chroma": t.plain ? "0%" : "100%",
    // Accent colours some badges use directly (bg-peach…): greys in plain designs.
    ...(t.plain ? { "--color-peach": "#d9d9d9", "--color-sky": "#cccccc", "--color-gold": "#8c8c8c", "--color-coral": "#d9d9d9" } : {}),
    "--theme-pattern-size": t.pattern?.size ?? "auto",
    // Option colours of the design (lib/colors.ts topicColor reads them). Every design sets all of them,
    // plain ones the default set, so none picks up Paper's from the page (app/globals.css).
    ...Object.fromEntries((t.topics ?? TOPIC_COLORS).map((c, i) => [`--topic-${i}`, c])),
    // Coloured words (e.g. word lists): on dark designs the option colours themselves read well;
    // on light ones a dark shade of each, readable on cards and the page.
    ...Object.fromEntries(
      (t.topics ?? TOPIC_COLORS).map((c, i) => [
        `--topic-ink-${i}`,
        t.dark ? c : t.topics ? readableShade(c, [t.colors.surface, t.colors.canvas]) : TOPIC_INKS[i],
      ]),
    ),
    colorScheme: t.dark ? "dark" : "light",
  };
}

/**
 * Game words (points, combos, "Level complete!") suit a quiz or a playful design, not a sprint retro.
 * Playful designs: Pop, Anime and Arcade.
 */
export function isPlayful(theme: string | null | undefined, kinds: readonly string[]): boolean {
  return kinds.includes("quiz") || ["Playful", "Anime", "Bold"].includes(getTheme(theme).style);
}

const has = (title: string, re: RegExp) => re.test(title.toLowerCase());

/** A design that suits the presentation, from its title and question types, with the reason why. */
export function recommendTheme({ title, kinds }: { title: string; kinds: QuestionKind[] }): { id: ThemeId; reason: string } {
  if (kinds.includes("quiz") || has(title, /\b(quiz|trivia|game)/))
    return { id: "arcade", reason: "It has a quiz: bold colours and big type read well from the back of the room." };
  if (has(title, /\b(anime|manga|cosplay|otaku|kawaii|weeb|j-?pop|k-?pop|japan)/))
    return { id: "anime", reason: "An anime crowd: sakura pink, halftone dots and bubbly lettering." };
  if (has(title, /\b(hackathon|dev|developer|engineering|code|coding|tech|devops|frontend|backend|ai|data|startup)\b/))
    return { id: "neon", reason: "A tech crowd: dark screen, cyan accents and code-style type." };
  if (has(title, /\b(retro|retrospective|standup|stand-up|sprint|check-in|checkin|1:1|one-on-one)/))
    return { id: "harbour", reason: "Retros and standups go better with calm, cool colours." };
  if (has(title, /\b(workshop|class|lesson|training|course|icebreaker|ice breaker|meetup|meet-up|bootcamp|school)/))
    return { id: "chalk", reason: "Workshops and meetups feel at home on a chalkboard." };
  if (has(title, /\b(fun|kids|family|games?|team.?building|friday|hangout)\b/))
    return { id: "pop", reason: "Something light-hearted: bright, playful colours keep the energy up." };
  if (has(title, /\b(sustainab|green|climate|garden|outdoor|wellness|wellbeing|health|nature|eco)/))
    return { id: "forest", reason: "Earthy greens fit wellbeing and nature topics." };
  if (has(title, /\b(all-hands|all hands|town hall|board|quarterly|q[1-4]|client|investor|strategy|kickoff|kick-off|okr)/))
    return { id: "harbour", reason: "Business meetings read best in a clean, professional blue." };
  if (has(title, /\b(party|celebrat|birthday|wedding|social|farewell|anniversary|holiday|christmas|diwali)/))
    return { id: "blush", reason: "A warm, friendly look suits a celebration." };
  if (kinds.includes("qa") || has(title, /\b(keynote|talk|conference|webinar|evening|night|panel|summit|lecture)/))
    return { id: "midnight", reason: "Talks are often in dim rooms, where a dark screen is easier on the eyes." };
  return { id: "paper", reason: "A quiet, readable look that fits almost any presentation." };
}
