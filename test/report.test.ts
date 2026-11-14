// The report: every question's results with a short analysis, the AI summary and the open point list,
// on one print-ready page that saves as a PDF.
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as reportRoute from "@/app/api/admin/sessions/[code]/report/route";
import * as pointsRoute from "@/app/api/admin/sessions/[code]/points/route";
import * as aiRoute from "@/app/api/admin/sessions/[code]/ai/route";
import * as textRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as voteRoute from "@/app/api/vote/route";
import { aiReplies } from "@/lib/ai";
import { buildReport, type Report } from "@/lib/report";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const MIX: SessionPayload = {
  session: { code: "abc123", title: "Mix", scaleMax: 5, lowLabel: "Low", highLabel: "High", isOpen: false, revision: 0, theme: "midnight", decor: true },
  focusTopics: [
    { id: "p", name: "Lunch?", kind: "poll", chart: "bars", description: "For Friday", imageId: "pic-q" },
    { id: "m", name: "Perks", kind: "multi", chart: "bars" },
    { id: "r", name: "Order", kind: "rank", chart: "list" },
    { id: "n", name: "How many?", kind: "number", chart: "histogram", min: 0, max: 10, unit: "people" },
    { id: "w", name: "One word", kind: "words", chart: "cloud" },
    { id: "q", name: "Ask us", kind: "qa", chart: "top" },
    { id: "z", name: "Capital of Japan?", kind: "quiz", chart: "stage" },
    { id: "t", name: "Anything else?", kind: "text", chart: "wall" },
    { id: "e", name: "Nobody answered this", kind: "poll", chart: "bars" },
  ],
  topics: [
    { id: "p1", name: "Pizza", focusId: "p", imageId: "pic-1" },
    { id: "p2", name: "Sushi", focusId: "p" },
    { id: "m1", name: "Gym", focusId: "m" },
    { id: "m2", name: "Lunch", focusId: "m" },
    { id: "r1", name: "Speed", focusId: "r" },
    { id: "r2", name: "Quality", focusId: "r" },
    { id: "z1", name: "Osaka", focusId: "z" },
    { id: "z2", name: "Tokyo", focusId: "z" },
    { id: "e1", name: "Yes", focusId: "e" },
    { id: "e2", name: "No", focusId: "e" },
  ],
  criteria: [],
};
const MIX_RESULTS: ResultsPayload = {
  isOpen: false,
  voterCount: 5,
  cells: [],
  dist: [],
  polls: [
    { focusId: "p", topicId: "p1", n: 3 },
    { focusId: "p", topicId: "p2", n: 1 },
    { focusId: "m", topicId: "m1", n: 2 },
    { focusId: "m", topicId: "m2", n: 3 },
  ],
  words: [{ focusId: "w", word: "busy", n: 2 }, { focusId: "w", word: "calm", n: 1 }],
  ranks: [
    { focusId: "r", topicId: "r1", rank: 1, n: 2 },
    { focusId: "r", topicId: "r1", rank: 2, n: 1 },
    { focusId: "r", topicId: "r2", rank: 1, n: 1 },
    { focusId: "r", topicId: "r2", rank: 2, n: 2 },
  ],
  numbers: [{ focusId: "n", value: 4, n: 2 }, { focusId: "n", value: 10, n: 1 }],
  texts: [
    { id: "t1", focusId: "t", hidden: false, text: "More breaks", at: "2026-11-14T10:00:00.000Z" },
    { id: "t2", focusId: "t", hidden: true, text: "HIDDEN-ANSWER", at: "2026-11-14T10:01:00.000Z" },
  ],
  respondents: [{ focusId: "m", n: 3 }, { focusId: "r", n: 3 }, { focusId: "n", n: 3 }, { focusId: "t", n: 2 }, { focusId: "q", n: 4 }],
  questions: [
    { id: "q1", focusId: "q", text: "When is the release?", votes: 4, answered: false, hidden: false, at: "2026-11-14T10:00:00.000Z" },
    { id: "q2", focusId: "q", text: "Is lunch free?", votes: 1, answered: true, hidden: false, at: "2026-11-14T10:02:00.000Z" },
    { id: "q3", focusId: "q", text: "HIDDEN-QUESTION", votes: 9, answered: false, hidden: true, at: "2026-11-14T10:01:00.000Z" },
  ],
  quizCounts: [{ focusId: "z", topicId: "z1", n: 1 }, { focusId: "z", topicId: "z2", n: 2 }],
  quizRevealed: [{ focusId: "z", topicId: "z2" }],
  leaderboard: [{ nickname: "Ann", points: 900, correct: 1 }],
  quiz: null,
  revision: 0,
};

