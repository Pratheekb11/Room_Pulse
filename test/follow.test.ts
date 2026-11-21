// "Follow me" (2026-11-21): the presenter turns it on and every phone moves to the question on the big screen.
// People can still move around on their own; a phone only jumps when the presenter's question changes.
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as followRoute from "@/app/api/admin/sessions/[code]/follow/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import type { SessionPayload, SessionStatus } from "@/lib/types";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
let cookie = "";
let otherCookie = "";
let db: Awaited<ReturnType<typeof startTestDb>>;
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const create = async (title: string) => {
  const res = await adminSessions.POST(
    new Request(
      `${ORIGIN}/api/admin/sessions`,
      authed({
        method: "POST",
        body: JSON.stringify({
          title,
          focusTopics: [
            { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
            { name: "One word for the week", kind: "words" },
          ],
          criteria: [],
        }),
      }),
    ),
  );
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  return { code, q1: s.focusTopics[0], q2: s.focusTopics[1] };
};
const status = async (code: string) => (await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionStatus;
const follow = (code: string, focusId: string | null, as = cookie) =>
  followRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST", body: JSON.stringify({ focusId }) }, as)), ctx(code));
const current = async (code: string) => (await (await followRoute.GET(new Request(`${ORIGIN}/x`, authed()), ctx(code))).json()) as { focusId: string | null };

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("follow@example.com")).cookie!;
  otherCookie = (await signUp("follow-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("the presenter leads, phones follow", () => {
  it("is off until the presenter turns it on", async () => {
    const { code } = await create("Standup");
    expect((await status(code)).follow).toBeNull();
    expect((await current(code)).focusId).toBeNull();
  });

  it("puts the presenter's question in the status every phone polls", async () => {
    const { code, q1, q2 } = await create("Standup");
    expect((await follow(code, q1.id)).status).toBe(200);
    expect((await status(code)).follow).toBe(q1.id);
    expect((await follow(code, q2.id)).status).toBe(200);
    expect((await status(code)).follow).toBe(q2.id);
    expect((await current(code)).focusId).toBe(q2.id);
  });

  it("turns off with null", async () => {
    const { code, q1 } = await create("Standup");
    await follow(code, q1.id);
    expect((await follow(code, null)).status).toBe(200);
    expect((await status(code)).follow).toBeNull();
  });

  it("only the owner can lead, and only to their own questions", async () => {
    const { code, q1 } = await create("Standup");
    const other = await create("Other");
    expect((await follow(code, q1.id, otherCookie)).status).toBe(404);
    expect((await follow(code, other.q1.id)).status).toBe(400);
    expect((await follow(code, "not-a-uuid")).status).toBe(400);
    expect((await status(code)).follow).toBeNull();
  });
});

describe("phones and the big screen", () => {
  const vote = read("components/VoteApp.tsx");
  const dash = read("components/DashboardApp.tsx");

  it("phones poll quickly while following and jump only when the presenter's question changes", () => {
    expect(vote).toMatch(/hasQuiz \|\| following \? QUIZ_POLL_MS : STATUS_POLL_MS/);
    expect(vote).toMatch(/if \(!follow \|\| follow === lastFollow\.current\) return;/);
    expect(vote).toMatch(/Following the presenter/);
  });

  it("the presenter has a 'Phones follow me' switch and moving between questions leads the phones", () => {
    expect(dash).toContain("Phones follow me");
    expect(dash).toMatch(/\/follow`/);
  });

  it("the database keeps the presenter's question, and the production change recreates live_sessions", () => {
    const schema = read("db/schema.sql");
    expect(schema).toMatch(/alter table sessions add column if not exists follow_focus_id uuid references focus_topics\(id\) on delete set null/);
    const prod = read("db/2026-11-21-follow-moderation.sql");
    expect(prod).toContain("follow_focus_id");
    expect(prod).toMatch(/create or replace view live_sessions/);
    expect(prod).toContain("scripts/run-sql.mjs");
  });
});
