// Summary statistics for the executive views.

export type AgreementLabel = "Strong agreement" | "Mixed views" | "Split views";

/**
 * How much the room agrees, from a score histogram (counts[score - 1]).
 * Uses the standard deviation relative to the scale's range, so the same
 * label means the same thing on a 1–3 and a 1–10 scale.
 */
export function agreement(counts: number[], scaleMax: number): { sd: number; label: AgreementLabel } | null {
  let n = 0;
  let sum = 0;
  counts.forEach((c, i) => {
    n += c;
    sum += c * (i + 1);
  });
  if (n < 2) return null;
  const mean = sum / n;
  let sq = 0;
  counts.forEach((c, i) => (sq += c * (i + 1 - mean) ** 2));
  const sd = Math.sqrt(sq / n);
  const relative = sd / Math.max(1, scaleMax - 1);
  const label: AgreementLabel = relative <= 0.2 ? "Strong agreement" : relative <= 0.33 ? "Mixed views" : "Split views";
  return { sd, label };
}

export type Quadrant = "both_high" | "y_high" | "x_high" | "both_low";

/** Which quadrant of the priority matrix a topic falls in. The midpoint counts as high. */
export function quadrant(x: number, y: number, scaleMax: number): Quadrant {
  const mid = (1 + scaleMax) / 2;
  const hx = x >= mid;
  const hy = y >= mid;
  return hx && hy ? "both_high" : hy ? "y_high" : hx ? "x_high" : "both_low";
}