describe("the report's analysis", () => {
  const report = buildReport(MIX, MIX_RESULTS);
  const section = (id: string) => report.sections.find((s) => s.focusId === id)!;

  it("has one section per question, in order, with its type, description and picture", () => {
    expect(report.title).toBe("Mix");
    expect(report.people).toBe(5);
    expect(report.sections.map((s) => [s.index, s.kindLabel, s.name])).toEqual([
      [1, "Pick one", "Lunch?"],
      [2, "Pick several", "Perks"],
      [3, "Put in order", "Order"],
      [4, "Number", "How many?"],
      [5, "Word cloud", "One word"],
      [6, "Audience Q&A", "Ask us"],
      [7, "Quiz", "Capital of Japan?"],
      [8, "Open answer", "Anything else?"],
      [9, "Pick one", "Nobody answered this"],
    ]);
    expect(section("p")).toMatchObject({ description: "For Friday", imageId: "pic-q" });
  });

  it("Pick one: every option with its share, the top answer named", () => {
    const s = section("p");
    expect(s.rows).toEqual([
      { name: "Pizza", imageId: "pic-1", value: "75%", detail: "3 votes", pct: 75, tag: "Top answer" },
      { name: "Sushi", imageId: null, value: "25%", detail: "1 vote", pct: 25 },
    ]);
    expect(s.highlights).toEqual(["Pizza is the top answer with 75% (3 of 4 votes)."]);
    expect(s.people).toBe(4);
    expect(s.share).toBe(80);
  });

  it("says so when nobody answered, and calls a tie a tie", () => {
    expect(section("e").highlights).toEqual(["No answers yet."]);
    const tied = buildReport(MIX, { ...MIX_RESULTS, polls: [{ focusId: "p", topicId: "p1", n: 2 }, { focusId: "p", topicId: "p2", n: 2 }] });
    expect(tied.sections[0].highlights).toEqual(["Pizza and Sushi are tied at 50% each."]);
    expect(tied.sections[0].rows.map((r) => r.tag)).toEqual([undefined, undefined]);
  });

  it("Pick several, Put in order and Number get their own findings", () => {
    expect(section("m").highlights).toEqual(["Lunch was picked most: by 100% of the 3 people who answered."]);
    expect(section("m").rows.map((r) => [r.name, r.value])).toEqual([["Lunch", "100%"], ["Gym", "67%"]]);
    expect(section("r").highlights).toEqual(["Speed comes first, with an average place of 1.3.", "Quality comes last (1.7)."]);
    expect(section("n").highlights).toEqual(["The average is 6 people and the middle value is 4 people.", "Answers run from 4 to 10."]);
    expect(section("n").rows.map((r) => [r.name, r.value, r.pct])).toEqual([
      ["Average", "6 people", null],
      ["Middle value", "4 people", null],
      ["Lowest", "4 people", null],
      ["Highest", "10 people", null],
    ]);
  });

  it("Word cloud, Q&A and Open answers list what people wrote, without hidden ones", () => {
    expect(section("w").highlights).toEqual(["Most said: busy (2) and calm (1)."]);
    expect(section("q").texts).toEqual(["When is the release? (4 upvotes)", "✓ Answered: Is lunch free? (1 upvote)"]);
    expect(section("q").highlights).toEqual(["2 questions, 1 answered.", "Most upvoted and still open: “When is the release?” (4 upvotes)."]);
    expect(section("t").texts).toEqual(["More breaks"]);
    expect(section("t").note).toBe("1 answer hidden by the presenter is left out.");
    expect(JSON.stringify(report)).not.toMatch(/HIDDEN-ANSWER|HIDDEN-QUESTION/);
  });

  it("Quiz: how many got it right, and the leaderboard", () => {
    expect(section("z").highlights).toEqual(["67% got it right (2 of 3). The right answer is Tokyo."]);
    expect(section("z").rows.find((r) => r.name === "Tokyo")?.tag).toBe("Right answer");
    expect(report.leaderboard).toEqual([{ nickname: "Ann", points: 900, correct: 1 }]);
  });

  it("opens with key findings: who took part, each question's lead finding, and questions few people answered", () => {
    expect(report.findings[0]).toBe("5 people took part in 9 questions.");
    expect(report.findings).toContain("Lunch?: Pizza is the top answer with 75% (3 of 4 votes).");
    expect(report.findings).toContain("Fewest answers: “Anything else?” (2 of 5 people).");
    expect(report.findings.join(" ")).not.toContain("Nobody answered this: No answers");
    expect(report.findings).toContain("Nobody answered “Nobody answered this”.");
  });
});

