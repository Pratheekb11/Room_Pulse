// Open points (an open point list, "OPL"): things to follow up after the poll. People raise them from their
// phones, the presenter adds their own or takes one from a result, assigns it, and tracks it until it's closed.
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as adminPoints from "@/app/api/admin/sessions/[code]/points/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as pointsRoute from "@/app/api/points/[code]/route";
import * as myPointsRoute from "@/app/api/points/[code]/me/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as publicResultsRoute from "@/app/api/results/[code]/public/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as voteRoute from "@/app/api/vote/route";
import * as qaRoute from "@/app/api/qa/[code]/route";
import { MAX_POINTS_PER_VOTER, pointCounts, POINT_STATUSES, sortPoints } from "@/lib/points";
import { resultSignals } from "@/lib/signals";
import { groupByFocus } from "@/lib/focus";
import { indexCells, topicHistograms } from "@/lib/stats";
import type { AdminSessionRow, MyOpenPoint, OpenPoint, ResultsPayload, SessionPayload, SessionStatus } from "@/lib/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

let db: PGlite;
let cookie = "";
let otherCookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const voter = () => crypto.randomUUID();
const create = (body: Record<string, unknown>) =>
  adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, authed({ method: "POST", body: JSON.stringify(body) })));
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const patchSession = (code: string, body: Record<string, unknown>, as = cookie) =>
  adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify(body) }, as)), ctx(code));
const status = async (code: string) => (await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionStatus;

const raise = (code: string, body: Record<string, unknown>) =>
  pointsRoute.POST(new Request(`${ORIGIN}/api/points/${code}`, { method: "POST", body: JSON.stringify(body) }), ctx(code));
const mine = async (code: string, voterId: string) => {
  const res = await myPointsRoute.GET(new Request(`${ORIGIN}/api/points/${code}/me?voter=${voterId}`), ctx(code));
  return { res, points: res.ok ? ((await res.json()) as { points: MyOpenPoint[] }).points : [] };
};
const list = async (code: string, as = cookie) => {
  const res = await adminPoints.GET(new Request(`${ORIGIN}/x`, authed({}, as)), ctx(code));
  return { res, points: res.ok ? ((await res.json()) as { points: OpenPoint[] }).points : [] };
};
const add = (code: string, body: Record<string, unknown>, as = cookie) =>
  adminPoints.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify(body) }, as)), ctx(code));
const change = (code: string, body: Record<string, unknown>, as = cookie) =>
  adminPoints.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify(body) }, as)), ctx(code));
const remove = (code: string, id: string, as = cookie) =>
  adminPoints.DELETE(new Request(`${ORIGIN}/x`, authed({ method: "DELETE", body: JSON.stringify({ id }) }, as)), ctx(code));

async function newRetro({ on = true } = {}) {
  const res = await create({
    title: "Sprint retro",
    focusTopics: [
      { name: "How did it go?", kind: "rating", topics: ["Planning", "Testing", "Releases"] },
      { name: "Questions for the team", kind: "qa" },
    ],
    criteria: ["Went well"],
  });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  if (on) expect((await patchSession(code, { openPoints: true })).status).toBe(200);
  return { code, s: await info(code) };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("opl@example.com")).cookie!;
  otherCookie = (await signUp("opl-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("the presenter's setting", () => {
  it("is off until the presenter turns it on, and phones learn about it from the status", async () => {
    const { code } = await newRetro({ on: false });
    expect((await status(code)).openPoints).toBe(false);
    const res = await raise(code, { voterId: voter(), text: "The build server is slow" });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("points_off");

    expect((await patchSession(code, { openPoints: true })).status).toBe(200);
    expect((await status(code)).openPoints).toBe(true);
    const sessions = ((await (await adminSessions.GET(new Request(`${ORIGIN}/x`, authed()))).json()) as { sessions: AdminSessionRow[] }).sessions;
    expect(sessions[0].openPoints).toBe(true);
  });

  it("can't be changed by someone else", async () => {
    const { code } = await newRetro({ on: false });
    expect((await patchSession(code, { openPoints: true }, otherCookie)).status).toBe(404);
    expect((await status(code)).openPoints).toBe(false);
  });
});

