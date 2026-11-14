// Fit to screen: the results are scaled so one question's whole card shows without scrolling.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIT_MIN_SCALE, fitScale } from "@/lib/fit";

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

describe("Fit to screen on the results screen", () => {
  const dashboard = read("components/DashboardApp.tsx");

  it("is a presenter control with a keyboard shortcut, off on voters' phones", () => {
    expect(dashboard).toContain("Fit to screen");
    expect(dashboard).toMatch(/<FitToScreen\b/);
    expect(dashboard).toMatch(/!audience && \(\s*<button[^>]*\n?[^>]*aria-pressed=\{fit\}/);
    expect(dashboard).toMatch(/key\.toLowerCase\(\) === "f"/);
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
