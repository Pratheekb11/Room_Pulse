// The large average bars (Score items "Average" / ranking view) fit a 320px phone: found in the
// 2026-11-28 sweep, where rank, name, bar, average and a "12 votes" column overflowed 320 and 360px.
// The votes get their own column only once the list is wide enough; narrower, they sit under the name.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverallBars, type BarDatum } from "@/components/OverallBars";

const data: BarDatum[] = [
  { id: "a", name: "Speed", value: 4.2, n: 12, index: 0 },
  { id: "b", name: "Quality", value: 3.1, n: 1, index: 1 },
];
const html = (size: "large" | "compact") => renderToStaticMarkup(createElement(OverallBars, { data, scaleMax: 5, size, ranked: true }));
const spans = (out: string, words: string) => [...out.matchAll(/<span class="([^"]*)"[^>]*>([^<]*)<\/span>/g)].filter((m) => m[2].trim() === words);

describe("large average bars on a narrow screen", () => {
  it("measure their own width (a container), not the window's", () => {
    expect(html("large")).toMatch(/<ol class="[^"]*@container/);
  });

  it("show the votes column only when the list is wide enough", () => {
    const column = spans(html("large"), "12 votes").filter((m) => /\bshrink-0\b/.test(m[1]));
    expect(column).toHaveLength(1);
    expect(column[0][1]).toMatch(/(^|\s)hidden(\s|$)/);
    expect(column[0][1]).toMatch(/@md:block/);
  });

  it("put the votes under the name when it's narrow", () => {
    const under = spans(html("large"), "12 votes").filter((m) => !/\bshrink-0\b/.test(m[1]));
    expect(under).toHaveLength(1);
    expect(under[0][1]).toMatch(/@md:hidden/);
    expect(spans(html("large"), "1 vote")).toHaveLength(2);
  });

  it("leave the compact bars alone (no votes shown)", () => {
    expect(html("compact")).not.toMatch(/votes?</);
  });
});
