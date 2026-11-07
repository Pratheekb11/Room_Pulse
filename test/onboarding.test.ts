import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS, type DemoStep } from "@/lib/walkthrough";
import { KIND_INFO } from "@/lib/kinds";
import { MAX_STEP_DOTS, showStepDots } from "@/lib/progress";
import { scoringHost } from "@/lib/scoring";

describe("walkthrough demos: a short click-through of making a question", () => {
  it("covers Score items, Pick one, Word cloud and Quiz, named as the builder names them", () => {
    expect(DEMOS.map((d) => d.kind)).toEqual(["rating", "poll", "words", "quiz"]);
    for (const d of DEMOS) expect(d.label).toBe(KIND_INFO.find((k) => k.id === d.kind)!.label);
  });

  for (const demo of DEMOS) {
    describe(demo.label, () => {
      const steps: DemoStep[] = demo.steps;

      it("is short: 5 to 10 steps, each with a plain one-line caption", () => {
        expect(steps.length).toBeGreaterThanOrEqual(5);
        expect(steps.length).toBeLessThanOrEqual(10);
        for (const s of steps) {
          expect(s.caption.length, s.caption).toBeGreaterThan(5);
          expect(s.caption.length, s.caption).toBeLessThanOrEqual(80);
          expect(s.caption).not.toMatch(/focus topic|criteria|n=/i);
        }
      });

      it("starts in the builder, never goes back to it, shows a phone answering, and ends on the results", () => {
        const order = steps.map((s) => s.state.screen).filter((x, i, a) => a[i - 1] !== x);
        expect(order[0]).toBe("builder");
        expect(order.lastIndexOf("builder")).toBe(0);
        expect(order).toContain("phone");
        expect(order[order.length - 1]).toBe("results");
      });

      it("starts by picking the question type, and keeps that type afterwards", () => {
        expect(steps[0].target).toBe("kind");
        expect(steps[0].state.kind).toBe(demo.kind);
        for (const s of steps) expect(s.state.kind).toBe(demo.kind);
      });

      it("types a question, then creates the presentation from the builder", () => {
        expect(steps.some((s) => s.target === "question" && s.state.question.length > 5)).toBe(true);
        const create = steps.findIndex((s) => s.target === "create");
        expect(create).toBeGreaterThan(0);
        expect(steps[create - 1].state.screen).toBe("builder");
      });

      it("the phone answer is one of the options (or a typed word)", () => {
        const answered = steps.find((s) => s.state.screen === "phone" && s.state.picked);
        expect(answered).toBeTruthy();
        if (demo.kind !== "words") expect(answered!.state.items).toContain(answered!.state.picked);
      });

      it("results have one number per option", () => {
        const last = steps[steps.length - 1].state;
        expect(last.results.length).toBe(last.items.length);
        expect(last.results.every((n) => n >= 0)).toBe(true);
      });
    });
  }

  it("Score items shows how to change the scale from 1–5 to 1–10", () => {
    const steps = DEMOS[0].steps;
    const scale = steps.find((s) => s.target === "scale")!;
    expect(scale).toBeTruthy();
    expect(scale.state.scale).toBe(10);
    expect(scale.caption).toMatch(/1 to 10/);
    expect(steps[0].state.scale).toBe(5);
  });

  it("Quiz shows how to mark the right answer and start the question", () => {
    const steps = DEMOS[3].steps;
    const right = steps.find((s) => s.target === "correct")!;
    expect(right.state.items).toContain(right.state.correct);
    expect(steps.some((s) => s.target === "start" && s.state.screen === "results")).toBe(true);
  });
});

describe("phone progress dots fit on a 390px screen", () => {
  it("shows dots up to 8 steps, then a '3 / 10' count", () => {
    expect(MAX_STEP_DOTS).toBe(8);
    expect(showStepDots(8)).toBe(true);
    expect(showStepDots(9)).toBe(false);
    expect(showStepDots(10)).toBe(false);
  });
});

describe("builder: the 1–5 / 1–10 setting sits with the Score items question", () => {
  it("is shown in the first Score items question", () => {
    expect(scoringHost([{ key: 1, kind: "poll" }, { key: 2, kind: "rating" }, { key: 3, kind: "rating" }])).toBe(2);
  });
  it("no Score items question, no scoring settings", () => {
    expect(scoringHost([{ key: 1, kind: "poll" }])).toBeNull();
  });
});

describe("home page: start as a guest is the headline, before joining with a code", () => {
  const src = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  it("says plainly you can start without signing up", () => {
    expect(src).toMatch(/No sign-up/i);
    expect(src).toMatch(/guest/i);
  });

  it("puts 'Create a presentation' above the join box in the hero", () => {
    const hero = src.slice(src.indexOf("<h1"), src.indexOf("</section>"));
    expect(hero.indexOf("Create a presentation")).toBeGreaterThan(-1);
    expect(hero.indexOf("Create a presentation")).toBeLessThan(hero.indexOf("<JoinForm"));
  });

  it("lists all 9 question types (the walkthrough moved to the create page)", () => {
    expect(src).not.toMatch(/Three kinds of question/);
    expect(src).toContain("KIND_INFO");
  });
});
