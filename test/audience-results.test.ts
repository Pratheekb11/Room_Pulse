// Presentation settings the owner switches on: results on voters' phones, and AI insights (accounts only).
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, cookieFrom, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as textRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as publicRoute from "@/app/api/results/[code]/public/route";
import * as answerRoute from "@/app/api/answer/route";
import * as qaRoute from "@/app/api/qa/[code]/route";
import * as quizRoute from "@/app/api/quiz/[code]/route";
import * as quizControl from "@/app/api/admin/sessions/[code]/quiz/route";
import type { AdminSessionRow, ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const patch = (code: string, body: Record<string, unknown>, as = cookie) =>
  adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify(body) }, as)), ctx(code));
const status = async (code: string) => (await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as Record<string, unknown>;
const pub = (code: string) => publicRoute.GET(new Request(`${ORIGIN}/x`), ctx(code));
const owner = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));
const rows = async (as = cookie) =>
  ((await (await adminSessions.GET(new Request(`${ORIGIN}/x`, { headers: { cookie: as } }))).json()) as { sessions: AdminSessionRow[] }).sessions;

async function create(as = cookie) {
  const res = await adminSessions.POST(
    new Request(
      `${ORIGIN}/api/admin/sessions`,
      authed(
        {
          method: "POST",
          body: JSON.stringify({
            title: "Retro",
            focusTopics: [
              { name: "Mood?", kind: "poll", topics: ["Good", "Bad"] },
              { name: "What went well?", kind: "text" },
              { name: "Questions?", kind: "qa" },
              { name: "Capital of Japan?", kind: "quiz", topics: ["Tokyo", "Osaka"], correct: "Tokyo" },
            ],
            criteria: [],
          }),
        },
        as,
      ),
    ),
  );
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  const [poll, text, qa, quiz] = s.focusTopics;
  return { code, s, poll, text, qa, quiz };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("audience@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("results on voters' phones", () => {
  it("is off by default: the public results say not found and status says so", async () => {
    const { code } = await create();
    expect((await pub(code)).status).toBe(404);
    expect(await status(code)).toMatchObject({ showResults: false });
    expect((await rows())[0]).toMatchObject({ showResults: false, aiEnabled: false });
  });

  it("the owner switches it on and off", async () => {
    const { code, s, poll } = await create();
    await answer({ kind: "poll", code, focusId: poll.id, voterId: crypto.randomUUID(), topicId: s.topics.find((t) => t.name === "Good")!.id });
    expect((await patch(code, { showResults: true })).status).toBe(200);
    expect(await status(code)).toMatchObject({ showResults: true, isOpen: true });
    const res = await pub(code);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage/);
    const r = (await res.json()) as ResultsPayload;
    expect(r.polls).toEqual([{ focusId: poll.id, topicId: expect.any(String), n: 1 }]);
    expect((await rows())[0].showResults).toBe(true);

    await patch(code, { showResults: false });
    expect((await pub(code)).status).toBe(404);
  });

  it("never shows hidden answers, hidden questions or anything about the quiz", async () => {
    const { code, s, text, qa, quiz } = await create();
    const v = crypto.randomUUID();
    await answer({ kind: "text", code, focusId: text.id, voterId: v, text: "rude" });
    await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: "kind" });
    const rude = (await owner(code)).texts.find((t) => t.text === "rude")!;
    await textRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ id: rude.id, hidden: true }) })), ctx(code));
    const asked = await qaRoute.POST(
      new Request(`${ORIGIN}/x`, { method: "POST", body: JSON.stringify({ action: "ask", focusId: qa.id, voterId: v, text: "hide me" }) }),
      ctx(code),
    );
    const { id } = (await asked.json()) as { id: string };
    await db.query("update qa_questions set hidden = true where id = $1", [id]);
    await quizControl.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify({ action: "start", focusId: quiz.id }) })), ctx(code));
    await quizRoute.POST(
      new Request(`${ORIGIN}/x`, {
        method: "POST",
        body: JSON.stringify({ action: "answer", focusId: quiz.id, voterId: v, topicId: s.topics.find((t) => t.name === "Tokyo")!.id }),
      }),
      ctx(code),
    );
    expect((await owner(code)).quizCounts.length).toBe(1);

    await patch(code, { showResults: true });
    const r = (await (await pub(code)).json()) as ResultsPayload;
    expect(r.texts.map((t) => t.text)).toEqual(["kind"]);
    expect(r.questions).toEqual([]);
    expect(r).toMatchObject({ quizCounts: [], quizRevealed: [], leaderboard: [], quiz: null });
    expect(r.respondents.some((x) => x.focusId === quiz.id)).toBe(false);
  });

  it("only the owner can change settings", async () => {
    const { code } = await create();
    const other = (await signUp("audience-other@example.com")).cookie!;
    expect((await patch(code, { showResults: true }, other)).status).toBe(404);
    expect((await patch(code, {})).status).toBe(400);
  });
});

describe("AI insights setting", () => {
  it("an account can switch AI on for a presentation", async () => {
    const { code } = await create();
    expect((await patch(code, { aiEnabled: true })).status).toBe(200);
    expect((await rows())[0].aiEnabled).toBe(true);
  });

  it("a guest is asked to sign in or create an account", async () => {
    const g = cookieFrom(await guestRoute.POST(new Request(`${ORIGIN}/api/auth/guest`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: "{}" })))!;
    const { code } = await create(g);
    const res = await patch(code, { aiEnabled: true }, g);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "account_required" });
    expect((await rows(g))[0].aiEnabled).toBe(false);
    // other settings still work for guests
    expect((await patch(code, { showResults: true }, g)).status).toBe(200);
  });
});
