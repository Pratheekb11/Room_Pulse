// Quiz: presenter-paced questions with a right answer, a timer, points for speed and a leaderboard.
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as controlRoute from "@/app/api/admin/sessions/[code]/quiz/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as quizRoute from "@/app/api/quiz/[code]/route";
import * as meRoute from "@/app/api/quiz/[code]/me/route";
import type { AdminSessionRow, QuizMe, ResultsPayload, SessionPayload, SessionStatus } from "@/lib/types";

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
const ownerInfo = async (code: string) =>
  (await (await adminSession.GET(new Request(`${ORIGIN}/x`, authed()), ctx(code))).json()) as { session: SessionPayload };
const status = async (code: string) => (await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionStatus;
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const play = (code: string, body: Record<string, unknown>) =>
  quizRoute.POST(new Request(`${ORIGIN}/api/quiz/${code}`, { method: "POST", body: JSON.stringify(body) }), ctx(code));
const me = async (code: string, voterId: string) =>
  (await (await meRoute.GET(new Request(`${ORIGIN}/api/quiz/${code}/me?voter=${voterId}`), ctx(code))).json()) as QuizMe;
const control = (code: string, body: Record<string, unknown>, as = cookie) =>
  controlRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify(body) }, as)), ctx(code));
const csv = async (code: string, type: "summary" | "raw") =>
  (await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=${type}`, authed()), ctx(code))).text())
    .replace(/^﻿/, "")
    .trim()
    .split("\r\n");
/** Moves the running question's start back in time, as if seconds had passed. */
const elapse = (seconds: number) => db.exec(`update sessions set quiz_started_at = quiz_started_at - interval '${seconds} seconds'`);

async function newQuiz() {
  const res = await create({
    title: "Friday quiz",
    focusTopics: [
      { name: "Capital of Japan?", kind: "quiz", topics: ["Osaka", "Tokyo", "Kyoto"], correct: "Tokyo", seconds: 20 },
      { name: "2 + 2?", kind: "quiz", topics: ["3", "4"], correct: "4" },
      { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
    ],
    criteria: [],
  });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = await info(code);
  const [q1, q2, poll] = s.focusTopics;
  const opts = (id: string) => s.topics.filter((t) => t.focusId === id);
  return { code, s, q1, q2, poll, o1: opts(q1.id), o2: opts(q2.id) };
}
const answer = (code: string, focusId: string, voterId: string, topicId: string) => play(code, { action: "answer", focusId, voterId, topicId });
const join = (code: string, voterId: string, nickname: string) => play(code, { action: "join", voterId, nickname });

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("quiz@example.com")).cookie!;
  otherCookie = (await signUp("quiz-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("creating a quiz", () => {
  it("stores the timer; the right answer is only in the owner's copy", async () => {
    const { code, s, q1, q2 } = await newQuiz();
    expect(q1).toMatchObject({ kind: "quiz", seconds: 20, chart: "answers" });
    expect(q2.seconds).toBe(20); // default
    expect(JSON.stringify(s)).not.toMatch(/"correct"/);
    const owner = await ownerInfo(code);
    expect(owner.session.focusTopics.map((f) => f.correct)).toEqual([1, 1, null]);
  });

  it("needs a right answer that is one of the options, and a sensible timer", async () => {
    for (const f of [
      { name: "Q", kind: "quiz", topics: ["a", "b"] },
      { name: "Q", kind: "quiz", topics: ["a", "b"], correct: "c" },
      { name: "Q", kind: "quiz", topics: ["a"], correct: "a" },
      { name: "Q", kind: "quiz", topics: ["a", "b"], correct: "a", seconds: 3 },
      { name: "Q", kind: "quiz", topics: ["a", "b"], correct: "a", seconds: 121 },
    ]) {
      expect((await create({ title: "x", focusTopics: [f], criteria: [] })).status, JSON.stringify(f)).toBe(400);
    }
  });
});

describe("running a quiz", () => {
  it("refuses answers until the owner starts the question; phones see it start, without the answer", async () => {
    const { code, q1, o1 } = await newQuiz();
    const v = voter();
    expect((await answer(code, q1.id, v, o1[1].id)).status).toBe(409);
    expect((await status(code)).quiz).toBeNull();

    expect((await control(code, { action: "start", focusId: q1.id })).status).toBe(200);
    const st = await status(code);
    expect(st.quiz).toMatchObject({ focusId: q1.id, seconds: 20, correctTopicId: null });
    expect(Date.parse(st.quiz!.endsAt) - Date.parse(st.quiz!.startedAt)).toBe(20_000);
  });

  it("gives fast right answers more points, wrong ones none, and locks in the first answer", async () => {
    const { code, q1, o1 } = await newQuiz();
    await control(code, { action: "start", focusId: q1.id });
    const fast = voter();
    const wrong = voter();
    const slow = voter();
    await join(code, fast, "Speedy");
    await join(code, wrong, "Oops");
    await join(code, slow, "Snail");
    expect((await answer(code, q1.id, fast, o1[1].id)).status).toBe(200);
    expect((await answer(code, q1.id, wrong, o1[0].id)).status).toBe(200);
    expect((await answer(code, q1.id, fast, o1[0].id)).status).toBe(409); // already answered
    await elapse(15);
    expect((await answer(code, q1.id, slow, o1[1].id)).status).toBe(200);

    await elapse(10); // time is up
    expect((await answer(code, q1.id, voter(), o1[1].id)).status).toBe(409);
    expect((await status(code)).quiz?.correctTopicId).toBe(o1[1].id);

    const r = await results(code);
    // the presenter's screen can show the right answer once a question has been played
    expect(r.quizRevealed).toEqual([{ focusId: q1.id, topicId: o1[1].id }]);
    expect(r.leaderboard.map((p) => p.nickname)).toEqual(["Speedy", "Snail", "Oops"]);
    const [a, b, c] = r.leaderboard;
    expect(a.points).toBeGreaterThan(950);
    expect(b.points).toBeGreaterThanOrEqual(500);
    expect(b.points).toBeLessThan(700);
    expect(c).toMatchObject({ points: 0, correct: 0 });
    expect(r.quizCounts).toEqual(
      expect.arrayContaining([
        { focusId: q1.id, topicId: o1[1].id, n: 2 },
        { focusId: q1.id, topicId: o1[0].id, n: 1 },
      ]),
    );

    const mine = await me(code, fast);
    expect(mine).toMatchObject({ nickname: "Speedy", points: a.points, rank: 1, players: 3 });
    expect(mine.answers).toEqual([{ focusId: q1.id, topicId: o1[1].id, correct: true, points: a.points }]);
  });

  it("keeps the right answer and other people's results secret while the question runs", async () => {
    const { code, q1, o1 } = await newQuiz();
    await control(code, { action: "start", focusId: q1.id });
    const v = voter();
    await answer(code, q1.id, v, o1[1].id);
    expect((await me(code, v)).answers).toEqual([]);
    expect((await status(code)).quiz?.correctTopicId).toBeNull();
    expect((await results(code)).quizRevealed).toEqual([]);
  });

  it("lets the owner end a question early, move to the next, and stop the quiz", async () => {
    const { code, q1, q2, o2 } = await newQuiz();
    await control(code, { action: "start", focusId: q1.id });
    expect((await control(code, { action: "end" })).status).toBe(200);
    await elapse(3); // past the grace period
    expect((await status(code)).quiz?.correctTopicId).not.toBeNull();

    await control(code, { action: "start", focusId: q2.id });
    expect((await status(code)).quiz?.focusId).toBe(q2.id);
    expect((await answer(code, q2.id, voter(), o2[1].id)).status).toBe(200);

    await control(code, { action: "stop" });
    expect((await status(code)).quiz).toBeNull();
  });

  it("refuses control from anyone but the owner, non-quiz questions and closed voting", async () => {
    const { code, q1, poll, o1 } = await newQuiz();
    expect((await control(code, { action: "start", focusId: q1.id }, otherCookie)).status).toBe(404);
    expect((await control(code, { action: "start", focusId: poll.id })).status).toBe(400);
    await control(code, { action: "start", focusId: q1.id });
    await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ isOpen: false }) })), ctx(code));
    expect((await answer(code, q1.id, voter(), o1[1].id)).status).toBe(403);
  });

  it("checks nicknames", async () => {
    const { code } = await newQuiz();
    expect((await join(code, voter(), "   ")).status).toBe(400);
    expect((await join(code, voter(), "x".repeat(21))).status).toBe(400);
    const v = voter();
    expect((await join(code, v, "  Ann   Lee ")).status).toBe(200);
    expect((await join(code, v, "Ann L")).status).toBe(200); // can change it
    expect((await me(code, v)).nickname).toBe("Ann L");
  });
});

describe("results, exports, editing and reset", () => {
  it("counts players as people, exports choices and points, keeps settings on edit, and reset clears the quiz", async () => {
    const { code, q1, o1 } = await newQuiz();
    await control(code, { action: "start", focusId: q1.id });
    const v = voter();
    await join(code, v, "Ann");
    await answer(code, q1.id, v, o1[1].id);
    await answer(code, q1.id, voter(), o1[0].id);

    expect((await results(code)).voterCount).toBe(2);
    const list = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, authed()))).json()) as { sessions: AdminSessionRow[] };
    expect(list.sessions[0].voterCount).toBe(2);

    const summary = await csv(code, "summary");
    expect(summary).toContain("Capital of Japan?,Tokyo,Right answer,,1");
    expect(summary).toContain("Capital of Japan?,Osaka,Quiz choice,,1");
    const raw = (await csv(code, "raw")).join("\n");
    expect(raw).toMatch(/Capital of Japan\?,Tokyo,Quiz answer,\d+/);
    expect(raw).not.toContain(v);

    const owner = (await ownerInfo(code)).session;
    const body = {
      title: owner.session.title,
      scaleMax: owner.session.scaleMax,
      lowLabel: owner.session.lowLabel,
      highLabel: owner.session.highLabel,
      focusTopics: owner.focusTopics.map((f) => {
        const topics = owner.topics.filter((t) => t.focusId === f.id).map((t) => ({ id: t.id, name: t.name }));
        return {
          id: f.id,
          name: f.name,
          kind: f.kind,
          chart: f.chart,
          topics,
          correct: f.kind === "quiz" ? (f.id === q1.id ? "Osaka" : topics[f.correct ?? 0].name) : undefined,
          seconds: f.kind === "quiz" ? 30 : undefined,
        };
      }),
      criteria: [],
    };
    expect((await adminSession.PUT(new Request(`${ORIGIN}/x`, authed({ method: "PUT", body: JSON.stringify(body) })), ctx(code))).status).toBe(200);
    const after = (await ownerInfo(code)).session.focusTopics[0];
    expect(after).toMatchObject({ correct: 0, seconds: 30 });

    await resetRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST" })), ctx(code));
    expect(await results(code)).toMatchObject({ voterCount: 0, quizCounts: [], leaderboard: [], quiz: null });
  });
});

describe("database schema", () => {
  it("can be run again on a database that already holds every question type", async () => {
    await newQuiz();
    await create({ title: "All kinds", criteria: [], focusTopics: [{ name: "Ask", kind: "qa" }, { name: "N", kind: "number" }] });
    await expect(db.exec(readFileSync("db/schema.sql", "utf8"))).resolves.toBeDefined();
  });
});
