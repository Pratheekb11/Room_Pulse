// Moderation everywhere (2026-11-21): the bad-word filter (lib/profanity.ts) used to guard only board leaves and
// names. Everything people type that can reach the big screen is checked now: open answers, word clouds,
// Audience Q&A questions, open points (and the name on them) and quiz nicknames. Phones check before sending and
// say why; the server refuses anyway (400 blocked_words).
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as qaRoute from "@/app/api/qa/[code]/route";
import * as pointsRoute from "@/app/api/points/[code]/route";
import * as quizRoute from "@/app/api/quiz/[code]/route";
import { SCREEN_BLOCKED_MESSAGE } from "@/lib/profanity";
import type { SessionPayload } from "@/lib/types";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
let db: Awaited<ReturnType<typeof startTestDb>>;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}) => ({ ...init, headers: { cookie, origin: ORIGIN, "content-type": "application/json" } });
const voter = () => crypto.randomUUID();
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
const error = async (res: Response) => ((await res.json()) as { error?: string }).error;

async function setup() {
  const res = await adminSessions.POST(
    new Request(
      `${ORIGIN}/api/admin/sessions`,
      authed(
        post({
          title: "Retro",
          focusTopics: [
            { name: "Ideas?", kind: "text" },
            { name: "One word", kind: "words" },
            { name: "Ask us", kind: "qa" },
            { name: "Capital of Japan?", kind: "quiz", topics: ["Osaka", "Tokyo"], correct: "Tokyo" },
          ],
          criteria: [],
        }),
      ),
    ),
  );
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ openPoints: true }) })), ctx(code));
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  const [text, words, qa] = s.focusTopics;
  return { code, text, words, qa };
}
const answer = (body: Record<string, unknown>) => answerRoute.POST(new Request(`${ORIGIN}/api/answer`, post(body)));
const ask = (code: string, body: Record<string, unknown>) => qaRoute.POST(new Request(`${ORIGIN}/x`, post(body)), ctx(code));
const raise = (code: string, body: Record<string, unknown>) => pointsRoute.POST(new Request(`${ORIGIN}/x`, post(body)), ctx(code));
const quiz = (code: string, body: Record<string, unknown>) => quizRoute.POST(new Request(`${ORIGIN}/x`, post(body)), ctx(code));

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("moderation@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("the server keeps bad words off the big screen", () => {
  it("plain open answers", async () => {
    const { code, text } = await setup();
    const bad = await answer({ code, kind: "text", focusId: text.id, voterId: voter(), text: "this is sh1t" });
    expect(bad.status).toBe(400);
    expect(await error(bad)).toBe("blocked_words");
    expect((await answer({ code, kind: "text", focusId: text.id, voterId: voter(), text: "Shorter meetings" })).status).toBe(200);
  });

  it("word clouds, any of the words", async () => {
    const { code, words } = await setup();
    const bad = await answer({ code, kind: "words", focusId: words.id, voterId: voter(), words: ["calm", "f u c k"] });
    expect(bad.status).toBe(400);
    expect(await error(bad)).toBe("blocked_words");
    expect((await answer({ code, kind: "words", focusId: words.id, voterId: voter(), words: ["calm", "busy"] })).status).toBe(200);
  });

  it("Audience Q&A questions", async () => {
    const { code, qa } = await setup();
    const bad = await ask(code, { action: "ask", focusId: qa.id, voterId: voter(), text: "Why is the boss an idiot?" });
    expect(bad.status).toBe(400);
    expect(await error(bad)).toBe("blocked_words");
    expect((await ask(code, { action: "ask", focusId: qa.id, voterId: voter(), text: "When is the next release?" })).status).toBe(200);
  });

  it("open points and the name on them", async () => {
    const { code } = await setup();
    expect(await error(await raise(code, { voterId: voter(), text: "The build is sh*t" }))).toBe("blocked_words");
    expect(await error(await raise(code, { voterId: voter(), text: "Slow build", name: "a$$hole" }))).toBe("blocked_words");
    expect((await raise(code, { voterId: voter(), text: "Slow build", name: "Ana" })).status).toBe(201);
  });

  it("quiz nicknames", async () => {
    const { code } = await setup();
    const bad = await quiz(code, { action: "join", voterId: voter(), nickname: "b!tch" });
    expect(bad.status).toBe(400);
    expect(await error(bad)).toBe("blocked_words");
    expect((await quiz(code, { action: "join", voterId: voter(), nickname: "Quizzy" })).status).toBe(200);
  });

  it("leaves ordinary words alone", async () => {
    const { code, text } = await setup();
    expect((await answer({ code, kind: "text", focusId: text.id, voterId: voter(), text: "Class assessment in Scunthorpe" })).status).toBe(200);
  });
});

describe("phones say why before sending", () => {
  it("has a message for the big screen, not only the board", () => {
    expect(SCREEN_BLOCKED_MESSAGE).toMatch(/off the screen/);
  });

  for (const f of ["components/vote/TextCard.tsx", "components/WordsCard.tsx", "components/vote/QaCard.tsx", "components/vote/RaisePoint.tsx", "components/vote/QuizCard.tsx"]) {
    it(`${f} checks before sending`, () => {
      const src = read(f);
      expect(src).toContain("hasBadWords(");
      expect(src).toContain("SCREEN_BLOCKED_MESSAGE");
    });
  }
});
