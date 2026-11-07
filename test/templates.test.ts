import { describe, expect, it } from "vitest";
import { TEMPLATES, planToBody } from "@/lib/templates";
import { createSessionSchema } from "@/lib/validation";

describe("presentation templates", () => {
  it("covers retros, standups, meetups and event feedback", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["retro", "standup", "icebreaker", "feedback"]);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s is a presentation the server accepts", (_id, t) => {
    const parsed = createSessionSchema.safeParse(planToBody(t.plan));
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("starts a retro with a mood check and ends with what to try next", () => {
    const retro = TEMPLATES.find((t) => t.id === "retro")!.plan;
    expect(retro.questions[0].kind).toBe("poll");
    expect(retro.questions.at(-1)).toMatchObject({ kind: "text" });
  });
});
