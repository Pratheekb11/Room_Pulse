// Fit to screen: the results are scaled so one question's whole card shows without scrolling.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIT_MIN_SCALE, fitScale, fitWithFlex } from "@/lib/fit";
import { fitSceneSize, SCENE_FIT_MIN } from "@/lib/boards";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("fitScale", () => {
  it("leaves results that already fit at full size", () => {
    const fit = fitScale(1000, 600, () => 500);
    expect(fit).toEqual({ scale: 1, width: 1000, height: 500, fits: true });
  });

  it("shrinks a tall fixed-height page until it fits", () => {
    // the height doesn't depend on the width: 1200px must become 600px
    const fit = fitScale(1000, 600, () => 1200);
    expect(fit.fits).toBe(true);
    expect(fit.scale).toBeLessThanOrEqual(0.5);
    expect(fit.scale).toBeGreaterThan(0.48);
    expect(fit.height * fit.scale).toBeLessThanOrEqual(600);
  });

  it("lays the page out wider as it shrinks, so the full width of the screen is used", () => {
    const fit = fitScale(1000, 600, () => 1200);
    expect(fit.width * fit.scale).toBeCloseTo(1000, 5);
    expect(fit.width).toBeGreaterThan(1900);
  });

  it("needs less shrinking when a wider layout is shorter (items flow into more columns)", () => {
    // an area of 900,000 square pixels: at 1000px wide it is 900px tall, at 1225px it is ~735px
    const area = (width: number) => 900_000 / width;
    const fit = fitScale(1000, 600, area);
    expect(fit.fits).toBe(true);
    // a fixed 900px page would need 0.67; reflowing gets away with ~0.82
    expect(fit.scale).toBeGreaterThan(0.8);
    expect(fit.height * fit.scale).toBeLessThanOrEqual(600);
  });

  it("picks the largest scale that fits, to within a few pixels", () => {
    const fit = fitScale(1000, 600, () => 1000);
    expect(600 - fit.height * fit.scale).toBeLessThan(8);
  });

  it("stops at the smallest readable size and says the page still doesn't fit", () => {
    const fit = fitScale(1000, 600, () => 10_000);
    expect(fit.scale).toBe(FIT_MIN_SCALE);
    expect(fit.fits).toBe(false);
    expect(fit.width).toBeCloseTo(1000 / FIT_MIN_SCALE, 5);
  });

  it("never scales up, and copes with a screen of no size", () => {
    expect(fitScale(1000, 600, () => 100).scale).toBe(1);
    expect(fitScale(0, 0, () => 100)).toEqual({ scale: 1, width: 0, height: 100, fits: true });
  });
});

// A board (tree, night sky) can be any height, so Fit to screen gives it the room that's left
// instead of the board and the fit each resizing after the other (they never settled: the picture
// flickered between two sizes).
describe("fitWithFlex: a page with one piece that takes the room that's left", () => {
  // 200px of other things; the piece may be as tall as 0.5 × the page's width
  const page = (rest: number) => (width: number) => ({ rest, cap: width / 2 });

  it("stays at full size and gives the piece exactly the room that's left", () => {
    const fit = fitWithFlex(1000, 600, page(200), 160);
    expect(fit.scale).toBe(1);
    expect(fit.flex).toBe(400);
    expect(fit.height).toBe(600);
    expect(fit.fits).toBe(true);
  });

  it("never makes the piece taller than it may be", () => {
    const fit = fitWithFlex(600, 900, page(200), 160);
    expect(fit.scale).toBe(1);
    expect(fit.flex).toBe(300);
    expect(fit.height).toBe(500);
  });

  it("shrinks the page only when the piece at its smallest still doesn't fit, then fills the screen", () => {
    const fit = fitWithFlex(1000, 400, page(340), 160);
    expect(fit.scale).toBeLessThan(1);
    expect(fit.scale).toBeGreaterThan(0.75);
    expect(fit.flex).toBeGreaterThanOrEqual(160);
    expect(fit.fits).toBe(true);
    // all of it shows, and nearly none of the screen is left empty
    expect(fit.height * fit.scale).toBeLessThanOrEqual(400.5);
    expect(400 - fit.height * fit.scale).toBeLessThan(8);
  });

  it("uses a smaller smallest size when the piece can't be that tall anyway", () => {
    const fit = fitWithFlex(200, 600, page(100), 160);
    expect(fit.flex).toBe(100);
  });

  it("gives the same answer however often it's asked, whatever size the piece was before", () => {
    // the piece's own height is never read back, so there's nothing to chase
    for (const [w, h, rest] of [[1024, 544, 330], [1366, 633, 280], [1920, 950, 240], [700, 300, 900]]) {
      const a = fitWithFlex(w, h, page(rest), 160);
      const b = fitWithFlex(w, h, page(rest), 160);
      expect(b).toEqual(a);
      expect(a.flex).toBeLessThanOrEqual(a.width / 2 + 0.001);
    }
  });

  it("stops at the smallest readable size when the rest alone is too tall", () => {
    const fit = fitWithFlex(1000, 400, page(5000), 160);
    expect(fit.scale).toBe(FIT_MIN_SCALE);
    expect(fit.fits).toBe(false);
    expect(fit.flex).toBe(160);
  });
});