describe("Score items in the report", () => {
  const info: SessionPayload = {
    session: { code: "abc123", title: "Retro", scaleMax: 5, lowLabel: "Low", highLabel: "High", isOpen: true, revision: 0, theme: "paper", decor: true },
    focusTopics: [{ id: "f", name: "How did it go?", kind: "rating", chart: "heatmap" }],
    topics: [
      { id: "a", name: "Planning", focusId: "f", description: "Sprint planning meeting" },
      { id: "b", name: "Testing", focusId: "f" },
    ],
    criteria: [{ id: "c1", name: "Went well" }, { id: "c2", name: "Matters" }],
  };
  const cell = (topicId: string, criterionId: string, n: number, sum: number) => ({ topicId, criterionId, n, sum });
  const r: ResultsPayload = {
    ...MIX_RESULTS,
    voterCount: 4,
    polls: [],
    respondents: [{ focusId: "f", n: 4 }],
    cells: [cell("a", "c1", 4, 20), cell("a", "c2", 4, 16), cell("b", "c1", 4, 8), cell("b", "c2", 4, 8)],
    dist: [
      { topicId: "a", criterionId: "c1", score: 5, n: 4 },
      { topicId: "a", criterionId: "c2", score: 4, n: 4 },
      { topicId: "b", criterionId: "c1", score: 2, n: 4 },
      { topicId: "b", criterionId: "c2", score: 2, n: 4 },
    ],
  };
  const report = buildReport(info, r);

  it("lists items best first with each measure's average, tags best and lowest, and flags what needs attention", () => {
    const [s] = report.sections;
    expect(s.rows).toEqual([
      { name: "Planning", imageId: null, description: "Sprint planning meeting", value: "4.5", detail: "Went well 5.0 · Matters 4.0 · 4 answers", pct: 90, tag: "Best" },
      { name: "Testing", imageId: null, description: null, value: "2.0", detail: "Went well 2.0 · Matters 2.0 · 4 answers", pct: 40, tag: "Lowest" },
    ]);
    expect(s.highlights[0]).toBe("Planning leads with 4.5 out of 5, 2.5 ahead of Testing.");
    expect(s.highlights.join(" ")).toContain("Testing ranks last at 2.0");
    expect(report.attention).toEqual([{ title: "Low score: Testing", reason: "Scored 2.0 out of 5 in “How did it go?” (4 answers)." }]);
  });
});

