import { avg, cellKey, sumAggs, type Agg } from "./stats";
import { defaultChart } from "./charts";
import type { NamedItem, QuestionKind, TopicItem } from "./types";

export interface FocusGroup {
  focus: NamedItem;
  kind: QuestionKind;
  /** Chart the presenter chose; the dashboard opens on it. */
  chart: string;
  /** `index` is the topic's position in the whole presentation (drives its colour). */
  topics: { item: TopicItem; index: number }[];
}

/** Topics grouped under their focus topic, in order. Topics without one go in a "Topics" group. */
export function groupByFocus(
  focusTopics: (NamedItem & { kind?: QuestionKind; chart?: string })[],
  topics: TopicItem[],
): FocusGroup[] {
  const groups = new Map<string, FocusGroup>(
    focusTopics.map((f) => {
      const kind = f.kind ?? "rating";
      return [f.id, { focus: { id: f.id, name: f.name }, kind, chart: f.chart ?? defaultChart(kind), topics: [] }];
    }),
  );
  const loose: FocusGroup = { focus: { id: "", name: "Topics" }, kind: "rating", chart: "heatmap", topics: [] };
  topics.forEach((item, index) => {
    const g = (item.focusId && groups.get(item.focusId)) || loose;
    g.topics.push({ item, index });
  });
  // Word clouds have no topics; other empty groups have nothing to show.
  return [...groups.values(), loose].filter((g) => g.topics.length > 0 || g.kind === "words");
}

export interface FocusSummary {
  n: number;
  sum: number;
  average: number | null;
  best: { id: string; name: string; average: number } | null;
}

export function summarizeFocus(group: FocusGroup, criteria: NamedItem[], cells: Map<string, Agg>): FocusSummary {
  let best: FocusSummary["best"] = null;
  const perTopic = group.topics.map(({ item }) => {
    const agg = sumAggs(criteria.map((c) => cells.get(cellKey(item.id, c.id))));
    const a = avg(agg);
    if (a !== null && (best === null || a > best.average)) best = { id: item.id, name: item.name, average: a };
    return agg;
  });
  const total = sumAggs(perTopic);
  return { n: total.n, sum: total.sum, average: avg(total), best };
}
