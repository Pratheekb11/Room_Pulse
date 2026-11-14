import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { failNextFetches, startTestDb, truncateAll } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";

import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import * as voteRoute from "@/app/api/vote/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as recalcRoute from "@/app/api/admin/sessions/[code]/recalculate/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

let cookie = "";
const CHECK_SQL = readFileSync(new URL("../db/check.sql", import.meta.url), "utf8");

let db: PGlite;

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const admin = (init: RequestInit = {}) => ({
  ...init,
  headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const url = (path: string) => `http://localhost${path}`;

async function createSession(body: Record<string, unknown>) {
  const res = await adminSessions.POST(new Request(url("/api/admin/sessions"), admin({ method: "POST", body: JSON.stringify(body) })));
  return res;
}

async function demo(topics = ["A", "B"], criteria = ["Impact", "Feasibility"], scaleMax = 5) {
  const res = await createSession({ title: "Demo", scaleMax, focusTopics: [{ name: "Focus", topics }], criteria });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const info = (await (await sessionRoute.GET(new Request(url(`/api/session/${code}`)), ctx(code))).json()) as SessionPayload;
  return { code, info };
}

function vote(body: Record<string, unknown>) {
  return voteRoute.POST(new Request(url("/api/vote"), { method: "POST", body: JSON.stringify(body) }));
}

async function results(code: string) {
  const res = await resultsRoute.GET(new Request(url(`/api/results/${code}`), admin()), ctx(code));
  return { res, body: (await res.json()) as ResultsPayload };
}

const voter = () => crypto.randomUUID();

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("presenter@example.com")).cookie!;
});

beforeEach(async () => {
  await truncateAll(db);
});

describe("presenter auth", () => {
  it("rejects requests without a signed-in user", async () => {
    expect((await adminSessions.GET(new Request(url("/api/admin/sessions")))).status).toBe(401);
    const forged = new Request(url("/api/admin/sessions"), { headers: { cookie: "lr_session=nope" } });
    expect((await adminSessions.GET(forged)).status).toBe(401);
  });
});

describe("POST /api/admin/sessions", () => {
  it("creates focus topics with their topics, trimmed and de-duplicated, in order", async () => {
    const res = await createSession({
      title: "  Demo  ",
      focusTopics: [
        { name: " Growth ", topics: [" Alpha ", "", "Beta", "alpha", "Gamma"] },
        { name: "Platform", topics: ["Alpha", "Delta"] }, // same topic name in another focus is fine
      ],
      criteria: ["Impact", "  ", "Feasibility"],
    });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);

    const info = (await (await sessionRoute.GET(new Request(url("/x")), ctx(code))).json()) as SessionPayload;
    expect(info.session).toEqual({ code, title: "Demo", scaleMax: 5, lowLabel: "Low", highLabel: "High", isOpen: true, revision: 0, theme: "paper", decor: true });
    expect(info.focusTopics.map((f) => f.name)).toEqual(["Growth", "Platform"]);
    const [growth, platform] = info.focusTopics;
    expect(info.topics.map((t) => [t.name, t.focusId])).toEqual([
      ["Alpha", growth.id],
      ["Beta", growth.id],
      ["Gamma", growth.id],
      ["Alpha", platform.id],
      ["Delta", platform.id],
    ]);
    expect(info.criteria.map((c) => c.name)).toEqual(["Impact", "Feasibility"]);
  });

  it("allows 1–10 focus topics with 1–10 topics each, and up to 10 criteria", async () => {
    const focus = (n: number, topics = 1) =>
      Array.from({ length: n }, (_, i) => ({ name: `F${i}`, topics: Array.from({ length: topics }, (_, j) => `t${j}`) }));
    const ok = await createSession({ title: "x", focusTopics: focus(10, 10), criteria: ["a"] });
    expect(ok.status).toBe(201);

    const bad: Record<string, unknown>[] = [
      { title: "x", focusTopics: [], criteria: ["a"] },
      { title: "x", focusTopics: focus(11), criteria: ["a"] },
      { title: "x", focusTopics: focus(1, 11), criteria: ["a"] },
      { title: "x", focusTopics: [{ name: "F", topics: ["", " "] }], criteria: ["a"] },
      { title: "x", focusTopics: [{ name: " ", topics: ["a"] }], criteria: ["a"] },
      { title: "x", focusTopics: [{ name: "Same", topics: ["a"] }, { name: "same", topics: ["b"] }], criteria: ["a"] },
      { title: "x", focusTopics: focus(1), criteria: [] },
      { title: "x", focusTopics: focus(1), criteria: Array.from({ length: 11 }, (_, i) => `c${i}`) },
      { title: "x", scaleMax: 11, focusTopics: focus(1), criteria: ["b"] },
      { title: "", focusTopics: focus(1), criteria: ["b"] },
    ];
    for (const body of bad) expect((await createSession(body)).status, JSON.stringify(body).slice(0, 80)).toBe(400);
  });

  it("lists sessions newest first with counts", async () => {
    const a = await demo(["A"], ["X"]);
    await new Promise((r) => setTimeout(r, 5));
    const b = await demo(["A", "B", "C"], ["X", "Y"]);
    await vote({ code: b.code, topicId: b.info.topics[0].id, criterionId: b.info.criteria[0].id, voterId: voter(), score: 3 });
    const body = (await (await adminSessions.GET(new Request(url("/x"), admin()))).json()) as {
      sessions: { code: string; focusCount: number; topicCount: number; criterionCount: number; voterCount: number; totalVotes: number }[];
    };
    expect(body.sessions.map((s) => s.code)).toEqual([b.code, a.code]);
    expect(body.sessions[0]).toMatchObject({ focusCount: 1, topicCount: 3, criterionCount: 2, voterCount: 1, totalVotes: 1 });
    expect(body.sessions[1]).toMatchObject({ voterCount: 0, totalVotes: 0 });
    const age = Date.now() - Date.parse((body.sessions[0] as unknown as { createdAt: string }).createdAt);
    expect(age).toBeGreaterThanOrEqual(0);
    expect(age).toBeLessThan(60_000);
  });
});