describe("raising an open point from a phone", () => {
  it("saves it as open, numbered, with the optional name, and shows it back to that person only", async () => {
    const { code } = await newRetro();
    const [ann, bob] = [voter(), voter()];
    const first = await raise(code, { voterId: ann, text: "  The build   server is slow ", name: " Ann " });
    expect(first.status).toBe(201);
    expect(((await first.json()) as { number: number }).number).toBe(1);
    expect((await raise(code, { voterId: bob, text: "We need a staging database" })).status).toBe(201);

    const anns = (await mine(code, ann)).points;
    expect(anns).toHaveLength(1);
    expect(anns[0]).toMatchObject({ number: 1, text: "The build server is slow", status: "open", note: null });
    expect(Object.keys(anns[0]).sort()).toEqual(["at", "id", "note", "number", "status", "text"]);
    expect((await mine(code, bob)).points.map((p) => p.number)).toEqual([2]);
    expect((await mine(code, voter())).points).toEqual([]);

    const all = (await list(code)).points;
    expect(all.map((p) => [p.number, p.title, p.raisedBy, p.source, p.status])).toEqual([
      [1, "The build server is slow", "Ann", "audience", "open"],
      [2, "We need a staging database", null, "audience", "open"],
    ]);
    // the presenter never gets voter ids
    expect(JSON.stringify(all)).not.toContain(ann);
  });

  it("refuses empty or very long text, and bad ids", async () => {
    const { code } = await newRetro();
    expect((await raise(code, { voterId: voter(), text: "   " })).status).toBe(400);
    expect((await raise(code, { voterId: voter(), text: "x".repeat(201) })).status).toBe(400);
    expect((await raise(code, { voterId: "me", text: "Hello" })).status).toBe(400);
    expect((await raise(code, { voterId: voter(), text: "Fine", name: "n".repeat(41) })).status).toBe(400);
    expect((await raise("nosuch1", { voterId: voter(), text: "Hello" })).status).toBe(404);
  });

  it("stops one person at the most they may raise", async () => {
    const { code } = await newRetro();
    const v = voter();
    for (let i = 0; i < MAX_POINTS_PER_VOTER; i++) expect((await raise(code, { voterId: v, text: `Point ${i}` })).status).toBe(201);
    const res = await raise(code, { voterId: v, text: "One too many" });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe("limit");
    expect((await raise(code, { voterId: voter(), text: "Someone else still can" })).status).toBe(201);
  });

  it("is refused once voting is closed", async () => {
    const { code } = await newRetro();
    await patchSession(code, { isOpen: false });
    const res = await raise(code, { voterId: voter(), text: "Too late" });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe("closed");
  });

  it("doesn't count as answering a question", async () => {
    const { code } = await newRetro();
    await raise(code, { voterId: voter(), text: "Only a point" });
    const r = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
    expect(r.voterCount).toBe(0);
    expect(r.openPoints).toBe(1);
  });
});

