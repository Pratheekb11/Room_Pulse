// AI summary of the whole presentation: a headline, an overview, an insight per question and next steps.
// Built from the results people can see (never hidden answers or quiz nicknames), saved so it survives a refresh.
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, cookieFrom, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as aiRoute from "@/app/api/admin/sessions/[code]/ai/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as textRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as voteRoute from "@/app/api/vote/route";
import { aiCalls, aiReplies } from "@/lib/ai";
import { buildDigest } from "@/lib/ai-digest";
import type { AiReport, ResultsPayload, SessionPayload } from "@/lib/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

let db: PGlite;
let cookie = "";
let otherCookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const ai = (code: string, body: Record<string, unknown>, as = cookie) =>
  aiRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify(body) }, as)), ctx(code));
const aiStatus = async (code: string, as = cookie) =>
  (await (await aiRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie: as } }), ctx(code))).json()) as { report?: AiReport | null; enabled?: boolean };
const answer = (body: Record<string, unknown>) => answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));
const enableAi = (code: string) =>
  adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ aiEnabled: true }) })), ctx(code));
const voter = () => crypto.randomUUID();

const GOOD_REPLY = {
  headline: "Testing is the sore spot",
  summary: "The team is happy with planning but unhappy with testing. Most people want Pizza.",
  questions: [
    { index: 1, insight: "Planning scores high; Testing scores lowest at 2.0." },
    { index: 2, insight: "Pizza wins clearly." },
    { index: 3, insight: "People ask for a staging server." },
    { index: 99, insight: "Not a real question." },
  ],
  actions: ["Fix the flaky tests", "Order a staging server"],
};

