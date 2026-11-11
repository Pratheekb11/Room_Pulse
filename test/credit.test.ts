// "Built and maintained by Pratheek B" is on the home page only, not on every page.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("the credit line", () => {
  it("is in the home page's footer, linking to GitHub", () => {
    const home = src("app/page.tsx");
    expect(home).toMatch(/<footer[\s\S]*Built and maintained by[\s\S]*https:\/\/github\.com\/Pratheekb11[\s\S]*Pratheek B[\s\S]*<\/footer>/);
  });

  it("is not in the layout shared by every page", () => {
    const layout = src("app/layout.tsx");
    expect(layout).not.toMatch(/Built and maintained|Pratheek|<footer/);
  });
});