describe("fitSceneSize: the tree or sky inside the box Fit to screen gives it", () => {
  it("fills the box's height when the box is wide enough, keeping its shape", () => {
    expect(fitSceneSize(1000, 300)).toEqual({ w: 480, h: 300, ratio: 1.6 });
  });

  it("is never wider than the box", () => {
    const s = fitSceneSize(800, 900);
    expect(s.w).toBeLessThanOrEqual(800);
    expect(s.h).toBe(500);
  });

  it("is tall on a narrow screen, like the board without Fit to screen", () => {
    expect(fitSceneSize(340, 300).ratio).toBeLessThan(1);
  });

  it("has a smallest height that can still be read", () => {
    expect(SCENE_FIT_MIN).toBeGreaterThanOrEqual(160);
    expect(SCENE_FIT_MIN).toBeLessThanOrEqual(260);
  });
});

describe("Fit to screen and a board don't resize each other", () => {
  const fit = read("components/FitToScreen.tsx");
  const board = read("components/results/BoardView.tsx");

  it("Fit to screen sizes the board's box itself", () => {
    expect(fit).toContain("fitWithFlex(");
    expect(fit).toContain("[data-fit-flex]");
    expect(fit).toMatch(/export function useFit\b/);
  });

  it("the board draws inside that box and doesn't measure the screen while Fit to screen is on", () => {
    expect(board).toContain("useFit()");
    expect(board).toContain("data-fit-flex");
    expect(board).toContain("fitSceneSize(");
    // the screen is only measured when Fit to screen is off
    expect(board).toMatch(/if \(fit\.on\) return;[\s\S]{0,400}window\.innerHeight|window\.innerHeight[\s\S]{0,600}fit\.on/);
  });
});

describe("Fit to screen on the results screen", () => {
  const dashboard = read("components/DashboardApp.tsx");

  it("is a presenter control with a keyboard shortcut, off on voters' phones", () => {
    expect(dashboard).toContain("Fit to screen");
    expect(dashboard).toMatch(/<FitToScreen\b/);
    // in the presenter's More menu (voters' phones get no More menu), ticked while it's on
    expect(dashboard).toMatch(/audience \? \([\s\S]*?\) : \(\s*<MoreMenu>\s*<button[\s\S]{0,80}role="menuitemcheckbox"\s*aria-checked=\{fit\}/);
    expect(dashboard).toMatch(/key\.toLowerCase\(\) === "f"/);
  });

  it("makes room while it's on: a smaller title without the illustration, and the question tabs as one button", () => {
    expect(dashboard).toMatch(/<ScreenHeader\b[^>]*\bcompact=\{fit\}/);
    expect(dashboard).toMatch(/<QuestionTabs\b[^>]*\bcompact=\{fit\}/);
    const chrome = read("components/ScreenChrome.tsx");
    expect(chrome).toMatch(/compact \? /);
    expect(chrome).toMatch(/decor && !compact/);
  });

  it("is remembered on this device", () => {
    expect(dashboard).toContain("liverate:fit");
  });

  it("scales with a transform inside a clipped box, measured by fitScale", () => {
    const fit = read("components/FitToScreen.tsx");
    expect(fit).toContain("fitScale(");
    expect(fit).toContain("ResizeObserver");
    expect(fit).toMatch(/scale\(/);
  });
});
