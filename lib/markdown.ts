import type { ChoiceSummaryRow, SummaryRow } from "./queries";

/** Answers are people's own words: stop them from turning into headings, links or lists. */
export function escapeMd(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/([\\`*_{}[\]<>#|~!])/g, "\\$1");
}

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

  // Ratings: one line per item, with the average per measure.
  const items = new Map<number, { focus: string; topic: string; parts: string[]; n: number }>();
  for (const r of ratings) {
    const it = items.get(r.topicPosition) ?? { focus: r.focus, topic: r.topic, parts: [], n: 0 };
    it.parts.push(`${escapeMd(r.criterion)} ${r.n ? (r.sum / r.n).toFixed(1) : "–"}`);
    it.n = Math.max(it.n, r.n);
    items.set(r.topicPosition, it);
  }
  for (const it of items.values()) add(it.focus, `- ${escapeMd(it.topic)}: ${it.parts.join(", ")} (${it.n} ${it.n === 1 ? "answer" : "answers"})`);

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
