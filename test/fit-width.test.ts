// Every screen fits its width: nothing needs a sideways scroll, on a phone or a big screen.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Heatmap } from "@/components/Heatmap";
import { Breakdown } from "@/components/Breakdown";
import { ExecSummary } from "@/components/ExecSummary";
import { RankPlaces } from "@/components/results/RankResults";
import { ScoreLegend } from "@/components/Donut";
import { rateItems } from "@/lib/rank-items";
import { indexCells } from "@/lib/stats";

const root = new URL("..", import.meta.url).pathname;
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? files(join(dir, f)) : /\.tsx?$/.test(f) ? [join(dir, f)] : []));

describe("no sideways scrolling anywhere", () => {
  it("no component or page scrolls sideways", () => {
    const offenders = [...files("components"), ...files("app")].filter((f) => /overflow-x-(auto|scroll)/.test(readFileSync(join(root, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("long unbroken words wrap instead of pushing the page wider", () => {
    expect(readFileSync(join(root, "app/globals.css"), "utf8")).toMatch(/body\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  it("but buttons, table headers and numbers only break between words, and numbers never wrap", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toMatch(/button,\s*th,\s*\[role="tab"\],\s*\.tabular-nums\s*\{[^}]*overflow-wrap:\s*break-word/);
    expect(css).toMatch(/\.tabular-nums\s*\{[^}]*white-space:\s*nowrap/);
  });
});

const measures = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Measure ${i + 1}` }));
const items = [
  { id: "a", name: "Dark mode", description: "Night theme" },
  { id: "b", name: "Offline", description: null },
];
const cellsFor = (n: number) => indexCells(items.flatMap((t) => measures(n).map((c) => ({ topicId: t.id, criterionId: c.id, n: 2, sum: 8 }))));

describe("Colour grid", () => {
  it("with many measures, narrow screens get a card per item instead of the wide table", () => {
    const out = html(createElement(Heatmap, { topics: items, criteria: measures(6), cells: cellsFor(6), scaleMax: 5, flash: {} }));
    expect(out).toMatch(/class="@container/);
    expect(out).toMatch(/<table[^>]*class="[^"]*@max-2xl:hidden/);
    expect(out).toMatch(/<ul[^>]*aria-label="Scores per item"[^>]*class="[^"]*@2xl:hidden/);
    expect(out).not.toMatch(/min-w-\[30rem\]/);
  });

  it("with lots of measures, the cards stay until the screen is wide enough for every column", () => {
    const out = html(createElement(Heatmap, { topics: items, criteria: measures(8), cards: undefined, cells: cellsFor(8), scaleMax: 5, flash: {} } as never));
    expect(out).toMatch(/<table[^>]*class="[^"]*@max-5xl:hidden/);
    expect(out).toMatch(/aria-label="Scores per item"[^>]*class="[^"]*@5xl:hidden/);
  });

  it("with a few measures the table fits a phone and is the only view", () => {
    const out = html(createElement(Heatmap, { topics: items, criteria: measures(2), cells: cellsFor(2), scaleMax: 5, flash: {} }));
    expect(out).not.toMatch(/aria-label="Scores per item"/);
    expect(out).not.toMatch(/@max-2xl:hidden/);
  });
});

describe("Score spread", () => {
  it("is one card per row on a phone, more as the screen widens", () => {
    const topics = Array.from({ length: 6 }, (_, i) => ({ item: { id: `t${i}`, name: `T${i}` }, index: i }));
    const out = html(createElement(Breakdown, { topics, criteria: measures(2), cells: new Map(), histograms: new Map(), scaleMax: 5, onOpen: () => {} }));
    expect(out).not.toMatch(/grid-template-columns/);
    expect(out).toMatch(/grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3/);
  });

  it("the score legend wraps", () => {
    expect(html(createElement(ScoreLegend, { scaleMax: 10, lowLabel: "Not at all useful", highLabel: "Extremely useful" }))).toMatch(/^<div class="flex flex-wrap/);
  });
});

describe("Summary table", () => {
  const rowsFor = (n: number) => rateItems(items.map((item, index) => ({ item, index })), measures(n), cellsFor(n), new Map(), 5);
  const summary = (n: number) => html(createElement(ExecSummary, { rows: rowsFor(n), sort: "top", criteria: measures(n), cells: cellsFor(n), scaleMax: 5, voterCount: 2 }));

  it("with many measures, shows each item's measures as chips under it instead of a column each", () => {
    const out = summary(6);
    expect(out).not.toMatch(/<th[^>]*title="Measure 1"/);
    expect(out).toMatch(/aria-label="Scores for Dark mode"/);
  });

  it("with a few, keeps a column per measure where there's room and chips where there isn't", () => {
    const out = summary(2);
    expect(out).toMatch(/<th[^>]*class="[^"]*hidden[^"]*@2xl:table-cell[^"]*"[^>]*title="Measure 1"/);
    expect(out).toMatch(/aria-label="Scores for Dark mode"[^>]*class="[^"]*@2xl:hidden/);
  });
});

describe("Places grid", () => {
  const tally = (places: number) => ({
    rows: [{ id: "a", name: "Speed", index: 0, average: 1, score: 1, places: Array.from({ length: places }, (_, i) => (i === 0 ? 2 : i === places - 1 ? 1 : 0)) }],
    people: 3,
  });

  it("with many places, narrow screens list each option's places as chips", () => {
    const out = html(createElement(RankPlaces, { tally: tally(10) }));
    expect(out).toMatch(/<table[^>]*class="[^"]*@max-2xl:hidden/);
    expect(out).toMatch(/1st · 2/);
    expect(out).toMatch(/10th · 1/);
    expect(out).not.toMatch(/2nd · 0/);
  });

  it("with a few places the table is the only view", () => {
    expect(html(createElement(RankPlaces, { tally: tally(3) }))).not.toMatch(/@max-2xl:hidden/);
  });
});

describe("Open answers one at a time", () => {
  it("the big quote is never wider than its card", () => {
    const src = readFileSync(join(root, "components/results/TextResults.tsx"), "utf8");
    expect(src).not.toMatch(/max-w-\[30ch\]/);
    expect(src).toMatch(/max-w-\[min\(30ch,100%\)\]/);
  });
});

describe("big screen header and question tabs", () => {
  it("a long title keeps a readable width: the controls move under it instead of squeezing it", async () => {
    const { ScreenHeader } = await import("@/components/ScreenChrome");
    const out = html(createElement(ScreenHeader, { title: "T", theme: "paper", decor: false, status: null, controls: null }));
    expect(out).toMatch(/<header[^>]*class="[^"]*flex-wrap/);
    expect(out).toMatch(/<header[^>]*><div class="[^"]*flex-\[1_1_min\(100%,34rem\)\]/);
  });

  it("each question tab shows up to about 24 characters, the full name on hover and in the list", async () => {
    const { QuestionTabs } = await import("@/components/ScreenChrome");
    const name = "Score every idea — a much longer question title that keeps going";
    const out = html(createElement(QuestionTabs, { names: [{ key: "a", name }], active: 0, onPick: () => {} }));
    expect(out).toMatch(new RegExp(`<button[^>]*title="${name}"[^>]*class="[^"]*max-w-\\[26ch\\]`));
    expect(out).toMatch(/<span class="truncate">Score every idea/);
  });
});

describe("Columns chart", () => {
  it("with many options a narrow screen shows bars instead of crushed columns", async () => {
    const { PollColumns } = await import("@/components/PollResults");
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, name: `Option ${i + 1}`, index: i, n: 1, pct: 10 }));
    const many = html(createElement(PollColumns, { tally: { rows: rows(8), total: 8, leader: null } as never }));
    expect(many).toMatch(/class="@container/);
    expect(many).toMatch(/role="img"[^>]*class="[^"]*@max-3xl:hidden|class="[^"]*@max-3xl:hidden[^"]*"[^>]*role="img"/);
    expect(many).toMatch(/class="@3xl:hidden"/);
    const few = html(createElement(PollColumns, { tally: { rows: rows(4), total: 4, leader: null } as never }));
    expect(few).not.toMatch(/@max-3xl:hidden/);
    // 6+ columns on a wide screen: smaller labels so a word like "Choice" fits its column
    expect(many).toMatch(/text-\[clamp\(0\.75rem,0\.85vw,1\.05rem\)\] font-bold break-words/);
  });
});

describe("rows of controls and pills wrap rather than squeeze", () => {
  const src = (f: string) => readFileSync(join(root, f), "utf8");
  it("One at a time: ← 1 / 8 → Pause Hide wrap onto a second line on a phone", () => {
    expect(src("components/results/TextResults.tsx")).toMatch(/<div className="flex flex-wrap items-center justify-center gap-3">\s*<button type="button" className=\{btn\} onClick=\{\(\) => setI/);
  });
  it("Summary: the agreement pill breaks only between its words", () => {
    expect(src("components/ExecSummary.tsx")).toMatch(/inline-block rounded-xl px-2\.5 py-0\.5[^"]*\[overflow-wrap:break-word\]/);
  });
});

describe("Item close-up", () => {
  it("each measure's chart gets a full row on a phone and shares rows as the screen widens", () => {
    const src = readFileSync(join(root, "components/TopicDistribution.tsx"), "utf8");
    expect(src).not.toMatch(/gridTemplateColumns: `repeat\(\$\{cols\}/);
    expect(src).toMatch(/grid-cols-1\$\{n > 1 \? " @md:grid-cols-2" : ""\}/);
  });
});
