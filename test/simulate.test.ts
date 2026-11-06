import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as voteRoute from "@/app/api/vote/route";
import * as answerRoute from "@/app/api/answer/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import type { ResultsPayload } from "@/lib/types";
import { simulate } from "../scripts/simulate.mjs";

const CHECK_SQL = readFileSync(new URL("../db/check.sql", import.meta.url), "utf8");
let db: PGlite;

/** Routes simulator HTTP calls straight to the route handlers; every 7th vote gets a 503 first. */
function inProcessFetch() {
  let n = 0;
  return async (input: string, init?: RequestInit) => {
    const u = new URL(input);
    const req = new Request(u, init);
    const m = u.pathname.match(/^\/api\/session\/([^/]+)$/);
    if (m) return sessionRoute.GET(req, { params: Promise.resolve({ code: m[1] }) });
    if (u.pathname === "/api/vote" || u.pathname === "/api/answer") {
      if (++n % 7 === 0) return new Response('{"error":"unavailable"}', { status: 503 });
      return u.pathname === "/api/vote" ? voteRoute.POST(req) : answerRoute.POST(req);
    }
    return new Response("not found", { status: 404 });
  };
}

beforeAll(async () => {
  db = await startTestDb();
});

describe("scripts/simulate.mjs", () => {
  it("rates every cell for every fake voter, retries 503s, and totals stay exact", async () => {
    const res = await adminSessions.POST(
      new Request(`${ORIGIN}/api/admin/sessions`, {
        method: "POST",
        headers: { cookie: (await signUp("sim@example.com")).cookie!, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ title: "Sim", focusTopics: [
          { name: "One", topics: ["A", "B"] },
          { name: "Two", topics: ["C"] },
          { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
          { name: "One word", kind: "words" },
        ], criteria: ["X", "Y"] }),
      }),
    );
    const { code, dashboardKey } = (await res.json()) as { code: string; dashboardKey: string };

    const summary = await simulate({
      baseUrl: "http://sim.test",
      code,
      voters: 12,
      concurrency: 4,
      fetch: inProcessFetch() as unknown as typeof fetch,
      minDelayMs: 0,
      maxDelayMs: 0,
      retryBaseMs: 0,
      log: () => {},
    });

    expect(summary.failures).toBe(0);
    expect(summary.retries).toBeGreaterThan(0);
    // 12 voters × 6 cells, plus ~20% of voters changing one rating
    expect(summary.requests).toBeGreaterThanOrEqual(72);
    expect(summary.changed).toBeGreaterThanOrEqual(1);

    const results = (await (
      await resultsRoute.GET(new Request("http://x", { headers: { "x-dashboard-key": dashboardKey } }), { params: Promise.resolve({ code }) })
    ).json()) as ResultsPayload;
    expect(results.voterCount).toBe(12);
    expect(results.cells).toHaveLength(6);
    for (const c of results.cells) expect(c.n).toBe(12);
    expect((await db.query(CHECK_SQL)).rows).toEqual([]);

    // Every poll and word answer arrived: one poll choice per voter, all words counted.
    expect(results.polls.reduce((t, p) => t + p.n, 0)).toBe(12);
    expect(results.words.reduce((t, w) => t + w.n, 0)).toBe(summary.wordsSent);
    expect(summary.wordsSent).toBeGreaterThanOrEqual(12);
  });
});
