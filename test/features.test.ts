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

describe("the walkthrough lives on the create page", () => {
  it("is on the create page (sign-in and builder), not the home page", () => {
    expect(readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8")).not.toContain("<HowToDemo");
    expect(readFileSync(new URL("../components/admin/BuilderSide.tsx", import.meta.url), "utf8")).toContain("<HowToDemo");
    expect(readFileSync(new URL("../components/admin/AdminApp.tsx", import.meta.url), "utf8")).toContain("<BuilderSide");
    expect(readFileSync(new URL("../components/admin/AuthScreen.tsx", import.meta.url), "utf8")).toContain("<BuilderSide");
  });
});