describe("GET /api/admin/sessions/[code]/report", () => {
  let db: PGlite;
  let cookie = "";
  let otherCookie = "";
  const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
  const authed = (init: RequestInit = {}, as = cookie) => ({
    ...init,
    headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const getReport = (code: string, as: string | null = cookie) =>
    reportRoute.GET(new Request(`${ORIGIN}/x`, as === null ? {} : { headers: { cookie: as } }), ctx(code));

  beforeAll(async () => {
    db = await startTestDb();
    cookie = (await signUp("report@example.com")).cookie!;
    otherCookie = (await signUp("report-other@example.com")).cookie!;
  });
  beforeEach(async () => {
    await db.exec("truncate sessions, ai_usage cascade");
    process.env.AI_TRANSPORT = "memory";
    process.env.GEMINI_API_KEY = "test-key";
    aiReplies.length = 0;
  });

  async function retro() {
    const res = await adminSessions.POST(
      new Request(
        `${ORIGIN}/x`,
        authed({
          method: "POST",
          body: JSON.stringify({
            title: "Sprint retro",
            focusTopics: [
              { name: "How did it go?", kind: "rating", topics: ["Planning", "Testing"] },
              { name: "What should change?", kind: "text" },
            ],
            criteria: ["Went well"],
          }),
        }),
      ),
    );
    const { code } = (await res.json()) as { code: string };
    const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
    for (let i = 0; i < 3; i++) {
      const v = crypto.randomUUID();
      for (const [topic, score] of [[s.topics[0], 5], [s.topics[1], 2]] as const)
        await voteRoute.POST(new Request(`${ORIGIN}/api/vote`, { method: "POST", body: JSON.stringify({ code, topicId: topic.id, criterionId: s.criteria[0].id, voterId: v, score }) }));
      await answerRoute.POST(
        new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify({ kind: "text", code, focusId: s.focusTopics[1].id, voterId: v, text: i === 0 ? "RUDE-HIDDEN thing" : `Idea ${i}` }) }),
      );
    }
    return { code, s };
  }

  it("is for the owner only", async () => {
    const { code } = await retro();
    expect((await getReport(code, null)).status).toBe(401);
    expect((await getReport(code, otherCookie)).status).toBe(404);
    const res = await getReport(code);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("carries the results, the analysis, the open points and the saved AI summary", async () => {
    const { code, s } = await retro();
    // hide one answer, add an open point, save an AI summary
    const results = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
    const rude = results.texts.find((t) => t.text.includes("RUDE-HIDDEN"))!;
    await textRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ id: rude.id, hidden: true }) })), ctx(code));
    await pointsRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify({ title: "Fix the flaky tests", assignee: "Ravi", due: "2026-12-01" }) })), ctx(code));
    await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ aiEnabled: true }) })), ctx(code));
    aiReplies.push({ headline: "Testing hurts", summary: "Planning is fine, testing is not.", questions: [{ index: 1, insight: "Testing is the low point." }], actions: ["Fix tests"] });
    await aiRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify({ action: "overview" }) })), ctx(code));

    const report = (await (await getReport(code)).json()) as Report;
    expect(report.title).toBe("Sprint retro");
    expect(report.code).toBe(code);
    expect(report.people).toBe(3);
    expect(report.sections.map((x) => x.name)).toEqual(["How did it go?", "What should change?"]);
    expect(report.sections[0].rows.map((x) => [x.name, x.value, x.tag])).toEqual([["Planning", "5.0", "Best"], ["Testing", "2.0", "Lowest"]]);
    expect(report.sections[0].insight).toBe("Testing is the low point.");
    expect(report.sections[1].texts.sort()).toEqual(["Idea 1", "Idea 2"]);
    expect(JSON.stringify(report)).not.toContain("RUDE-HIDDEN");
    expect(report.attention.map((a) => a.title)).toEqual(["Low score: Testing"]);
    expect(report.points.map((p) => [p.number, p.title, p.assignee, p.due, p.status])).toEqual([[1, "Fix the flaky tests", "Ravi", "2026-12-01", "open"]]);
    expect(report.ai).toMatchObject({ headline: "Testing hurts", summary: "Planning is fine, testing is not.", actions: ["Fix tests"], people: 3 });
    expect(report.generatedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(s.focusTopics).toHaveLength(2);
  });
});

describe("the report page", () => {
  it("is a per-request page for the signed-in owner that prints", () => {
    const page = read("app/admin/report/[code]/page.tsx");
    expect(page).toContain('dynamic = "force-dynamic"');
    expect(page).toMatch(/<ReportApp\b/);
    const app = read("components/admin/ReportApp.tsx");
    expect(app).toContain("window.print()");
    expect(app).toContain("Save as PDF");
    expect(app).toMatch(/\/api\/admin\/sessions\/.*\/report/);
    // pictures must be loaded before printing, so they aren't lazy here
    expect(app).toMatch(/<Picture\b[^>]*\beager\b/);
  });

  it("has print rules: no buttons, white paper, sections kept together", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/@media print/);
    expect(css).toMatch(/\.no-print/);
    expect(css).toMatch(/break-inside:\s*avoid/);
    expect(css).toMatch(/print-color-adjust:\s*exact/);
  });

  it("is one tap away from the presentation card and the results screen", () => {
    expect(read("components/admin/SessionCard.tsx")).toContain("/admin/report/");
    expect(read("components/DashboardApp.tsx")).toContain("/admin/report/");
  });
});
