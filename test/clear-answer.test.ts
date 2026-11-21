// Clear an answer, question by question (owner, 2026-11-21): while people are answering, each question has
// "Clear answer", which takes their answer off the big screen. Once they tap Finish, there is no control left
// (lib/finish-lock.ts). The server side: `{ kind: "clear" }` on /api/answer deletes one person's answer to one
// question; a `null` score on /api/vote takes back one Score items rating.
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as voteRoute from "@/app/api/vote/route";
import type { SessionPayload } from "@/lib/types";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
let db: Awaited<ReturnType<typeof startTestDb>>;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}) => ({ ...init, headers: { cookie, origin: ORIGIN, "content-type": "application/json" } });
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
const answer = (body: Record<string, unknown>) => answerRoute.POST(new Request(`${ORIGIN}/api/answer`, post(body)));
const vote = (body: Record<string, unknown>) => voteRoute.POST(new Request(`${ORIGIN}/api/vote`, post(body)));
const count = async (table: string, focusId: string) =>
  Number(((await db.query<{ n: number }>(`select count(*)::int as n from ${table} where focus_id = $1`, [focusId])).rows[0]).n);

async function setup() {
  const res = await adminSessions.POST(
    new Request(
      `${ORIGIN}/api/admin/sessions`,
      authed(
        post({
          title: "Retro",
          focusTopics: [
            { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
            { name: "Tools?", kind: "multi", topics: ["Jira", "Slack", "Figma"] },
            { name: "Order these", kind: "rank", topics: ["A", "B"] },
            { name: "How many?", kind: "number", min: 0, max: 10 },
            { name: "Ideas?", kind: "text" },
            { name: "One word", kind: "words" },
            { name: "Ask us", kind: "qa" },
            { name: "Capital of Japan?", kind: "quiz", topics: ["Osaka", "Tokyo"], correct: "Tokyo" },
            { name: "Score these", kind: "rating", topics: ["Food", "Talk"] },
          ],
          criteria: ["Impact"],
        }),
      ),
    ),
  );
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  const by = (name: string) => s.focusTopics.find((f) => f.name === name)!;
  const opts = (name: string) => s.topics.filter((t) => t.focusId === by(name).id);
  return { code, s, by, opts };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("clear@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("clearing one question's answer", () => {
  it("takes the answer back for every kind people type or pick, and only that person's", async () => {
    const { code, by, opts } = await setup();
    const me = crypto.randomUUID();
    const other = crypto.randomUUID();
    const cases: [string, string, (v: string) => Record<string, unknown>][] = [
      ["Lunch?", "poll_answers", (v) => ({ kind: "poll", topicId: opts("Lunch?")[0].id, voterId: v })],
      ["Tools?", "choice_answers", (v) => ({ kind: "multi", topicIds: [opts("Tools?")[0].id, opts("Tools?")[1].id], voterId: v })],
      ["Order these", "rank_answers", (v) => ({ kind: "rank", topicIds: opts("Order these").map((t) => t.id), voterId: v })],
      ["How many?", "number_answers", (v) => ({ kind: "number", value: 4, voterId: v })],
      ["Ideas?", "text_answers", (v) => ({ kind: "text", text: "Pair more", voterId: v })],
      ["One word", "word_answers", (v) => ({ kind: "words", words: ["calm", "busy"], voterId: v })],
    ];
    for (const [name, table, body] of cases) {
      const focusId = by(name).id;
      for (const v of [me, other]) expect((await answer({ code, focusId, ...body(v) })).status, name).toBe(200);
      const before = await count(table, focusId);
      const res = await answer({ code, kind: "clear", focusId, voterId: me });
      expect(res.status, name).toBe(200);
      const left = await count(table, focusId);
      expect(left, name).toBe(before / 2); // the other person's answer stays
    }
  });

  it("is refused once voting is closed, like any answer", async () => {
    const { code, by, opts } = await setup();
    const me = crypto.randomUUID();
    await answer({ code, kind: "poll", focusId: by("Lunch?").id, topicId: opts("Lunch?")[0].id, voterId: me });
    await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ isOpen: false }) })), ctx(code));
    const res = await answer({ code, kind: "clear", focusId: by("Lunch?").id, voterId: me });
    expect(res.status).toBe(403);
    expect(await count("poll_answers", by("Lunch?").id)).toBe(1);
  });

  it("doesn't apply to Q&A (a live list) or a quiz (one-shot answers)", async () => {
    const { code, by } = await setup();
    for (const name of ["Ask us", "Capital of Japan?"]) {
      const res = await answer({ code, kind: "clear", focusId: by(name).id, voterId: crypto.randomUUID() });
      expect(res.status, name).toBe(400);
    }
  });

  it("a Score items rating is taken back with a null score, and the average follows", async () => {
    const { code, s, opts } = await setup();
    const [food] = opts("Score these");
    const crit = s.criteria[0];
    const me = crypto.randomUUID();
    const other = crypto.randomUUID();
    expect((await vote({ code, topicId: food.id, criterionId: crit.id, voterId: me, score: 5 })).status).toBe(200);
    expect((await vote({ code, topicId: food.id, criterionId: crit.id, voterId: other, score: 3 })).status).toBe(200);
    expect((await vote({ code, topicId: food.id, criterionId: crit.id, voterId: me, score: null })).status).toBe(200);
    const { rows } = await db.query<{ vote_count: number; score_sum: number }>(
      "select vote_count, score_sum from results where topic_id = $1 and criterion_id = $2",
      [food.id, crit.id],
    );
    expect(rows[0]).toMatchObject({ vote_count: 1, score_sum: 3 });
    // taking back a rating that isn't there is fine (a retry after it already went through)
    expect((await vote({ code, topicId: food.id, criterionId: crit.id, voterId: me, score: null })).status).toBe(200);
  });
});

describe("on the phone: Clear answer until Finish, then no control", () => {
  const vote$ = read("components/VoteApp.tsx");

  it("each answered question has Clear answer while it isn't locked; never on Q&A or a quiz", () => {
    expect(vote$).toMatch(/const canClear = !!here && isOpen && !locked && here\.kind !== "qa" && here\.kind !== "quiz" && hasAnswer\(here\);/);
    expect(vote$).toMatch(/\{canClear && \(\s*<button[^>]*onClick=\{\(\) => onClear\(current\)\}[^>]*>\s*Clear answer/);
  });

  it("clearing sends the right thing: a null score per rating, kind clear per question, each leaf back on a board", () => {
    expect(vote$).toMatch(/queue\.set\(key, null\)/);
    expect(vote$).toMatch(/if \(v === null\) return \{ kind: "clear", focusId \}/);
  });

  it("finishing is a tap: answering the last question asks to Finish, it doesn't lock by itself", () => {
    expect(vote$).toMatch(/const finishedAll = complete && steps\.every\(\(s\) => !lockable\(s\.kind\) \|\| lockedIds\.includes\(stepId\(s\)\)\);/);
    expect(vote$).toMatch(/if \(finishedAll && !reviewing\)/);
    expect(vote$).toMatch(/>\s*Finish\s*<\/button>/);
    expect(vote$).toContain("After that, your answers are locked.");
    // below Back / Next, where the last answer was given (sweep: at the top it was out of view on a 320px phone)
    expect(vote$.indexOf("That&rsquo;s every question")).toBeGreaterThan(vote$.indexOf("<StepNav"));
  });
});
