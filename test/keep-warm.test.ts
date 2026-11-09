// Keep-warm ping (GitHub Actions): the database stays awake on weekdays 9:00–19:00 IST, and only then,
// so Neon's free 100 compute-hours a month aren't used up.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = new URL("../.github/workflows/keep-warm.yml", import.meta.url);
const yml = () => readFileSync(path, "utf8");

describe("keep-warm workflow", () => {
  it("exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("starts a run every hour from 9:00 to 18:00 IST (03:30–12:30 UTC), Monday to Friday", () => {
    expect(yml()).toMatch(/cron:\s*"30 3-12 \* \* 1-5"/);
  });

  it("pings /api/warm more often than Neon's 5-minute sleep, for just under an hour per run", () => {
    const y = yml();
    expect(y).toMatch(/\/api\/warm/);
    const sleep = Number(y.match(/sleep (\d+)/)?.[1]);
    expect(sleep).toBeLessThan(300);
    const pings = Number(y.match(/seq 1 (\d+)/)?.[1]);
    // first to last ping: close enough to the next hourly run that the database never sleeps in between
    const span = (pings - 1) * sleep;
    expect(60 * 60 - span).toBeLessThan(5 * 60);
    expect(span).toBeLessThan(60 * 60);
  });

  it("never runs two at once, and can be started by hand", () => {
    expect(yml()).toMatch(/concurrency:\s*\n\s*group: keep-warm/);
    expect(yml()).toMatch(/workflow_dispatch:/);
  });

  it("the ping only runs `select 1`, so it costs no data and needs no secret", () => {
    const route = readFileSync(new URL("../app/api/warm/route.ts", import.meta.url), "utf8");
    expect(route).toMatch(/select 1/);
    expect(yml()).not.toMatch(/secrets\./);
  });
});