describe("GET /api/session/[code]", () => {
  it("404s for an unknown code", async () => {
    expect((await sessionRoute.GET(new Request(url("/x")), ctx("zzzzzz"))).status).toBe(404);
  });

  it("is never cached", async () => {
    const { code } = await demo();
    const res = await sessionRoute.GET(new Request(url("/x")), ctx(code));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("GET /api/session/[code]/status", () => {
  it("returns isOpen with a short CDN cache", async () => {
    const { code } = await demo();
    const res = await statusRoute.GET(new Request(url("/x")), ctx(code));
    expect(await res.json()).toEqual({ isOpen: true, revision: 0, showResults: false, openPoints: false, quiz: null });
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=1, stale-while-revalidate=1");
    expect((await statusRoute.GET(new Request(url("/x")), ctx("zzzzzz"))).status).toBe(404);
  });
});

describe("POST /api/vote + GET /api/results", () => {
  it("saves a rating and the dashboard aggregate reflects it", async () => {
    const { code, info } = await demo();
    const [t] = info.topics;
    const [c] = info.criteria;
    const res = await vote({ code, topicId: t.id, criterionId: c.id, voterId: voter(), score: 4 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const { body, res: rr } = await results(code);
    expect(rr.headers.get("cache-control")).toBe("private, no-store");
    expect(body.voterCount).toBe(1);
    expect(body.cells).toEqual([{ topicId: t.id, criterionId: c.id, n: 1, sum: 4 }]);
    expect(body.dist).toEqual([{ topicId: t.id, criterionId: c.id, score: 4, n: 1 }]);
  });

  it("changing a rating overwrites it: average changes, n stays", async () => {
    const { code, info } = await demo();
    const v = voter();
    const cell = { code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: v };
    await vote({ ...cell, score: 2 });
    await vote({ ...cell, score: 5 });
    const { body } = await results(code);
    expect(body.cells).toEqual([expect.objectContaining({ n: 1, sum: 5 })]);
  });

  it("a second voter on the same cell makes n=2 and voterCount=2", async () => {
    const { code, info } = await demo();
    const cell = { code, topicId: info.topics[0].id, criterionId: info.criteria[0].id };
    await vote({ ...cell, voterId: voter(), score: 2 });
    await vote({ ...cell, voterId: voter(), score: 5 });
    const { body } = await results(code);
    expect(body.voterCount).toBe(2);
    expect(body.cells).toEqual([expect.objectContaining({ n: 2, sum: 7 })]);
  });

  it("rejects bad input with 400 and writes nothing", async () => {
    const a = await demo();
    const b = await demo(["Other"], ["Thing"]);
    const base = { code: a.code, topicId: a.info.topics[0].id, criterionId: a.info.criteria[0].id, voterId: voter() };

    const cases = [
      { ...base, topicId: b.info.topics[0].id, score: 3 }, // topic from another session
      { ...base, criterionId: b.info.criteria[0].id, score: 3 }, // criterion from another session
      { ...base, score: 0 },
      { ...base, score: 6 }, // above scaleMax (5) but within the column check
      { ...base, score: 2.5 },
      { ...base, voterId: "not-a-uuid", score: 3 },
      { ...base, score: "3" },
    ];
    for (const body of cases) expect((await vote(body)).status, JSON.stringify(body)).toBe(400);

    const bad = await voteRoute.POST(new Request(url("/api/vote"), { method: "POST", body: "{nope" }));
    expect(bad.status).toBe(400);

    const count = await db.query<{ n: number }>("select count(*)::int as n from votes");
    expect(count.rows[0].n).toBe(0);
  });

  it("404s for an unknown session", async () => {
    const res = await vote({ code: "zzzzzz", topicId: voter(), criterionId: voter(), voterId: voter(), score: 3 });
    expect(res.status).toBe(404);
  });

  it("returns 403 closed when voting is closed, and accepts again after reopening", async () => {
    const { code, info } = await demo();
    const body = { code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: voter(), score: 3 };

    const patch = (isOpen: boolean) =>
      adminSession.PATCH(new Request(url("/x"), admin({ method: "PATCH", body: JSON.stringify({ isOpen }) })), ctx(code));
    expect((await patch(false)).status).toBe(200);

    const closed = await vote(body);
    expect(closed.status).toBe(403);
    expect(await closed.json()).toEqual({ error: "closed" });
    expect((await results(code)).body.isOpen).toBe(false);

    await patch(true);
    expect((await vote(body)).status).toBe(200);
  });

  it("returns 503 when the database is unreachable so the client retries", async () => {
    const { code, info } = await demo();
    failNextFetches(1);
    const res = await vote({ code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: voter(), score: 3 });
    expect(res.status).toBe(503);
  });

  it("never exposes voter ids", async () => {
    const { code, info } = await demo();
    const v = voter();
    await vote({ code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: v, score: 3 });
    const texts = [
      await (await resultsRoute.GET(new Request(url("/x"), admin()), ctx(code))).text(),
      await (await sessionRoute.GET(new Request(url("/x")), ctx(code))).text(),
      await (await adminSessions.GET(new Request(url("/x"), admin()))).text(),
      await (await exportRoute.GET(new Request(url("/x?type=raw"), admin()), ctx(code))).text(),
      await (await exportRoute.GET(new Request(url("/x?type=summary"), admin()), ctx(code))).text(),
    ];
    for (const t of texts) expect(t).not.toContain(v);
  });

  it("totals stay exact under many concurrent voters (check.sql returns zero rows)", async () => {
    const { code, info } = await demo(["A", "B", "C"], ["X", "Y"]);
    const voters = Array.from({ length: 25 }, voter);
    await Promise.all(
      voters.flatMap((v, i) =>
        info.topics.flatMap((t) =>
          info.criteria.map((c) => vote({ code, topicId: t.id, criterionId: c.id, voterId: v, score: (i % 5) + 1 })),
        ),
      ),
    );
    // A fifth of them change every rating.
    await Promise.all(
      voters.slice(0, 5).flatMap((v) =>
        info.topics.flatMap((t) => info.criteria.map((c) => vote({ code, topicId: t.id, criterionId: c.id, voterId: v, score: 1 }))),
      ),
    );
    const { body } = await results(code);
    expect(body.voterCount).toBe(25);
    expect(body.cells).toHaveLength(6);
    for (const cell of body.cells) expect(cell.n).toBe(25);
    expect((await db.query(CHECK_SQL)).rows).toEqual([]);
  });
});

describe("admin actions", () => {
  async function seeded() {
    const s = await demo();
    const v1 = voter();
    const v2 = voter();
    const [t1, t2] = s.info.topics;
    const [c1, c2] = s.info.criteria;
    await vote({ code: s.code, topicId: t1.id, criterionId: c1.id, voterId: v1, score: 4 });
    await vote({ code: s.code, topicId: t1.id, criterionId: c2.id, voterId: v1, score: 2 });
    await vote({ code: s.code, topicId: t1.id, criterionId: c1.id, voterId: v2, score: 5 });
    await vote({ code: s.code, topicId: t2.id, criterionId: c1.id, voterId: v2, score: 1 });
    return { ...s, v1, v2 };
  }

  it("reset clears every vote and total", async () => {
    const { code } = await seeded();
    expect((await resetRoute.POST(new Request(url("/x"), admin({ method: "POST" })), ctx(code))).status).toBe(200);
    const { body } = await results(code);
    expect(body).toMatchObject({ voterCount: 0, cells: [], dist: [] });
    expect((await db.query(CHECK_SQL)).rows).toEqual([]);
  });

  it("recalculate is refused while open and rebuilds totals once closed", async () => {
    const { code } = await seeded();
    const recalc = () => recalcRoute.POST(new Request(url("/x"), admin({ method: "POST" })), ctx(code));
    expect((await recalc()).status).toBe(409);

    await adminSession.PATCH(new Request(url("/x"), admin({ method: "PATCH", body: '{"isOpen":false}' })), ctx(code));
    await db.exec("update results set score_sum = 999, vote_count = 42"); // simulate drift
    expect((await db.query(CHECK_SQL)).rows.length).toBeGreaterThan(0);
    expect((await recalc()).status).toBe(200);
    expect((await db.query(CHECK_SQL)).rows).toEqual([]);
  });

  it("delete removes the session and everything under it", async () => {
    const { code } = await seeded();
    expect((await adminSession.DELETE(new Request(url("/x"), admin({ method: "DELETE" })), ctx(code))).status).toBe(200);
    expect((await sessionRoute.GET(new Request(url("/x")), ctx(code))).status).toBe(404);
    for (const table of ["sessions", "topics", "criteria", "votes", "results"]) {
      const r = await db.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      expect(r.rows[0].n, table).toBe(0);
    }
  });

  it("exports a summary CSV with averages and an Overall row per topic", async () => {
    const { code } = await seeded();
    const res = await exportRoute.GET(new Request(url("/x?type=summary"), admin()), ctx(code));
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([...buf.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const lines = new TextDecoder().decode(buf.slice(3)).trim().split("\r\n");
    expect(lines).toEqual([
      "Question,Item or option,Measure,Average score,Answers",
      "Focus,A,Impact,4.50,2",
      "Focus,A,Feasibility,2.00,1",
      "Focus,A,All measures,3.67,3",
      "Focus,B,Impact,1.00,1",
      "Focus,B,Feasibility,,0",
      "Focus,B,All measures,1.00,1",
    ]);
  });

  it("exports raw CSV with R1, R2… in order of first vote", async () => {
    const { code } = await seeded();
    const text = await (await exportRoute.GET(new Request(url("/x?type=raw"), admin()), ctx(code))).text();
    const rows = text.replace(/^﻿/, "").trim().split("\r\n").map((l) => l.split(","));
    expect(rows[0]).toEqual(["Person", "Question", "Item or option", "Measure", "Score", "Answered at"]);
    expect(rows.slice(1).map((r) => r.slice(0, 5))).toEqual([
      ["R1", "Focus", "A", "Impact", "4"],
      ["R1", "Focus", "A", "Feasibility", "2"],
      ["R2", "Focus", "A", "Impact", "5"],
      ["R2", "Focus", "B", "Impact", "1"],
    ]);
    for (const r of rows.slice(1)) expect(Math.abs(Date.now() - Date.parse(r[5]))).toBeLessThan(60_000);
  });

  it("rejects an unknown export type", async () => {
    const { code } = await demo();
    expect((await exportRoute.GET(new Request(url("/x?type=pdf"), admin()), ctx(code))).status).toBe(400);
  });
});
