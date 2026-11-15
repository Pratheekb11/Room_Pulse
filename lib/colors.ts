// Colour helpers shared by the voting page and the dashboard.

/** Topic identity colours: soft pastels for fills (bars, slices, chips). Cycles after 8. */
export const TOPIC_COLORS = [
  "#dfa88f", // peach
  "#9fbbe0", // sky
  "#9fc9a2", // mint
  "#c0a8dd", // lavender
  "#d9b56e", // gold
  "#e3a5b8", // rose
  "#93c4c0", // sea
  "#c9b79c", // sand
] as const;

/** Darker partner of each topic colour, for text drawn in that colour on white (≥ 4.5:1). */
export const TOPIC_INKS = ["#9a4a26", "#2f5f99", "#2f7340", "#6a4799", "#7d5a12", "#9b3a5a", "#2a6e69", "#6e5a3a"] as const;

/**
 * A colour at the design's colour strength (`--theme-chroma`, set by lib/themes.ts): full colour normally,
 * a grey of the same brightness in plain designs (Mono). Same brightness = text contrast is unchanged.
 */
export function tinted(full: string, css: string = full): string {
  // grey with the same relative luminance (WCAG), so contrast with any text colour is unchanged
  const l = luminance(parseHex(full));
  const s = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
  const y = Math.round(s * 255);
  return `color-mix(in srgb, ${css} var(--theme-chroma, 100%), ${hex([y, y, y])})`;
}

/**
 * Option colour N: the slide design's own (`--topic-N`, set by lib/themes.ts) with the default set behind it.
 * The grey for plain designs is worked out from the default colour; plain designs don't set their own.
 */
export const topicColor = (index: number) => {
  const i = index % TOPIC_COLORS.length;
  return tinted(TOPIC_COLORS[i], `var(--topic-${i}, ${TOPIC_COLORS[i]})`);
};

/** Text drawn in option colour N (word lists): the design's readable shade, or the default dark ink. */
export const topicInk = (index: number) => {
  const i = index % TOPIC_INKS.length;
  return tinted(TOPIC_INKS[i], `var(--topic-ink-${i}, ${TOPIC_INKS[i]})`);
};

/** A shade of `color`, darkened just enough to read as text (4.5:1) on every one of `backgrounds`, keeping its hue. */
export function readableShade(color: string, backgrounds: string[]): string {
  const [h, sat, light] = toHsl(parseHex(color));
  const bgs = backgrounds.map(parseHex);
  // darker shades of a pastel look grey unless they're also more saturated
  const s2 = Math.min(1, Math.max(sat, 0.45));
  for (let l = light; l >= 0; l -= 0.01) {
    const c = fromHsl(h, s2, l);
    if (bgs.every((b) => contrast(c, b) >= 4.6)) return hex(c);
  }
  return hex(BLACK);
}

function toHsl([r, g, b]: RGB): [number, number, number] {
  const [x, y, z] = [r / 255, g / 255, b / 255];
  const max = Math.max(x, y, z);
  const min = Math.min(x, y, z);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const INK: RGB = [38, 37, 30]; // #26251e
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
export type RGB = [number, number, number];

// Single-hue sequential scale (warm cream → deep burnt orange), in sRGB stops.
const SCALE: RGB[] = [
  [246, 239, 228],
  [243, 214, 190],
  [238, 175, 135],
  [229, 124, 72],
  [196, 74, 22],
  [120, 42, 10],
];

function hex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The score scale of a slide design: from a pale tint of its colour to a deep shade of it, light to dark
 * (darker = stronger, as the legends say). `heat` picks another colour where the main one is a poor fit.
 */
export function heatStops(theme: { colors: { primary: string }; heat?: string }): RGB[] {
  const base = parseHex(theme.heat ?? theme.colors.primary);
  return [mix(WHITE, base, 0.08), mix(WHITE, base, 0.25), mix(WHITE, base, 0.5), mix(WHITE, base, 0.8), mix(base, BLACK, 0.25), mix(base, BLACK, 0.55)];
}

/** t in [0, 1] → colour on the sequential scale. */
function sample(t: number, stops: RGB[]): RGB {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/**
 * Some mid-tones reach 4.5:1 with neither ink nor white text. Nudge those
 * slightly lighter or darker (whichever is closer) so text always passes AA.
 */
function avoidDeadZone(rgb: RGB, stops: RGB[]): RGB {
  const ok = (c: RGB) => Math.max(contrast(c, WHITE), contrast(c, INK)) >= 4.6;
  if (ok(rgb)) return rgb;
  const towardLight = luminance(rgb) > 0.2;
  const target: RGB = towardLight ? WHITE : stops[stops.length - 1];
  for (let f = 0.02; f <= 1; f += 0.02) {
    const c = mix(rgb, target, f);
    if (ok(c)) return c;
  }
  return target;
}

/** Background + readable text colour for a value on 1…scaleMax. */
export function scaleColor(value: number, scaleMax: number, stops: RGB[] = SCALE): { bg: string; fg: string } {
  // Start slightly above the lightest stop so low scores stay visible on white.
  const t = (value - 1) / Math.max(1, scaleMax - 1);
  const rgb = avoidDeadZone(sample(0.12 + 0.88 * t, stops), stops);
  const fg = contrast(rgb, WHITE) >= contrast(rgb, INK) ? WHITE : INK;
  return { bg: tinted(hex(rgb)), fg: hex(fg) };
}

function parseHex(h: string): RGB {
  // also takes a tinted() colour: its first #rrggbb is the full colour (the grey has the same brightness)
  const m = /#[0-9a-f]{6}/i.exec(h);
  const n = parseInt((m ? m[0] : h).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Ink or white, whichever reads better on the given background. */
export function readableOn(bgHex: string): string {
  const rgb = parseHex(bgHex);
  return contrast(rgb, WHITE) >= contrast(rgb, INK) ? "#ffffff" : "#26251e";
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  return contrast(parseHex(a), parseHex(b));
}

/**
 * A colour mixed with the design's surface (white in light designs, dark in dark ones),
 * so the theme's own text colour stays readable on it.
 */
export const onSurface = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--color-white, #ffffff))`;
