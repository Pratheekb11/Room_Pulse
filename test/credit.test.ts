// "Built and maintained by Pratheek B": on the home page, and one quiet line at the bottom of the thank-you screen. Nowhere else.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Credit } from "@/components/Credit";

const root = new URL("../", import.meta.url).pathname;
const src = (path: string) => readFileSync(root + path, "utf8");
const files = (dir: string): string[] =>
  readdirSync(root + dir).flatMap((f) => (statSync(`${root}${dir}/${f}`).isDirectory() ? files(`${dir}/${f}`) : f.endsWith(".tsx") ? [`${dir}/${f}`] : []));

describe("the credit line", () => {
  it("names Pratheek B and links to GitHub in a new tab", () => {
    const out = renderToStaticMarkup(createElement(Credit));
    expect(out.replace(/<[^>]+>/g, "")).toBe("Built and maintained by Pratheek B");
    expect(out).toMatch(/href="https:\/\/github\.com\/Pratheekb11"[^>]*rel="noopener noreferrer"[^>]*target="_blank"/);
  });

  it("the quiet one is small and grey, the name not bold", () => {
    const out = renderToStaticMarkup(createElement(Credit, { subtle: true }));
    expect(out).toMatch(/<p class="[^"]*text-xs[^"]*text-muted/);
    expect(out).not.toMatch(/font-semibold|font-bold|text-ink\b/);
  });

  it("is in the home page's footer", () => {
    expect(src("app/page.tsx")).toMatch(/<footer[\s\S]*<Credit \/>[\s\S]*<\/footer>/);
  });

  it("is at the bottom of the thank-you screen, after everything else, in its quiet form", () => {
    const thanks = src("components/VoteApp.tsx").split("function ThankYou(")[1];
    expect(thanks).toMatch(/All saved[\s\S]*<Credit subtle \/>\s*<\/main>/);
  });

  it("is nowhere else: not in the shared layout or any other screen", () => {
    const users = [...files("app"), ...files("components")].filter((f) => /<Credit\b|Built and maintained|Pratheek/.test(src(f)));
    expect(users.sort()).toEqual(["app/page.tsx", "components/Credit.tsx", "components/VoteApp.tsx"]);
    expect(src("components/VoteApp.tsx").match(/<Credit\b/g)).toHaveLength(1);
  });
});
