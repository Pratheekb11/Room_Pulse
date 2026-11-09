import type { ChoiceSummaryRow, SummaryRow } from "./queries";

/** Answers are people's own words: stop them from turning into headings, links or lists. */
export function escapeMd(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/([\\`*_{}[\]<>#|~!])/g, "\\$1");
}

/** "A", "A and B", "A, B and C". */
const andList = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * Results as Markdown, to paste into Slack, Notion or Jira: one section per question, in order.
 * Hidden answers and hidden questions are left out.
 */
export function toMarkdown(title: string, ratings: SummaryRow[], choices: ChoiceSummaryRow[]): string {
  const sections = new Map<string, string[]>();
  const add = (focus: string, line: string) => {
    const key = focus || "Questions";
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key)!.push(line);
  };

  // Score items: best and lowest rated, then every item best first with its description.
  const items = new Map<number, { focus: string; topic: string; description: string | null; parts: string[]; n: number; sum: number; count: number; pos: number }>();
  for (const r of ratings) {
    const it = items.get(r.topicPosition) ?? { focus: r.focus, topic: r.topic, description: r.description ?? null, parts: [], n: 0, sum: 0, count: 0, pos: r.topicPosition };
    it.parts.push(`${escapeMd(r.criterion)} ${r.n ? (r.sum / r.n).toFixed(1) : "–"}`);
    it.n = Math.max(it.n, r.n);
    it.sum += r.sum;
    it.count += r.n;
    items.set(r.topicPosition, it);
  }
  const byFocus = new Map<string, (typeof items extends Map<number, infer V> ? V : never)[]>();
  for (const it of items.values()) byFocus.set(it.focus, [...(byFocus.get(it.focus) ?? []), it]);
  for (const [focus, list] of byFocus) {
    const value = (it: (typeof list)[number]) => (it.count ? it.sum / it.count : null);
    const ranked = [...list].sort((x, y) => {
      const a = value(x);
      const b = value(y);
      if (a === null || b === null) return a === b ? x.pos - y.pos : a === null ? 1 : -1;
      return b - a || x.pos - y.pos;
    });
    const scored = ranked.filter((it) => value(it) !== null);
    if (scored.length) {
      // every item sharing the top (or bottom) score, in the presenter's order
      const hi = value(scored[0])!;
      const lo = value(scored[scored.length - 1])!;
      const named = (v: number) => andList(scored.filter((it) => value(it) === v).sort((x, y) => x.pos - y.pos).map((it) => escapeMd(it.topic)));
      add(focus, `- Best rated: ${named(hi)} (${hi.toFixed(1)})${lo < hi ? `\n- Lowest rated: ${named(lo)} (${lo.toFixed(1)})` : ""}\n`);
    }
    ranked.forEach((it, i) => {
      const v = value(it);
      const line = `${i + 1}. ${escapeMd(it.topic)}: ${v === null ? "–" : v.toFixed(1)} (${it.parts.join(", ")}), ${it.n} ${it.n === 1 ? "answer" : "answers"}`;
      add(focus, it.description ? `${line}\n   ${escapeMd(it.description)}` : line);
    });
  }

  const pollTotals = new Map<string, number>();
  for (const c of choices) if (c.kind === "Poll choice" || c.kind === "Quiz choice" || c.kind === "Right answer") pollTotals.set(c.focus, (pollTotals.get(c.focus) ?? 0) + c.n);

  for (const c of choices) {
    const label = escapeMd(c.label);
    switch (c.kind) {
      case "Hidden answer":
      case "Hidden question":
        break;
      case "Poll choice":
      case "Quiz choice":
      case "Right answer": {
        const total = pollTotals.get(c.focus) ?? 0;
        const pct = total ? Math.round((c.n / total) * 100) : 0;
        add(c.focus, `- ${label}: ${c.n} (${pct}%)${c.kind === "Right answer" ? " ✓ right answer" : ""}`);
        break;
      }
      case "Picked":
      case "Word":
        add(c.focus, `- ${label}: ${c.n}`);
        break;
      case "Average place":
        add(c.focus, `- ${label}: average place ${c.average === null ? "–" : c.average.toFixed(1)}`);
        break;
      case "Average":
      case "Middle value":
        add(c.focus, `- ${c.kind}: ${c.average === null ? "–" : num(c.average)} (${c.n} ${c.n === 1 ? "answer" : "answers"})`);
        break;
      case "Answer":
        add(c.focus, `- ${label}`);
        break;
      case "Audience question":
        add(c.focus, `- ${label} (${c.n} ${c.n === 1 ? "vote" : "votes"})`);
        break;
      case "Answered question":
        add(c.focus, `- ✓ ${label} (${c.n} ${c.n === 1 ? "vote" : "votes"})`);
        break;
    }
  }

  const out = [`# ${escapeMd(title)}`];
  for (const [focus, lines] of sections) out.push(`## ${escapeMd(focus)}`, lines.join("\n"));
  return out.join("\n\n") + "\n";
}
