import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as voteRoute from "@/app/api/vote/route";
import type { AdminSessionRow, ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
let otherCookie = "";
const CHECK_SQL = readFileSync(new URL("../db/check.sql", import.meta.url), "utf8");
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const as = (c: string, init: RequestInit = {}) => ({
  ...init,
  headers: { cookie: c, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});

async function create(body: Record<string, unknown>) {
  const res = await adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, as(cookie, { method: "POST", body: JSON.stringify(body) })));
  expect(res.status).toBe(201);
  return (await res.json()) as { code: string; dashboardKey: string };
}

const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const results = (code: string, headers: Record<string, string> = {}) =>
  resultsRoute.GET(new Request(`${ORIGIN}/api/results/${code}`, { headers }), ctx(code));
const vote = (code: string, topicId: string, criterionId: string, score = 4, voterId = crypto.randomUUID()) =>
  voteRoute.POST(new Request(`${ORIGIN}/api/vote`, { method: "POST", body: JSON.stringify({ code, topicId, criterionId, voterId, score }) }));
const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));
const edit = (code: string, body: unknown, c = cookie, headers: Record<string, string> = {}) =>
  adminSession.PUT(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as(c, { method: "PUT", body: JSON.stringify(body), headers })), ctx(code));
const editable = (code: string, c = cookie) => adminSession.GET(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as(c)), ctx(code));

/** The edit body for a presentation exactly as it is now (ids kept). */
function asEdit(s: SessionPayload) {
  return {
    title: s.session.title,
    scaleMax: s.session.scaleMax,
    lowLabel: s.session.lowLabel,
    highLabel: s.session.highLabel,
    focusTopics: s.focusTopics.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      chart: f.chart,
      topics: s.topics.filter((t) => t.focusId === f.id).map((t) => ({ id: t.id, name: t.name })),
    })),
    criteria: s.criteria.map((c) => ({ id: c.id, name: c.name })),
  };
}

async function mixed() {
  const created = await create({
    title: "Offsite",
    focusTopics: [
      { name: "Bets", kind: "rating", topics: ["A", "B"] },
      { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
    ],
    criteria: ["Impact", "Effort"],
  });
  return { ...created, s: await info(created.code) };
}

async function checkConsistent() {
  const rows = (await db.query(CHECK_SQL)).rows;
  expect(rows).toEqual([]);
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("owner@example.com")).cookie!;
  otherCookie = (await signUp("someone-else@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("live results are private to the presenter", () => {
  it("each presentation gets its own long random dashboard key, shown only to the owner", async () => {
    const a = await create({ title: "A", focusTopics: [{ name: "P", kind: "poll", topics: ["x", "y"] }], criteria: [] });
    const b = await create({ title: "B", focusTopics: [{ name: "P", kind: "poll", topics: ["x", "y"] }], criteria: [] });
    expect(a.dashboardKey).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(a.dashboardKey).not.toBe(b.dashboardKey);
    expect(a.dashboardKey).not.toContain(a.code);

    const list = (await (await adminSessions.GET(new Request(`${ORIGIN}/api/admin/sessions`, as(cookie)))).json()) as { sessions: AdminSessionRow[] };
    expect(list.sessions.find((s) => s.code === a.code)?.dashboardKey).toBe(a.dashboardKey);

    // the public voter payload never carries it
    const pub = await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(a.code))).text();
    expect(pub).not.toContain(a.dashboardKey);
  });

  it("knowing the voting code is not enough to read results", async () => {
    const { code, dashboardKey } = await mixed();
    expect((await results(code)).status).toBe(404);
    expect((await results(code, { "x-dashboard-key": "x".repeat(43) })).status).toBe(404);
    expect((await results(code, { "x-dashboard-key": dashboardKey })).status).toBe(200);
  });

  it("the signed-in owner can read results without the key; other accounts can't", async () => {
    const { code } = await mixed();
    expect((await results(code, { cookie })).status).toBe(200);
    expect((await results(code, { cookie: otherCookie })).status).toBe(404);
  });

  it("results responses are never cached by shared caches", async () => {
    const { code, dashboardKey } = await mixed();
    const res = await results(code, { "x-dashboard-key": dashboardKey });
    expect(res.headers.get("cache-control")).toMatch(/private|no-store/);
  });
});