describe("the presenter's open point list", () => {
  it("is only for the owner", async () => {
    const { code } = await newRetro();
    expect((await list(code, otherCookie)).res.status).toBe(404);
    expect((await add(code, { title: "Sneaky" }, otherCookie)).status).toBe(404);
    const res = await adminPoints.GET(new Request(`${ORIGIN}/x`), ctx(code));
    expect(res.status).toBe(401);
  });

  it("lets the presenter add their own, even with phones' open points off", async () => {
    const { code, s } = await newRetro({ on: false });
    const res = await add(code, { title: " Order a second build server ", assignee: " Priya ", due: "2026-12-01", focusId: s.focusTopics[0].id });
    expect(res.status).toBe(201);
    const [p] = (await list(code)).points;
    expect(p).toMatchObject({
      number: 1,
      title: "Order a second build server",
      source: "presenter",
      raisedBy: null,
      assignee: "Priya",
      due: "2026-12-01",
      status: "open",
      note: null,
      focusId: s.focusTopics[0].id,
      closedAt: null,
    });
  });

  it("assigns, sets a due date, moves to in progress and closes with a note", async () => {
    const { code } = await newRetro();
    const v = voter();
    await raise(code, { voterId: v, text: "Flaky login test" });
    const [p] = (await list(code)).points;

    expect((await change(code, { id: p.id, assignee: "Ravi", due: "2026-11-30", status: "doing" })).status).toBe(200);
    let [now] = (await list(code)).points;
    expect(now).toMatchObject({ assignee: "Ravi", due: "2026-11-30", status: "doing", closedAt: null });
    expect((await mine(code, v)).points[0].status).toBe("doing");

    expect((await change(code, { id: p.id, status: "closed", note: "Fixed in build 412" })).status).toBe(200);
    [now] = (await list(code)).points;
    expect(now.status).toBe("closed");
    expect(now.note).toBe("Fixed in build 412");
    expect(now.closedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    // the person who raised it sees that it's closed, and the note
    expect((await mine(code, v)).points[0]).toMatchObject({ status: "closed", note: "Fixed in build 412" });

    // reopening clears the closed time; clearing the assignee and date works too
    expect((await change(code, { id: p.id, status: "open", assignee: null, due: null })).status).toBe(200);
    [now] = (await list(code)).points;
    expect(now).toMatchObject({ status: "open", assignee: null, due: null, closedAt: null, note: "Fixed in build 412" });
  });

  it("can reword and delete a point, and refuses nonsense", async () => {
    const { code } = await newRetro();
    await add(code, { title: "Frst draft" });
    const [p] = (await list(code)).points;
    expect((await change(code, { id: p.id, title: "First draft" })).status).toBe(200);
    expect((await list(code)).points[0].title).toBe("First draft");
    expect((await change(code, { id: p.id, status: "someday" })).status).toBe(400);
    expect((await change(code, { id: p.id, due: "next week" })).status).toBe(400);
    expect((await change(code, { id: p.id })).status).toBe(400);
    expect((await change(code, { id: crypto.randomUUID(), status: "closed" })).status).toBe(404);
    expect((await remove(code, p.id, otherCookie)).status).toBe(404);
    expect((await remove(code, p.id)).status).toBe(200);
    expect((await list(code)).points).toEqual([]);
  });

  it("can't touch another presentation's points", async () => {
    const a = await newRetro();
    const b = await newRetro();
    await add(a.code, { title: "A's point" });
    const [p] = (await list(a.code)).points;
    expect((await change(b.code, { id: p.id, status: "closed" })).status).toBe(404);
    expect((await remove(b.code, p.id)).status).toBe(404);
    expect((await list(a.code)).points[0].status).toBe("open");
  });

  it("keeps numbering going after a delete, so a number is never reused", async () => {
    const { code } = await newRetro();
    await add(code, { title: "One" });
    await add(code, { title: "Two" });
    const two = (await list(code)).points[1];
    await remove(code, two.id);
    await add(code, { title: "Three" });
    expect((await list(code)).points.map((p) => [p.number, p.title])).toEqual([[1, "One"], [3, "Three"]]);
  });

  it("takes a point from a result or an AI suggestion once only", async () => {
    const { code, s } = await newRetro();
    const body = { title: "Low score: Testing", source: "result", originKey: `low:${s.topics[1].id}`, focusId: s.focusTopics[0].id };
    expect((await add(code, body)).status).toBe(201);
    const again = await add(code, body);
    expect(again.status).toBe(409);
    expect((await add(code, { title: "Write a test plan", source: "ai", originKey: "ai:write a test plan" })).status).toBe(201);
    expect((await list(code)).points.map((p) => [p.source, p.originKey])).toEqual([
      ["result", `low:${s.topics[1].id}`],
      ["ai", "ai:write a test plan"],
    ]);
    // the presenter can't claim a point came from the audience
    expect((await add(code, { title: "Fake", source: "audience" })).status).toBe(400);
  });

  it("survives \"Clear all answers\" and goes when the presentation is deleted", async () => {
    const { code } = await newRetro();
    await raise(code, { voterId: voter(), text: "Keep me" });
    await resetRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST" })), ctx(code));
    expect((await list(code)).points).toHaveLength(1);
    await adminSession.DELETE(new Request(`${ORIGIN}/x`, authed({ method: "DELETE" })), ctx(code));
    expect((await db.query("select count(*)::int as n from open_points")).rows[0]).toEqual({ n: 0 });
  });

  it("exports the list as a spreadsheet", async () => {
    const { code, s } = await newRetro();
    await raise(code, { voterId: voter(), text: "Slow builds, again", name: "Ann" });
    await add(code, { title: "Write a test plan", assignee: "Ravi", due: "2026-12-05", focusId: s.focusTopics[0].id });
    const [p] = (await list(code)).points;
    await change(code, { id: p.id, status: "closed", note: "Done" });
    const res = await exportRoute.GET(new Request(`${ORIGIN}/x?type=points`, authed()), ctx(code));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(`liverate-${code}-points.csv`);
    const lines = (await res.text()).replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe("Number,Open point,Status,Assigned to,Due,Raised by,From,Question,Note,Raised at,Closed at");
    expect(lines[1]).toMatch(/^1,"Slow builds, again",Closed,,,Ann,Audience,,Done,\d{4}-.*,\d{4}-/);
    expect(lines[2]).toMatch(/^2,Write a test plan,Open,Ravi,2026-12-05,,Presenter,How did it go\?,,\d{4}-.*,$/);
  });

  it("never shows open points on voters' results", async () => {
    const { code } = await newRetro();
    await patchSession(code, { showResults: true });
    await add(code, { title: "Internal follow-up" });
    const res = await publicResultsRoute.GET(new Request(`${ORIGIN}/x`), ctx(code));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain("Internal follow-up");
    expect((JSON.parse(text) as ResultsPayload).openPoints ?? 0).toBe(0);
  });
});

describe("helpers", () => {
  const p = (number: number, s: OpenPoint["status"], extra: Partial<OpenPoint> = {}): OpenPoint => ({
    id: String(number),
    number,
    title: `P${number}`,
    source: "presenter",
    originKey: null,
    focusId: null,
    raisedBy: null,
    status: s,
    assignee: null,
    due: null,
    note: null,
    createdAt: "2026-11-14T10:00:00.000Z",
    closedAt: null,
    ...extra,
  });

  it("counts by status and puts closed points last", () => {
    const points = [p(1, "closed"), p(2, "open"), p(3, "doing"), p(4, "open")];
    expect(pointCounts(points)).toEqual({ open: 2, doing: 1, closed: 1, active: 3 });
    expect(sortPoints(points).map((x) => x.number)).toEqual([2, 3, 4, 1]);
    expect(POINT_STATUSES.map((s) => s.label)).toEqual(["Open", "In progress", "Closed"]);
  });
});

describe("signals: results that call for an open point", () => {
  async function scored() {
    const { code, s } = await newRetro();
    const [planning, testing, releases] = s.topics;
    const c = s.criteria[0].id;
    const vote = (topicId: string, voterId: string, score: number) =>
      voteRoute.POST(new Request(`${ORIGIN}/api/vote`, { method: "POST", body: JSON.stringify({ code, topicId, criterionId: c, voterId, score }) }));
    const people = [voter(), voter(), voter(), voter()];
    // Planning: everyone happy. Testing: everyone unhappy. Releases: split down the middle.
    for (const v of people) await vote(planning.id, v, 5);
    for (const v of people) await vote(testing.id, v, 2);
    for (const [i, v] of people.entries()) await vote(releases.id, v, i < 2 ? 1 : 5);
    const qa = s.focusTopics[1];
    const asker = voter();
    const ask = async (text: string) =>
      ((await (await qaRoute.POST(new Request(`${ORIGIN}/x`, { method: "POST", body: JSON.stringify({ action: "ask", focusId: qa.id, voterId: asker, text }) }), ctx(code))).json()) as { id: string }).id;
    const popular = await ask("When do we get a staging server?");
    await ask("Nobody upvoted this one");
    for (const v of people.slice(0, 3))
      await qaRoute.POST(new Request(`${ORIGIN}/x`, { method: "POST", body: JSON.stringify({ action: "vote", focusId: qa.id, voterId: v, questionId: popular, up: true }) }), ctx(code));
    const r = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
    const signals = resultSignals(groupByFocus(s.focusTopics, s.topics), s.criteria, indexCells(r.cells), topicHistograms(r.dist, s.session.scaleMax), r, s.session.scaleMax);
    return { code, s, signals, testing, releases, popular };
  }

  it("flags low-scored items, items people disagree on and popular unanswered questions", async () => {
    const { signals, s, testing, releases, popular } = await scored();
    expect(signals.map((x) => x.key)).toEqual([`low:${testing.id}`, `split:${releases.id}`, `qa:${popular}`]);
    expect(signals[0]).toMatchObject({ focusId: s.focusTopics[0].id, title: "Low score: Testing" });
    expect(signals[0].reason).toBe("Scored 2.0 out of 5 in “How did it go?” (4 answers).");
    expect(signals[1].title).toBe("People disagree about Releases");
    expect(signals[2].title).toBe("Unanswered: When do we get a staging server?");
    expect(signals[2].reason).toBe("3 people upvoted this question and it isn't marked answered.");
  });

  it("stays quiet when there's nothing to follow up", async () => {
    const { s } = await newRetro();
    const empty = { cells: [], dist: [], questions: [] } as unknown as ResultsPayload;
    expect(resultSignals(groupByFocus(s.focusTopics, s.topics), s.criteria, indexCells([]), topicHistograms([], 5), empty, 5)).toEqual([]);
  });
});

describe("open points on screen", () => {
  it("phones get a way to raise one and to see what happened to theirs", () => {
    const sheet = read("components/vote/RaisePoint.tsx");
    expect(sheet).toContain("Raise an open point");
    expect(sheet).toContain("/api/points/");
    expect(sheet).toMatch(/<ToBody>/);
    expect(read("components/VoteApp.tsx")).toMatch(/<RaisePoint\b/);
  });

  it("the results screen has the presenter's list, with suggestions from the results", () => {
    const dashboard = read("components/DashboardApp.tsx");
    expect(dashboard).toMatch(/<OpenPoints\b/);
    expect(dashboard).toContain("Open points");
    const panel = read("components/results/OpenPoints.tsx");
    expect(panel).toContain("resultSignals");
    expect(panel).toContain("Assigned to");
    expect(panel).toContain("type=points");
    for (const s of POINT_STATUSES) expect(panel).not.toContain(`>${s.label}<`); // labels come from POINT_STATUSES
  });

  it("the presenter turns it on per presentation", () => {
    expect(read("components/admin/SessionCard.tsx")).toContain("openPoints");
  });
});
