import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS, frameFit } from "@/lib/walkthrough";

// "See how it works" showed a hand-drawn builder, phone and results screen that stopped matching the app when
// the slide editor came (2026-11-22): type chips instead of the type tiles, no start screen, no "Scored 1 to 5 ·
// Change". Now it draws the app's own pieces, so it changes when they change.
const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const missing = (code: string, names: string[]) => names.filter((n) => !new RegExp(`<${n}[\\s>]`).test(code));

describe("See how it works draws the real screens", () => {
  const demo = src("components/HowToDemo.tsx");

  it("builder: the real start choices, type picker and question editor", () => {
    expect(missing(src("components/admin/PresentationForm.tsx"), ["StartChoices", "TypePicker", "QuestionEditor"])).toEqual([]);
    expect(missing(demo, ["StartChoices", "TypePicker", "QuestionEditor"])).toEqual([]);
  });

  it("phone: the voter page's header, progress and the real answer cards", () => {
    expect(missing(demo, ["VoterHeader", "VoterProgress", "StepIntro", "TopicCard", "PollCard", "WordsCard", "QuizCard", "StepNav"])).toEqual([]);
  });

  it("big screen: the results page's header, card and charts, and the quiz stage with its leaderboard", () => {
    expect(missing(demo, ["ScreenHeader", "VotingPills", "ResultCard", "OverallBars", "PollBars", "WordCloud", "QuizStage", "Leaderboard"])).toEqual([]);
  });

  it("no hand-drawn copies of the old builder (type chips, 'Question 1' heading)", () => {
    expect(demo).not.toContain("BUILDER_KINDS");
    expect(demo).not.toMatch(/>\s*Question 1\s*</);
  });

  // Found on production (2026-11-28): scale and pan shared one eased transform, so each new screen started life-size
  // and shrank for half a second, cut off at the right meanwhile. Only the camera's pan may ease.
  it("a new screen appears at its size at once: the scale never eases, only the pan does", () => {
    const scaleLine = demo.split("\n").find((l) => l.includes("scale(${fit.scale})"))!;
    expect(scaleLine).not.toContain("translateY");
    const scaled = demo.slice(demo.lastIndexOf("<div", demo.indexOf("scale(${fit.scale})")), demo.indexOf("scale(${fit.scale})"));
    expect(scaled).not.toMatch(/transition/);
    expect(demo).toMatch(/transition-transform[\s\S]{0,200}translateY\(\$\{-fit\.pan\}px\)|translateY\(\$\{-\(fit\?\.pan/);
  });

  it("the drawn screens can't be tabbed into or tapped: they're a picture", () => {
    expect(demo).toMatch(/\binert\b/);
    expect(demo).toMatch(/aria-hidden/);
  });

  it("the home page loads the walkthrough only when it's opened (it now carries the builder's code)", () => {
    const button = src("components/HowToButton.tsx");
    expect(button).toMatch(/dynamic\(/);
    expect(button).not.toMatch(/^import \{ HowToDialog \}/m);
  });
});

describe("the demo follows the builder's real steps", () => {
  for (const demo of DEMOS) {
    it(`${demo.label}: Write your own, then the type, then the question`, () => {
      expect(demo.steps[0].target).toBe("blank");
      expect(demo.steps[0].state.screen).toBe("types");
      expect(demo.steps[1].target).toBe("kind");
      expect(demo.steps[1].state.screen).toBe("builder");
      expect(demo.steps[2].target).toBe("question");
    });
  }

  it("Score items: the scale is changed where the builder has it (Change, then 1 to 10)", () => {
    const scale = DEMOS[0].steps.find((s) => s.target === "scale")!;
    expect(scale.caption).toMatch(/Change/);
    expect(scale.caption).toMatch(/1 to 10/);
  });
});

describe("frameFit: each drawn screen scales to the box it's shown in", () => {
  it("never draws bigger than life, and shrinks to the box's width", () => {
    expect(frameFit({ boxW: 900, boxH: 400, width: 560, contentH: 300 }).scale).toBe(1);
    expect(frameFit({ boxW: 280, boxH: 400, width: 560, contentH: 300 }).scale).toBe(0.5);
  });

  it("with a height (a phone), fits both ways", () => {
    const f = frameFit({ boxW: 600, boxH: 380, width: 380, height: 760, contentH: 900 });
    expect(f.scale).toBe(0.5);
    expect(f.viewH).toBe(760);
  });

  it("taller than the box: pans so the cursor's target is in view, never past either end", () => {
    const base = { boxW: 560, boxH: 400, width: 560, contentH: 1200 };
    expect(frameFit(base).pan).toBe(0);
    const mid = frameFit({ ...base, target: { top: 700, bottom: 740 } });
    expect(mid.pan).toBeGreaterThan(0);
    expect(700 - mid.pan).toBeGreaterThanOrEqual(0);
    expect(740 - mid.pan).toBeLessThanOrEqual(400);
    expect(frameFit({ ...base, target: { top: 1180, bottom: 1200 } }).pan).toBe(800);
    expect(frameFit({ ...base, target: { top: 10, bottom: 40 } }).pan).toBe(0);
  });

  it("whole: a big screen shrinks until all of it shows (a picture of the room's screen), no panning", () => {
    const f = frameFit({ boxW: 600, boxH: 380, width: 1040, contentH: 900, whole: true });
    expect(f.scale).toBeCloseTo(380 / 900);
    expect(f.pan).toBe(0);
    expect(900 * f.scale).toBeLessThanOrEqual(380);
    expect(frameFit({ boxW: 600, boxH: 380, width: 1040, contentH: 650, whole: true }).scale).toBeCloseTo(600 / 1040);
  });

  it("fits a 320px phone and a wide dialog without sideways overflow", () => {
    for (const boxW of [262, 300, 340, 600, 640]) {
      const f = frameFit({ boxW, boxH: 380, width: 560, contentH: 700 });
      expect(560 * f.scale).toBeLessThanOrEqual(boxW + 0.01);
    }
  });
});
