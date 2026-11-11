// Found on the live site at 390px, 2026-11-11: Score items names were squeezed ("Plannin-g") in the Colour grid
// and cut off ("Faster ch…") in Ranking. Names get room and wrap between words instead.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Heatmap } from "@/components/Heatmap";
import { OverallBars } from "@/components/OverallBars";

const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const topics = [{ id: "a", name: "Faster checkout", description: null, focusId: "f" }];
const measures = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Measure ${i + 1}` }));
const grid = (n: number) => html(createElement(Heatmap, { topics, criteria: measures(n), cells: new Map(), scaleMax: 5, flash: {} }));

describe("Colour grid: the name column on a narrow screen", () => {
  it.each([
    [1, "w-[44%]"],
    [2, "w-[38%]"],
    [3, "w-[32%]"],
  ])("with %i measure(s) is %s wide, and 22% once there's room", (n, width) => {
    expect(grid(n)).toContain(`<th scope="col" class="${width} @2xl:w-[22%]"`);
  });

  it("stays 22% when narrow screens get cards instead of the table", () => {
    expect(grid(4)).toContain('<th scope="col" class="w-[22%]"');
  });
});

describe("Ranking: item names", () => {
  it.each(["large", "compact"] as const)("wrap instead of being cut off (%s)", (size) => {
    const out = html(createElement(OverallBars, { data: [{ id: "a", name: "Faster checkout", value: 3, n: 2, index: 0 }], scaleMax: 5, size, ranked: true }));
    expect(out).toMatch(/<span class="(?![^"]*truncate)(?=[^"]*break-words)[^"]*"[^>]*>Faster checkout/);
  });
});
