// Colour helpers shared by the voting page and the dashboard.

/** Topic identity colours (used for chips, ranking bars). Cycles after 8. */
export const TOPIC_COLORS = [
  "#6A3DF5", // violet
  "#FF5C7A", // coral
  "#FFB81F", // sun
  "#12B886", // mint
  "#2F86FF", // sky
  "#FF7A33", // tangerine
  "#C04CE0", // orchid
  "#00A3B4", // lagoon
] as const;

export const topicColor = (index: number) => TOPIC_COLORS[index % TOPIC_COLORS.length];

const INK: RGB = [26, 20, 70]; // #1A1446
const WHITE: RGB = [255, 255, 255];
type RGB = [number, number, number];

// Single-hue sequential scale (light lavender → deep violet), in sRGB stops.
const SCALE: RGB[] = [
  [240, 236, 255],
  [208, 196, 255],
  [160, 135, 250],
  [112, 74, 232],
  [72, 34, 180],
  [42, 16, 120],
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
  return { bg: hex(rgb), fg: hex(fg) };
}

function parseHex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Ink or white, whichever reads better on the given background. */
export function readableOn(bgHex: string): string {
  const rgb = parseHex(bgHex);
  return contrast(rgb, WHITE) >= contrast(rgb, INK) ? "#ffffff" : "#1a1446";
}