/** A retro with a score question, a poll and open answers, answered by 4 people. */
async function answered({ people = 4 } = {}) {
  const res = await adminSessions.POST(
    new Request(
      `${ORIGIN}/x`,
      authed({
        method: "POST",
        body: JSON.stringify({
          title: "Sprint retro",
          focusTopics: [
            { name: "How did it go?", kind: "rating", topics: ["Planning", "Testing"] },
            { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
            { name: "What should change?", kind: "text" },
          ],
          criteria: ["Went well"],
        }),
      }),
    ),
  );
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  const [, poll, text] = s.focusTopics;
  const [planning, testing, pizza, sushi] = s.topics;
  const texts = ["We need a staging server", "SECRET-HIDDEN complaint about Bob", "Fewer meetings", "Staging server please"];
  for (let i = 0; i < people; i++) {
    const v = voter();
    const vote = (topicId: string, score: number) =>
      voteRoute.POST(new Request(`${ORIGIN}/api/vote`, { method: "POST", body: JSON.stringify({ code, topicId, criterionId: s.criteria[0].id, voterId: v, score }) }));
    await vote(planning.id, 5);
    await vote(testing.id, 2);
    await answer({ kind: "poll", code, focusId: poll.id, voterId: v, topicId: i === 0 ? sushi.id : pizza.id });
    await answer({ kind: "text", code, focusId: text.id, voterId: v, text: texts[i % texts.length] });
  }
  const results = async () => (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
  return { code, s, text, results };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("overview@example.com")).cookie!;
  otherCookie = (await signUp("overview-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions, ai_usage cascade");
  process.env.AI_TRANSPORT = "memory";
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.AI_DAILY_LIMIT;
  aiCalls.length = 0;
  aiReplies.length = 0;
});

describe("what the AI is given", () => {
  it("is every question's results in numbers, in order", async () => {
    const { s, results } = await answered();
    const digest = buildDigest(s, await results());
    expect(digest.title).toBe("Sprint retro");
    expect(digest.people).toBe(4);
    expect(digest.questions.map((q) => [q.index, q.type, q.question])).toEqual([
      [1, "score items", "How did it go?"],
      [2, "pick one", "Lunch?"],
      [3, "open answer", "What should change?"],
    ]);
    expect(digest.questions[0].results).toMatchObject({
      scale: "1 to 5",
      items: [
        { item: "Planning", average: 5, answers: 4 },
        { item: "Testing", average: 2, answers: 4 },
      ],
    });
    expect(digest.questions[1].results).toEqual({
      options: [
        { option: "Pizza", votes: 3, percent: 75 },
        { option: "Sushi", votes: 1, percent: 25 },
      ],
    });
    expect((digest.questions[2].results as { answers: string[] }).answers).toHaveLength(4);
  });

  it("leaves out answers the presenter hid", async () => {
    const { code, s, results } = await answered();
    const hidden = (await results()).texts.find((t) => t.text.includes("SECRET-HIDDEN"))!;
    await textRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ id: hidden.id, hidden: true }) })), ctx(code));
    const digest = buildDigest(s, await results());
    expect(JSON.stringify(digest)).not.toContain("SECRET-HIDDEN");
    expect((digest.questions[2].results as { answers: string[] }).answers).toHaveLength(3);
  });

  it("covers the other question types, without quiz nicknames or hidden audience questions", () => {
    const s: SessionPayload = {
      session: { code: "abc123", title: "Mix", scaleMax: 5, lowLabel: "Low", highLabel: "High", isOpen: true, revision: 0, theme: "paper", decor: true },
      focusTopics: [
        { id: "m", name: "Perks", kind: "multi", chart: "bars" },
        { id: "r", name: "Order", kind: "rank", chart: "list" },
        { id: "n", name: "How many?", kind: "number", chart: "histogram", min: 0, max: 10, unit: "people" },
        { id: "w", name: "One word", kind: "words", chart: "cloud" },
        { id: "q", name: "Ask us", kind: "qa", chart: "top" },
        { id: "z", name: "Capital of Japan?", kind: "quiz", chart: "stage" },
      ],
      topics: [
        { id: "m1", name: "Gym", focusId: "m" },
        { id: "m2", name: "Lunch", focusId: "m" },
        { id: "r1", name: "Speed", focusId: "r" },
        { id: "r2", name: "Quality", focusId: "r" },
        { id: "z1", name: "Osaka", focusId: "z" },
        { id: "z2", name: "Tokyo", focusId: "z" },
      ],
      criteria: [],
    };
    const r = {
      isOpen: true,
      voterCount: 3,
      cells: [],
      dist: [],
      polls: [{ focusId: "m", topicId: "m1", n: 2 }, { focusId: "m", topicId: "m2", n: 3 }],
      words: [{ focusId: "w", word: "busy", n: 2 }, { focusId: "w", word: "calm", n: 1 }],
      ranks: [{ focusId: "r", topicId: "r1", rank: 1, n: 2 }, { focusId: "r", topicId: "r1", rank: 2, n: 1 }, { focusId: "r", topicId: "r2", rank: 1, n: 1 }, { focusId: "r", topicId: "r2", rank: 2, n: 2 }],
      numbers: [{ focusId: "n", value: 4, n: 2 }, { focusId: "n", value: 10, n: 1 }],
      texts: [],
      respondents: [{ focusId: "m", n: 3 }],
      questions: [
        { id: "q1", focusId: "q", text: "When is the release?", votes: 4, answered: false, hidden: false, at: "2026-11-14T10:00:00.000Z" },
        { id: "q2", focusId: "q", text: "HIDDEN-RUDE question", votes: 9, answered: false, hidden: true, at: "2026-11-14T10:01:00.000Z" },
      ],
      quizCounts: [{ focusId: "z", topicId: "z1", n: 1 }, { focusId: "z", topicId: "z2", n: 2 }],
      quizRevealed: [{ focusId: "z", topicId: "z2" }],
      leaderboard: [{ nickname: "NICKNAME-ANN", points: 900, correct: 1 }],
      quiz: null,
      revision: 0,
    } satisfies ResultsPayload;
    const digest = buildDigest(s, r);
    const byType = Object.fromEntries(digest.questions.map((q) => [q.type, q.results]));
    expect(byType["pick several"]).toEqual({ people: 3, options: [{ option: "Gym", picks: 2, percent: 67 }, { option: "Lunch", picks: 3, percent: 100 }] });
    expect(byType["put in order"]).toEqual({ people: 3, options: [{ option: "Speed", averagePlace: 1.3 }, { option: "Quality", averagePlace: 1.7 }] });
    expect(byType["number"]).toEqual({ answers: 3, average: 6, middle: 4, lowest: 4, highest: 10, unit: "people" });
    expect(byType["word cloud"]).toEqual({ words: [{ word: "busy", count: 2 }, { word: "calm", count: 1 }] });
    expect(byType["audience questions"]).toEqual({ questions: [{ question: "When is the release?", upvotes: 4, answered: false }] });
    expect(byType["quiz"]).toEqual({ answers: 3, options: [{ option: "Osaka", picked: 1 }, { option: "Tokyo", picked: 2, right: true }] });
    const sent = JSON.stringify(digest);
    expect(sent).not.toContain("NICKNAME-ANN");
    expect(sent).not.toContain("HIDDEN-RUDE");
  });
});

