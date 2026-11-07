// Audience Q&A: voters send in questions and upvote other people's; the owner hides or marks them answered.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as moderateRoute from "@/app/api/admin/sessions/[code]/qa/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as qaRoute from "@/app/api/qa/[code]/route";
import type { AdminSessionRow, PublicQaItem, ResultsPayload, SessionPayload } from "@/lib/types";

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
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const post = (code: string, body: Record<string, unknown>) =>
  qaRoute.POST(new Request(`${ORIGIN}/api/qa/${code}`, { method: "POST", body: JSON.stringify(body) }), ctx(code));
const list = async (code: string) => {
  const res = await qaRoute.GET(new Request(`${ORIGIN}/api/qa/${code}`), ctx(code));
  return { res, items: res.ok ? ((await res.json()) as { questions: PublicQaItem[] }).questions : [] };
};
const moderate = (code: string, body: Record<string, unknown>, as = cookie) =>
  moderateRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify(body) }, as)), ctx(code));
const csv = async (code: string, type: "summary" | "raw") =>
  (await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=${type}`, authed()), ctx(code))).text())
    .replace(/^﻿/, "")
    .trim()
    .split("\r\n");

async function newQa() {
  const res = await create({
    title: "Town hall",
    focusTopics: [{ name: "Ask us anything", kind: "qa" }, { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] }],
    criteria: [],
  });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = await info(code);
  return { code, s, qa: s.focusTopics[0], poll: s.focusTopics[1] };
}
async function ask(code: string, focusId: string, voterId: string, text: string) {
  const res = await post(code, { action: "ask", focusId, voterId, text });
  return { status: res.status, body: (await res.json()) as { id?: string; error?: string } };
}
const vote = (code: string, focusId: string, voterId: string, questionId: string, up = true) =>
  post(code, { action: "vote", focusId, voterId, questionId, up });

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("qa@example.com")).cookie!;
  otherCookie = (await signUp("qa-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("creating a Q&A question", () => {
  it("has no options and shows the most-voted questions first by default", async () => {
    const { s, qa } = await newQa();
    expect(qa.kind).toBe("qa");
    expect(qa.chart).toBe("top");
    expect(s.topics.filter((t) => t.focusId === qa.id)).toEqual([]);
  });
});

describe("asking and voting", () => {
  it("saves a tidied question, lists it publicly without voter ids, and counts upvotes", async () => {
    const { code, qa } = await newQa();
    const asker = voter();
    const a = await ask(code, qa.id, asker, "  When   is the launch? ");
    expect(a.status).toBe(200);
    expect(a.body.id).toMatch(/^[0-9a-f-]{36}$/);

    await vote(code, qa.id, voter(), a.body.id!);
    const fan = voter();
    expect((await vote(code, qa.id, fan, a.body.id!)).status).toBe(200);
    expect((await vote(code, qa.id, fan, a.body.id!)).status).toBe(200); // twice counts once

    const { res, items } = await list(code);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage/);
    expect(items).toEqual([{ id: a.body.id, focusId: qa.id, text: "When is the launch?", votes: 2, answered: false, at: expect.any(String) }]);
    expect(JSON.stringify(items)).not.toContain(asker);

    // taking a vote back
    await vote(code, qa.id, fan, a.body.id!, false);
    expect((await list(code)).items[0].votes).toBe(1);
  });

  it("allows 3 questions per person, refuses empty or long ones, and doesn't let people upvote their own", async () => {
    const { code, qa, poll } = await newQa();
    const v = voter();
    const first = await ask(code, qa.id, v, "One?");
    await ask(code, qa.id, v, "Two?");
    await ask(code, qa.id, v, "Three?");
    expect(await ask(code, qa.id, v, "Four?")).toMatchObject({ status: 429, body: { error: "limit" } });
    expect((await ask(code, qa.id, voter(), "   ")).status).toBe(400);
    expect((await ask(code, qa.id, voter(), "x".repeat(281))).status).toBe(400);
    expect((await ask(code, poll.id, voter(), "Wrong question type?")).status).toBe(400);
    expect((await vote(code, qa.id, v, first.body.id!)).status).toBe(400);
    expect((await list(code)).items.map((q) => q.votes)).toEqual([0, 0, 0]);
  });

  it("refuses questions and votes once voting is closed, and unknown codes", async () => {
    const { code, qa } = await newQa();
    const a = await ask(code, qa.id, voter(), "Before closing?");
    await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ isOpen: false }) })), ctx(code));
    expect((await ask(code, qa.id, voter(), "After?")).status).toBe(403);
    expect((await vote(code, qa.id, voter(), a.body.id!)).status).toBe(403);
    expect((await ask("zzzzzz", qa.id, voter(), "Hi?")).status).toBe(404);
    expect((await list("zzzzzz")).res.status).toBe(404);
  });
});

describe("moderating", () => {
  it("lets the owner hide a question (gone from the public list, kept in results) and mark one answered", async () => {
    const { code, qa } = await newQa();
    const keep = await ask(code, qa.id, voter(), "Fair question?");
    const rude = await ask(code, qa.id, voter(), "Something rude");

    expect((await moderate(code, { id: rude.body.id, hidden: true })).status).toBe(200);
    expect((await moderate(code, { id: keep.body.id, answered: true })).status).toBe(200);

    expect((await list(code)).items).toEqual([expect.objectContaining({ id: keep.body.id, answered: true })]);
    // hidden questions can't be voted for
    expect((await vote(code, qa.id, voter(), rude.body.id!)).status).toBe(400);

    const r = await results(code);
    expect(r.questions.map((q) => [q.text, q.hidden, q.answered]).sort()).toEqual([
      ["Fair question?", false, true],
      ["Something rude", true, false],
    ]);

    // and undo
    await moderate(code, { id: rude.body.id, hidden: false });
    expect((await list(code)).items).toHaveLength(2);
  });

  it("refuses anyone but the owner, and questions from another presentation", async () => {
    const { code, qa } = await newQa();
    const a = await ask(code, qa.id, voter(), "Mine?");
    expect((await moderate(code, { id: a.body.id, hidden: true }, otherCookie)).status).toBe(404);
    expect((await moderate(code, { id: a.body.id, hidden: true }, "")).status).toBe(401);
    const other = await newQa();
    expect((await moderate(other.code, { id: a.body.id, hidden: true })).status).toBe(404);
    expect((await moderate(code, { id: a.body.id })).status).toBe(400);
    expect((await list(code)).items).toHaveLength(1);
  });
});

describe("results, counts, exports and reset", () => {
  it("counts askers and voters as people, exports questions with votes, and reset clears them", async () => {
    const { code, qa } = await newQa();
    const asker = voter();
    const q1 = await ask(code, qa.id, asker, "Pay rise, please?");
    const q2 = await ask(code, qa.id, voter(), "Remote work?");
    await vote(code, qa.id, voter(), q1.body.id!);
    await vote(code, qa.id, voter(), q1.body.id!);
    await vote(code, qa.id, asker, q2.body.id!);
    await moderate(code, { id: q2.body.id, answered: true });

    const r = await results(code);
    expect(r.voterCount).toBe(4);
    expect(r.respondents).toEqual([{ focusId: qa.id, n: 4 }]);
    expect(r.questions.find((q) => q.id === q1.body.id)).toMatchObject({ votes: 2, hidden: false, answered: false });

    const sessions = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, authed()))).json()) as { sessions: AdminSessionRow[] };
    expect(sessions.sessions[0].voterCount).toBe(4);

    const counts = (await (await adminSession.GET(new Request(`${ORIGIN}/x`, authed()), ctx(code))).json()) as { counts: Record<string, number> };
    expect(counts.counts[qa.id]).toBe(4);

    const summary = await csv(code, "summary");
    expect(summary).toContain('Ask us anything,"Pay rise, please?",Audience question,,2');
    expect(summary).toContain("Ask us anything,Remote work?,Answered question,,1");
    const raw = (await csv(code, "raw")).join("\n");
    expect(raw).toContain('Ask us anything,"Pay rise, please?",Asked');
    expect(raw).toContain("Ask us anything,Remote work?,Upvoted");
    expect(raw).not.toContain(asker);

    await resetRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST" })), ctx(code));
    expect(await results(code)).toMatchObject({ voterCount: 0, questions: [], respondents: [] });
  });
});
