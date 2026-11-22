// Owner, 2026-11-22 (phone): on the home page the activities folded under "See all 14" showed only a name, and
// tapping any activity did nothing. Every activity now shows its length and line, and opens the builder with it.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityList } from "@/components/home/ActivityList";
import { ACTIVITIES } from "@/lib/activities";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const items = ACTIVITIES.map((a) => ({ id: a.id, label: a.label, blurb: a.blurb, minutes: a.minutes }));

describe("the home page's team activities", () => {
  const html = renderToStaticMarkup(createElement(ActivityList, { items }));

  it("every activity, folded or not, shows its length and its line", () => {
    const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
    // as text on the page, not just a tooltip
    for (const a of ACTIVITIES) expect(html, a.label).toContain(`>${esc(a.blurb)}<`);
    expect(html.match(/\d+ min</g)?.length).toBe(ACTIVITIES.length);
  });

  it("every activity is a link that opens the builder with it", () => {
    for (const a of ACTIVITIES) expect(html, a.label).toContain(`href="/admin?activity=${a.id}"`);
  });

  it("the builder starts from the activity in the link", () => {
    const page = read("app/admin/page.tsx");
    expect(page).toMatch(/searchParams/);
    expect(page).toMatch(/startActivity=/);
    const admin = read("components/admin/AdminApp.tsx");
    // the form opens even for someone who already has presentations
    expect(admin).toMatch(/useState\(Boolean\(startActivity\)\)/);
    expect(admin).toMatch(/startActivity=\{startActivity\}/);
    const form = read("components/admin/PresentationForm.tsx");
    expect(form).toMatch(/startActivity[\s\S]{0,400}applyPlan\(a\.plan/);
  });
});
