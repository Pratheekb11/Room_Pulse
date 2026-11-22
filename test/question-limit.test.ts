// Up to 30 questions in a presentation (owner, 2026-11-22: 10 was too few for quizzes and event feedback).
// It's a number in the code, not a database rule, so raising it needs no schema change.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planToBody } from "@/lib/templates";
import { createSessionSchema, MAX_FOCUS_TOPICS, MAX_TOPICS_PER_FOCUS } from "@/lib/validation";

const plan = (n: number) => ({
  title: "Big quiz",
  questions: Array.from({ length: n }, (_, i) => ({ kind: "text" as const, name: `Question ${i + 1}?` })),
});

describe("how many questions a presentation can have", () => {
  it("is 30", () => {
    expect(MAX_FOCUS_TOPICS).toBe(30);
  });

  it("the server takes 30 questions and refuses 31", () => {
    expect(createSessionSchema.safeParse(planToBody(plan(30))).success).toBe(true);
    expect(createSessionSchema.safeParse(planToBody(plan(31))).success).toBe(false);
  });

  it("options per question stay at 10", () => {
    expect(MAX_TOPICS_PER_FOCUS).toBe(10);
  });

  it("the builder takes the limit from the same number", () => {
    const form = readFileSync(new URL("../components/admin/PresentationForm.tsx", import.meta.url), "utf8");
    expect(form).toMatch(/max=\{MAX_FOCUS_TOPICS\}/);
    expect(form).toMatch(/focus\.length >= MAX_FOCUS_TOPICS/);
    expect(form).not.toMatch(/\b(focus|list)\.length\s*[<>]=?\s*10\b/);
  });
});

describe("the presenter's question tabs with many questions", () => {
  it("fold into one button past 8 questions on every screen, so rows of tabs never push the results down", async () => {
    const { foldTabs, TAB_LIMIT } = await import("@/components/ScreenChrome");
    expect(TAB_LIMIT).toBe(8);
    expect(foldTabs(8, false)).toBe(false);
    expect(foldTabs(9, false)).toBe(true);
    expect(foldTabs(30, false)).toBe(true);
    // Fit to screen always folds
    expect(foldTabs(2, true)).toBe(true);
  });

  it("the tabs use it", () => {
    const src = readFileSync(new URL("../components/ScreenChrome.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/const folded = foldTabs\(names\.length, compact\)/);
    expect(src).toMatch(/className=\{folded \? "hidden"/);
  });
});
