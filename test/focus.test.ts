import { describe, expect, it } from "vitest";
import { groupByFocus, summarizeFocus } from "@/lib/focus";
import { indexCells } from "@/lib/stats";

const focusTopics = [
  { id: "f1", name: "Growth" },
  { id: "f2", name: "Platform" },
];
const topics = [
  { id: "a", name: "A", focusId: "f1" },
  { id: "b", name: "B", focusId: "f1" },
  { id: "c", name: "C", focusId: "f2" },
];
const criteria = [
  { id: "x", name: "X" },
  { id: "y", name: "Y" },
];

describe("groupByFocus", () => {
  it("groups topics under their focus topic, keeping order and each topic's global index", () => {
    const g = groupByFocus(focusTopics, topics);
    expect(g.map((x) => x.focus.name)).toEqual(["Growth", "Platform"]);
    expect(g[0].topics.map((t) => [t.item.id, t.index])).toEqual([["a", 0], ["b", 1]]);
    expect(g[1].topics.map((t) => [t.item.id, t.index])).toEqual([["c", 2]]);
  });

  it("puts topics without a focus (older sessions) in one group and drops empty focus topics", () => {
    const g = groupByFocus([{ id: "f9", name: "Empty" }], [{ id: "a", name: "A", focusId: null }]);
    expect(g).toHaveLength(1);
    expect(g[0].focus).toEqual({ id: "", name: "Topics" });
    expect(g[0].topics.map((t) => t.item.id)).toEqual(["a"]);
  });
});

describe("groupByFocus with question types", () => {
  it("keeps word clouds (which have no topics) and passes the kind through", () => {
    const g = groupByFocus(
      [
        { id: "w", name: "One word?", kind: "words" },
        { id: "p", name: "Pick", kind: "poll" },
      ],
      [{ id: "o1", name: "Yes", focusId: "p" }],
    );
    expect(g.map((x) => [x.focus.name, x.kind, x.topics.length])).toEqual([
      ["One word?", "words", 0],
      ["Pick", "poll", 1],
    ]);
  });
});

describe("summarizeFocus", () => {
  it("averages every rating in the focus topic and finds its best topic", () => {
    const cells = indexCells([
      { topicId: "a", criterionId: "x", n: 2, sum: 4 }, // A avg 2
      { topicId: "b", criterionId: "x", n: 1, sum: 5 }, // B avg 5
      { topicId: "b", criterionId: "y", n: 1, sum: 3 }, // B overall 4
      { topicId: "c", criterionId: "x", n: 4, sum: 4 },
    ]);
    const [growth] = groupByFocus(focusTopics, topics);
    expect(summarizeFocus(growth, criteria, cells)).toEqual({
      n: 4,
      sum: 12,
      average: 3,
      best: { id: "b", name: "B", average: 4 },
    });
  });

  it("has no average or best topic before any votes", () => {
    const [growth] = groupByFocus(focusTopics, topics);
    expect(summarizeFocus(growth, criteria, new Map())).toEqual({ n: 0, sum: 0, average: null, best: null });
  });
});
