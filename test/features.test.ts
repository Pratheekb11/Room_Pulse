import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { productFeatures } from "@/lib/features";
import { THEME_IDS } from "@/lib/themes";
import { KIND_INFO } from "@/lib/kinds";
import { TEMPLATES } from "@/lib/templates";
import { GUEST_DAYS } from "@/lib/guest-rules";

describe("what you can do: the feature list on the create page", () => {
  const titles = (ai: boolean) => productFeatures({ ai }).map((f) => f.title);

  it("shows templates, question types, designs, live results, exports and guest mode, with the real numbers", () => {
    const all = productFeatures({ ai: false }).map((f) => `${f.title} ${f.body}`).join(" ");
    expect(all).toContain(`${KIND_INFO.length} kinds of question`);
    expect(all).toContain(`${THEME_IDS.length} slide designs`);
    for (const t of TEMPLATES) expect(all).toContain(t.label);
    expect(all).toMatch(/live/i);
    expect(all).toMatch(/export|spreadsheet/i);
    expect(all).toContain(`${GUEST_DAYS} days`);
  });

  it("tells people about pictures, the PDF report and open points", () => {
    const all = productFeatures({ ai: true }).map((f) => `${f.title} ${f.body}`).join(" ");
    expect(all).toMatch(/pictures/i);
    expect(all).toMatch(/PDF report/);
    expect(all).toMatch(/open points/i);
    expect(all).toMatch(/whole presentation/i);
  });

  it("shows AI only when the site has AI switched on, and says it needs an account", () => {
    expect(titles(false).some((t) => /AI/.test(t))).toBe(false);
    const ai = productFeatures({ ai: true }).find((f) => /AI/.test(f.title))!;
    expect(ai).toBeTruthy();
    expect(ai.tag).toMatch(/account/i);
  });

  it("every line is short and plain", () => {
    for (const f of productFeatures({ ai: true })) {
      expect(f.body.length, f.title).toBeLessThanOrEqual(110);
      expect(`${f.title} ${f.body}`).not.toMatch(/focus topic|criteria|n=/i);
    }
  });
});

describe("where the walkthrough and the feature list show", () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

  it("the feature list is home page material: on the home page, not on the create pages", () => {
    expect(read("app/page.tsx")).toContain("<FeatureList");
    for (const f of ["components/admin/AdminApp.tsx", "components/admin/AuthScreen.tsx", "components/admin/PresentationForm.tsx"]) {
      expect(read(f), f).not.toMatch(/<FeatureList|<BuilderSide|productFeatures/);
    }
  });

  it("the walkthrough never plays by itself on a page: it opens from a 'See how it works' / 'Show me how' button", () => {
    for (const f of ["app/page.tsx", "components/admin/AdminApp.tsx", "components/admin/AuthScreen.tsx"]) expect(read(f), f).not.toContain("<HowToDemo");
    expect(read("app/page.tsx")).toContain("<HowToButton");
    expect(read("components/admin/AuthScreen.tsx")).toContain("<HowToButton");
    expect(read("components/admin/PresentationForm.tsx")).toContain("Show me how");
  });
});