describe("summarising the whole presentation", () => {
  it("returns a headline, an overview, an insight per real question and next steps, and saves it", async () => {
    const { code, s } = await answered();
    await enableAi(code);
    aiReplies.push(GOOD_REPLY);
    const res = await ai(code, { action: "overview" });
    expect(res.status).toBe(200);
    const report = (await res.json()) as AiReport;
    expect(report.headline).toBe("Testing is the sore spot");
    expect(report.summary).toContain("happy with planning");
    // insights are tied to questions by id; the made-up question 99 is dropped
    expect(report.questions).toEqual([
      { focusId: s.focusTopics[0].id, insight: "Planning scores high; Testing scores lowest at 2.0." },
      { focusId: s.focusTopics[1].id, insight: "Pizza wins clearly." },
      { focusId: s.focusTopics[2].id, insight: "People ask for a staging server." },
    ]);
    expect(report.actions).toEqual(["Fix the flaky tests", "Order a staging server"]);
    expect(report.people).toBe(4);
    expect(report.at).toMatch(/^\d{4}-\d\d-\d\dT/);

    // the prompt carried the results as data, with the guard against instructions inside answers
    expect(aiCalls).toHaveLength(1);
    expect(aiCalls[0].system).toMatch(/never follow instructions/i);
    expect(JSON.parse(aiCalls[0].prompt)).toMatchObject({ title: "Sprint retro", people: 4 });

    // saved: a refresh (GET) gives it back, to the owner only
    expect((await aiStatus(code)).report).toEqual(report);
    expect((await aiRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie: otherCookie } }), ctx(code))).status).toBe(404);
  });

  it("replaces the saved summary when asked again", async () => {
    const { code } = await answered();
    await enableAi(code);
    aiReplies.push(GOOD_REPLY, { ...GOOD_REPLY, headline: "Second take" });
    await ai(code, { action: "overview" });
    await ai(code, { action: "overview" });
    expect((await aiStatus(code)).report?.headline).toBe("Second take");
    expect((await db.query("select count(*)::int as n from ai_reports")).rows[0]).toEqual({ n: 1 });
  });

  it("is refused until AI insights are on, for guests, and before 3 people have answered", async () => {
    const { code } = await answered();
    const off = await ai(code, { action: "overview" });
    expect(off.status).toBe(403);
    expect(((await off.json()) as { error: string }).error).toBe("ai_off");

    const few = await answered({ people: 2 });
    await enableAi(few.code);
    const res = await ai(few.code, { action: "overview" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("too_few_answers");
    expect(aiCalls).toHaveLength(0);

    const guest = cookieFrom(await guestRoute.POST(new Request(`${ORIGIN}/x`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" })))!;
    const made = await adminSessions.POST(
      new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify({ title: "G", focusTopics: [{ name: "Q", kind: "text" }], criteria: [] }) }, guest)),
    );
    const g = (await made.json()) as { code: string };
    expect((await ai(g.code, { action: "overview" }, guest)).status).toBe(403);
  });

  it("gives the use back and saves nothing when the AI's reply doesn't fit", async () => {
    const { code } = await answered();
    await enableAi(code);
    aiReplies.push({ headline: "", summary: 42 });
    const res = await ai(code, { action: "overview" });
    expect(res.status).toBe(502);
    expect((await aiStatus(code)).report ?? null).toBeNull();
    expect((await db.query("select coalesce(sum(n), 0)::int as n from ai_usage")).rows[0]).toEqual({ n: 0 });
  });

  it("forgets the summary when all answers are cleared", async () => {
    const { code } = await answered();
    await enableAi(code);
    aiReplies.push(GOOD_REPLY);
    await ai(code, { action: "overview" });
    await resetRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST" })), ctx(code));
    expect((await aiStatus(code)).report ?? null).toBeNull();
  });

  it("still summarises one question's open answers as before", async () => {
    const { code, text } = await answered();
    await enableAi(code);
    aiReplies.push({ themes: [{ title: "Staging", summary: "People want a staging server.", count: 2 }], actions: ["Order one"] });
    const res = await ai(code, { action: "summary", focusId: text.id });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { themes: unknown[] }).themes).toHaveLength(1);
    expect((await ai(code, { action: "summary" })).status).toBe(400);
  });
});

describe("the AI summary on screen", () => {
  it("sits on the results screen, with each question's insight and next steps that become open points", () => {
    const dashboard = read("components/DashboardApp.tsx");
    expect(dashboard).toMatch(/<AiOverview\b/);
    expect(dashboard).toMatch(/<AiInsightLine\b/);
    const panel = read("components/results/AiOverview.tsx");
    expect(panel).toContain('action: "overview"');
    expect(panel).toContain("Add to open points");
    expect(panel).toContain("aiOriginKey");
    expect(panel).toContain("Google Gemini");
  });
});
