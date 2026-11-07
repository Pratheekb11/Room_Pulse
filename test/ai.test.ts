// AI insights (Gemini): off unless the owner switches them on, accounts only, capped per day.
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, cookieFrom, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as aiRoute from "@/app/api/admin/sessions/[code]/ai/route";
import * as draftRoute from "@/app/api/admin/ai/questions/route";
import * as textRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as qaRoute from "@/app/api/qa/[code]/route";
import { aiCalls, aiReplies } from "@/lib/ai";
import { createSessionSchema } from "@/lib/validation";
import { planToBody } from "@/lib/templates";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const ai = (code: string, body: Record<string, unknown>, as = cookie) =>
  aiRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify(body) }, as)), ctx(code));
const aiStatus = async (code: string, as = cookie) =>
  (await aiRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie: as } }), ctx(code))).json() as Promise<Record<string, unknown>>;
const draft = (prompt: string, as = cookie) =>
  draftRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify({ prompt }) }, as)));
const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));
const enableAi = (code: string, as = cookie) =>
  adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ aiEnabled: true }) }, as)), ctx(code));
const guestCookie = async () =>
  cookieFrom(await guestRoute.POST(new Request(`${ORIGIN}/x`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" })))!;

async function retro(as = cookie) {
  const res = await adminSessions.POST(
    new Request(
      `${ORIGIN}/x`,
      authed(
        {
          method: "POST",
          body: JSON.stringify({
            title: "Retro",
            focusTopics: [
              { name: "What should we change?", kind: "text" },
              { name: "Questions?", kind: "qa" },
            ],
            criteria: [],
          }),
        },
        as,
      ),
    ),
  );
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  return { code, text: s.focusTopics[0], qa: s.focusTopics[1] };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("ai@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions, ai_usage cascade");
  process.env.AI_TRANSPORT = "memory";
  process.env.GEMINI_API_KEY = "test-key";
  delete process.env.AI_DAILY_LIMIT;
  aiCalls.length = 0;
  aiReplies.length = 0;
});
afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("summarising open answers", () => {
  it("is refused until the owner switches AI insights on, and sends nothing", async () => {
    const { code, text } = await retro();
    await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: "More pairing" });
    const res = await ai(code, { action: "summary", focusId: text.id });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "ai_off" });
    expect(aiCalls).toHaveLength(0);
    expect(await aiStatus(code)).toMatchObject({ enabled: false, available: true });
  });

  it("groups answers into themes and next steps, without hidden answers", async () => {
    const { code, text } = await retro();
    await enableAi(code);
    for (const t of ["More pairing", "Pair more often", "Shorter standups", "secret rude thing"])
      await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: t });
    const r = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
    const rude = r.texts.find((t) => t.text === "secret rude thing")!;
    await textRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ id: rude.id, hidden: true }) })), ctx(code));

    aiReplies.push({
      themes: [
        { title: "Pairing", summary: "People want to pair more.", count: 2 },
        { title: "Standups", summary: "Standups run long.", count: 1 },
      ],
      actions: ["Try pairing twice a week", "Timebox standups to 10 minutes"],
    });
    const res = await ai(code, { action: "summary", focusId: text.id });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { themes: { title: string }[]; actions: string[]; answers: number };
    expect(body.themes.map((t) => t.title)).toEqual(["Pairing", "Standups"]);
    expect(body.actions).toHaveLength(2);
    expect(body.answers).toBe(3);
    expect(aiCalls).toHaveLength(1);
    expect(aiCalls[0].prompt).toContain("Pair more often");
    expect(aiCalls[0].prompt).toContain("What should we change?");
    expect(aiCalls[0].prompt).not.toContain("secret rude thing");
  });

  it("needs at least 3 answers before it's worth asking", async () => {
    const { code, text } = await retro();
    await enableAi(code);
    await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: "Only one" });
    const res = await ai(code, { action: "summary", focusId: text.id });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "too_few_answers" });
    expect(aiCalls).toHaveLength(0);
  });

  it("says so when the AI's reply doesn't fit, without using up the day's allowance", async () => {
    const { code, text } = await retro();
    await enableAi(code);
    for (const t of ["a", "b", "c"]) await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: t });
    aiReplies.push({ nonsense: true });
    const res = await ai(code, { action: "summary", focusId: text.id });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "ai_failed" });
    expect(await aiStatus(code)).toMatchObject({ remaining: 20 });
  });
});

