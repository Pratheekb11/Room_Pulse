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

export interface TopicStat {
  name: string;
  overall: number | null;
  /** Average per criterion, in criteria order. */
  perCriterion: (number | null)[];
  agreement: AgreementLabel | null;
}

const f1 = (v: number) => v.toFixed(1);
const list = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Plain-language findings for an executive summary, most important first. */
export function takeaways(topics: TopicStat[], criteria: string[], scaleMax: number): string[] {
  const rated = topics.filter((t): t is TopicStat & { overall: number } => t.overall !== null).sort((a, b) => b.overall - a.overall);
  if (rated.length === 0) return [];
  const [first, second] = rated;
  if (!second) return [`${first.name} scores ${f1(first.overall)} out of ${scaleMax}.`];

  const out: string[] = [];
  const margin = first.overall - second.overall;
  out.push(
    margin < 0.2
      ? `${first.name} and ${second.name} are nearly tied at the top (${f1(first.overall)} and ${f1(second.overall)}).`
      : `${first.name} leads with ${f1(first.overall)} out of ${scaleMax}, ${f1(margin)} ahead of ${second.name}.`,
  );

  const split = rated.filter((t) => t.agreement === "Split views").map((t) => t.name);
  if (split.length) out.push(`The room is split on ${list(split)}. Worth discussing before deciding.`);

  const last = rated[rated.length - 1];
  const weakest = last.perCriterion
    .map((v, i) => ({ v, name: criteria[i] }))
    .filter((x): x is { v: number; name: string } => x.v !== null)
    .sort((a, b) => a.v - b.v)[0];
  if (weakest && criteria.length > 1) out.push(`${last.name} ranks last at ${f1(last.overall)}, weakest on ${weakest.name} (${f1(weakest.v)}).`);
  else out.push(`${last.name} ranks last at ${f1(last.overall)}.`);

  if (criteria.length > 1) {
    const means = criteria.map((name, i) => {
      const vals = rated.map((t) => t.perCriterion[i]).filter((v): v is number => v !== null);
      return { name, v: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
    });
    const low = means.filter((m): m is { name: string; v: number } => m.v !== null).sort((a, b) => a.v - b.v)[0];
    if (low) out.push(`${low.name} scores lowest across the board (${f1(low.v)} average).`);
  }
  return out;
}