describe("GET /api/admin/sessions/[code] (for the edit form)", () => {
  it("returns the structure with ids, answer counts per item and whether the scale is locked", async () => {
    const { code, s } = await mixed();
    const [bets, lunch] = s.focusTopics;
    const a = s.topics.find((t) => t.name === "A")!;
    const pizza = s.topics.find((t) => t.name === "Pizza")!;
    await vote(code, a.id, s.criteria[0].id);
    await answer({ kind: "poll", code, focusId: lunch.id, voterId: crypto.randomUUID(), topicId: pizza.id });

    const res = await editable(code);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { session: SessionPayload; counts: Record<string, number>; scaleLocked: boolean };
    expect(body.session.focusTopics.map((f) => f.id)).toEqual([bets.id, lunch.id]);
    expect(body.counts[a.id]).toBe(1);
    expect(body.counts[pizza.id]).toBe(1);
    expect(body.counts[s.criteria[0].id]).toBe(1);
    expect(body.counts[bets.id]).toBe(1);
    expect(body.scaleLocked).toBe(true);
  });

  it("is owner-only", async () => {
    const { code } = await mixed();
    expect((await editable(code, otherCookie)).status).toBe(404);
    expect((await editable(code, "")).status).toBe(401);
  });
});

describe("PUT /api/admin/sessions/[code] — editing a presentation", () => {
  it("renames and reorders without losing votes, and bumps the revision", async () => {
    const { code, s, dashboardKey } = await mixed();
    const a = s.topics.find((t) => t.name === "A")!;
    await vote(code, a.id, s.criteria[0].id, 5);
    const before = (await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as { revision: number };

    const body = asEdit(s);
    body.title = "Offsite 2027";
    body.focusTopics[0].name = "Growth bets";
    body.focusTopics[0].topics = [body.focusTopics[0].topics[1], { ...body.focusTopics[0].topics[0], name: "A (renamed)" }];
    body.focusTopics[0].chart = "ranking";
    body.criteria[0].name = "Business impact";
    body.focusTopics.reverse();
    expect((await edit(code, body)).status).toBe(200);

    const after = await info(code);
    expect(after.session.title).toBe("Offsite 2027");
    expect(after.focusTopics.map((f) => f.name)).toEqual(["Lunch?", "Growth bets"]);
    expect(after.focusTopics[1].chart).toBe("ranking");
    expect(after.topics.filter((t) => t.focusId === s.focusTopics[0].id).map((t) => t.name)).toEqual(["B", "A (renamed)"]);
    expect(after.criteria[0]).toEqual({ id: s.criteria[0].id, name: "Business impact" });

    const r = (await (await results(code, { "x-dashboard-key": dashboardKey })).json()) as ResultsPayload;
    expect(r.cells).toEqual([{ topicId: a.id, criterionId: s.criteria[0].id, n: 1, sum: 5 }]);
    const status = (await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as { revision: number };
    expect(status.revision).toBe(before.revision + 1);
    await checkConsistent();
  });

  it("adds new topics, options, criteria and questions", async () => {
    const { code, s } = await mixed();
    const body = asEdit(s);
    body.focusTopics[0].topics.push({ name: "C" } as never);
    body.focusTopics[1].topics.push({ name: "Tacos" } as never);
    body.criteria.push({ name: "Risk" } as never);
    body.focusTopics.push({ name: "One word?", kind: "words", chart: "cloud", topics: [] } as never);
    expect((await edit(code, body)).status).toBe(200);

    const after = await info(code);
    expect(after.focusTopics.map((f) => f.name)).toEqual(["Bets", "Lunch?", "One word?"]);
    expect(after.topics.map((t) => t.name)).toEqual(["A", "B", "C", "Pizza", "Sushi", "Tacos"]);
    expect(after.criteria.map((c) => c.name)).toEqual(["Impact", "Effort", "Risk"]);
    // new items can be voted on straight away
    const c = after.topics.find((t) => t.name === "C")!;
    expect((await vote(code, c.id, after.criteria[2].id)).status).toBe(200);
  });

  it("removing an item removes its answers and keeps totals consistent", async () => {
    const { code, s, dashboardKey } = await mixed();
    const [a, b] = s.topics.filter((t) => t.focusId === s.focusTopics[0].id);
    const [pizza, sushi] = s.topics.filter((t) => t.focusId === s.focusTopics[1].id);
    await vote(code, a.id, s.criteria[0].id, 2);
    await vote(code, b.id, s.criteria[0].id, 4);
    await vote(code, b.id, s.criteria[1].id, 3);
    await answer({ kind: "poll", code, focusId: s.focusTopics[1].id, voterId: crypto.randomUUID(), topicId: pizza.id });
    await answer({ kind: "poll", code, focusId: s.focusTopics[1].id, voterId: crypto.randomUUID(), topicId: sushi.id });

    const body = asEdit(s);
    body.focusTopics[0].topics = body.focusTopics[0].topics.filter((t) => t.id !== a.id);
    body.criteria = body.criteria.filter((c) => c.id !== s.criteria[1].id);
    body.focusTopics[1].topics = [...body.focusTopics[1].topics.filter((t) => t.id !== pizza.id), { name: "Tacos" } as never];
    expect((await edit(code, body)).status).toBe(200);

    const r = (await (await results(code, { "x-dashboard-key": dashboardKey })).json()) as ResultsPayload;
    expect(r.cells).toEqual([{ topicId: b.id, criterionId: s.criteria[0].id, n: 1, sum: 4 }]);
    expect(r.polls).toEqual([{ focusId: s.focusTopics[1].id, topicId: sushi.id, n: 1 }]);
    await checkConsistent();

    // removing a whole question removes its answers too
    const now = await info(code);
    const body2 = asEdit(now);
    body2.focusTopics = body2.focusTopics.filter((f) => f.kind !== "poll");
    expect((await edit(code, body2)).status).toBe(200);
    const r2 = (await (await results(code, { "x-dashboard-key": dashboardKey })).json()) as ResultsPayload;
    expect(r2.polls).toEqual([]);
    await checkConsistent();
  });

  it("a vote for a removed topic is rejected, not lost silently", async () => {
    const { code, s } = await mixed();
    const a = s.topics.find((t) => t.name === "A")!;
    const body = asEdit(s);
    body.focusTopics[0].topics = body.focusTopics[0].topics.filter((t) => t.id !== a.id);
    await edit(code, body);
    expect((await vote(code, a.id, s.criteria[0].id)).status).toBe(400);
  });

  it("keeps a question's type; to change it, remove the question and add a new one", async () => {
    const { code, s } = await mixed();
    const body = asEdit(s);
    body.focusTopics[1].kind = "rating";
    body.focusTopics[1].chart = "heatmap";
    expect((await edit(code, body)).status).toBe(400);
  });

  it("locks the rating scale once ratings exist", async () => {
    const { code, s } = await mixed();
    const body = asEdit(s);
    body.scaleMax = 7;
    expect((await edit(code, body)).status).toBe(200);
    expect((await info(code)).session.scaleMax).toBe(7);

    await vote(code, s.topics[0].id, s.criteria[0].id, 6);
    body.scaleMax = 5;
    const res = await edit(code, body);
    expect(res.status).toBe(409);
    expect((await info(code)).session.scaleMax).toBe(7);
    // labels can still change
    body.scaleMax = 7;
    body.lowLabel = "Meh";
    expect((await edit(code, body)).status).toBe(200);
  });

  it("refuses ids that belong to another presentation", async () => {
    const one = await mixed();
    const two = await mixed();
    const body = asEdit(one.s);
    body.focusTopics[0].topics.push({ id: two.s.topics[0].id, name: "stolen" });
    expect((await edit(one.code, body)).status).toBe(400);
    const body2 = asEdit(one.s);
    body2.criteria[0].id = two.s.criteria[0].id;
    expect((await edit(one.code, body2)).status).toBe(400);
    // nothing changed in either
    expect((await info(two.code)).topics.map((t) => t.name)).toEqual(["A", "B", "Pizza", "Sushi"]);
  });

  it("validates like creating (poll needs 2 options, no repeats) and is owner-only", async () => {
    const { code, s } = await mixed();
    const bad = asEdit(s);
    bad.focusTopics[1].topics = bad.focusTopics[1].topics.slice(0, 1);
    expect((await edit(code, bad)).status).toBe(400);
    const dup = asEdit(s);
    dup.focusTopics[0].topics[1].name = " a ";
    expect((await edit(code, dup)).status).toBe(400);

    expect((await edit(code, asEdit(s), otherCookie)).status).toBe(404);
    expect((await edit(code, asEdit(s), cookie, { origin: "https://evil.example" })).status).toBe(403);
  });
});
