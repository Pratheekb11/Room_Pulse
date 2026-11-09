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
export function tinted(full: string): string {
  // grey with the same relative luminance (WCAG), so contrast with any text colour is unchanged
  const l = luminance(parseHex(full));
  const s = l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055;
  const y = Math.round(s * 255);
  return `color-mix(in srgb, ${full} var(--theme-chroma, 100%), ${hex([y, y, y])})`;
}

export const topicInk = (index: number) => tinted(TOPIC_INKS[index % TOPIC_INKS.length]);

export const topicColor = (index: number) => tinted(TOPIC_COLORS[index % TOPIC_COLORS.length]);

const INK: RGB = [38, 37, 30]; // #26251e
const WHITE: RGB = [255, 255, 255];
type RGB = [number, number, number];

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

/** t in [0, 1] → colour on the sequential scale. */
function sample(t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (SCALE.length - 1);
  const i = Math.min(SCALE.length - 2, Math.floor(x));
  const f = x - i;
  const a = SCALE[i];
  const b = SCALE[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const mix = (a: RGB, b: RGB, f: number): RGB => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/**
 * Some mid-tones reach 4.5:1 with neither ink nor white text. Nudge those
 * slightly lighter or darker (whichever is closer) so text always passes AA.
 */
function avoidDeadZone(rgb: RGB): RGB {
  const ok = (c: RGB) => Math.max(contrast(c, WHITE), contrast(c, INK)) >= 4.6;
  if (ok(rgb)) return rgb;
  const towardLight = luminance(rgb) > 0.2;
  const target: RGB = towardLight ? WHITE : SCALE[SCALE.length - 1];
  for (let f = 0.02; f <= 1; f += 0.02) {
    const c = mix(rgb, target, f);
    if (ok(c)) return c;
  }
  return target;
}

/** Background + readable text colour for a value on 1…scaleMax. */
export function scaleColor(value: number, scaleMax: number): { bg: string; fg: string } {
  // Start slightly above the lightest stop so low scores stay visible on white.
  const t = (value - 1) / Math.max(1, scaleMax - 1);
  const rgb = avoidDeadZone(sample(0.12 + 0.88 * t));
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