describe("spotting duplicate audience questions", () => {
  it("returns groups of questions that ask the same thing, only with real ids", async () => {
    const { code, qa } = await retro();
    await enableAi(code);
    const ids: string[] = [];
    for (const t of ["When is the launch?", "What's the launch date?", "Will there be pizza?"]) {
      const res = await qaRoute.POST(
        new Request(`${ORIGIN}/x`, { method: "POST", body: JSON.stringify({ action: "ask", focusId: qa.id, voterId: crypto.randomUUID(), text: t }) }),
        ctx(code),
      );
      ids.push(((await res.json()) as { id: string }).id);
    }
    aiReplies.push({ groups: [[ids[0], ids[1]], [ids[2], crypto.randomUUID()]] });
    const res = await ai(code, { action: "duplicates", focusId: qa.id });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { groups: string[][] }).groups).toEqual([[ids[0], ids[1]]]);
    expect(aiCalls[0].prompt).toContain(ids[0]);
  });
});

describe("drafting questions", () => {
  it("turns a short description into a presentation the builder can load", async () => {
    aiReplies.push({
      title: "Sprint 12 retro",
      questions: [
        { kind: "poll", name: "How did the sprint go?", options: ["Great", "Okay", "Rough"] },
        { kind: "text", name: "What slowed you down?" },
        { kind: "number", name: "Rate the sprint", min: 1, max: 10 },
        { kind: "quiz", name: "Dropped: quizzes need a right answer", options: ["a", "b"] },
      ],
    });
    const res = await draft("retro for sprint 12 of the payments team");
    expect(res.status).toBe(200);
    const { plan } = (await res.json()) as { plan: { title: string; questions: { kind: string }[] } };
    expect(plan.title).toBe("Sprint 12 retro");
    expect(plan.questions.map((q) => q.kind)).toEqual(["poll", "text", "number"]);
    expect(createSessionSchema.safeParse(planToBody(plan as never)).success).toBe(true);
    expect(aiCalls[0].prompt).toContain("payments team");
  });

  it("is for accounts only: guests are asked to sign in", async () => {
    const res = await draft("icebreaker", await guestCookie());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "account_required" });
    expect(aiCalls).toHaveLength(0);
  });
});

describe("limits", () => {
  it("caps each account's AI uses per day", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    for (let i = 0; i < 2; i++) {
      aiReplies.push({ title: "T", questions: [{ kind: "text", name: `Q${i}` }] });
      expect((await draft("a team retro")).status).toBe(200);
    }
    const res = await draft("a team retro");
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "ai_limit" });
    expect(aiCalls).toHaveLength(2);
  });

  it("tells the builder whether AI is set up and how many uses are left", async () => {
    const status = async (as = cookie) => (await draftRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie: as } }))).json();
    expect(await status()).toEqual({ available: true, account: true, remaining: 20 });
    expect(await status(await guestCookie())).toEqual({ available: true, account: false, remaining: 0 });
    delete process.env.GEMINI_API_KEY;
    expect(await status()).toMatchObject({ available: false });
  });

  it("hides AI when no Gemini key is set", async () => {
    delete process.env.GEMINI_API_KEY;
    const { code } = await retro();
    await enableAi(code);
    expect(await aiStatus(code)).toMatchObject({ enabled: true, available: false });
    expect((await draft("a team retro")).status).toBe(503);
  });

  it("doesn't let a guest's presentation use AI even if the flag were set", async () => {
    const g = await guestCookie();
    const { code, text } = await retro(g);
    await db.query("update sessions set ai_enabled = true where code = $1", [code]);
    for (const t of ["a", "b", "c"]) await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: t });
    const res = await ai(code, { action: "summary", focusId: text.id }, g);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "account_required" });
  });
});
