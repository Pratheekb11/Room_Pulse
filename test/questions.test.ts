import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import * as voteRoute from "@/app/api/vote/route";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const CHECK_SQL = readFileSync(new URL("../db/check.sql", import.meta.url), "utf8");
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}) => ({
  ...init,
  headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const voter = () => crypto.randomUUID();

async function create(body: Record<string, unknown>) {
  return adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, authed({ method: "POST", body: JSON.stringify(body) })));
}

async function mixed() {
  const res = await create({
    title: "Offsite",
    focusTopics: [
      { name: "Bets", kind: "rating", topics: ["A", "B"] },
      { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi", "Salad"] },
      { name: "One word for 2027", kind: "words" },
    ],
    criteria: ["Impact"],
  });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const info = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  const [bets, poll, words] = info.focusTopics;
  const options = info.topics.filter((t) => t.focusId === poll.id);
  return { code, info, bets, poll, words, options };
}

const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));

async function results(code: string) {
  return (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as ResultsPayload;
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("host@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("creating question types", () => {
  it("stores each focus topic's kind; poll options are its topics; word clouds have none", async () => {
    const { info, bets, words, options } = await mixed();
    expect(info.focusTopics.map((f) => [f.name, f.kind])).toEqual([
      ["Bets", "rating"],
      ["Lunch?", "poll"],
      ["One word for 2027", "words"],
    ]);
    expect(info.topics.filter((t) => t.focusId === bets.id).map((t) => t.name)).toEqual(["A", "B"]);
    expect(options.map((t) => t.name)).toEqual(["Pizza", "Sushi", "Salad"]);
    expect(info.topics.filter((t) => t.focusId === words.id)).toEqual([]);
  });

  it("defaults to rating and validates per kind", async () => {
    const ok = await create({ title: "x", focusTopics: [{ name: "F", topics: ["a"] }], criteria: ["c"] });
    expect(ok.status).toBe(201);
    // polls and word clouds alone don't need criteria
    expect((await create({ title: "x", focusTopics: [{ name: "P", kind: "poll", topics: ["a", "b"] }], criteria: [] })).status).toBe(201);
    expect((await create({ title: "x", focusTopics: [{ name: "W", kind: "words" }], criteria: [] })).status).toBe(201);

    for (const body of [
      { title: "x", focusTopics: [{ name: "P", kind: "poll", topics: ["only one"] }], criteria: [] },
      { title: "x", focusTopics: [{ name: "R", kind: "rating", topics: ["a"] }], criteria: [] }, // rating needs criteria
      { title: "x", focusTopics: [{ name: "Q", kind: "quiz", topics: ["a"] }], criteria: ["c"] },
    ]) {
      expect((await create(body)).status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("chart type per question", () => {
  it("stores the presenter's chart choice and defaults per question type", async () => {
    const res = await create({
      title: "Charts",
      focusTopics: [
        { name: "R1", kind: "rating", topics: ["a"], chart: "summary" },
        { name: "R2", kind: "rating", topics: ["b"] },
        { name: "P1", kind: "poll", topics: ["x", "y"], chart: "donut" },
        { name: "P2", kind: "poll", topics: ["x", "y"] },
        { name: "W1", kind: "words", chart: "list" },
        { name: "W2", kind: "words" },
      ],
      criteria: ["c", "d"],
    });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    const info = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
    expect(info.focusTopics.map((f) => f.chart)).toEqual(["summary", "heatmap", "donut", "bars", "list", "cloud"]);
  });

  it("rejects a chart that doesn't fit the question type", async () => {
    for (const f of [
      { name: "P", kind: "poll", topics: ["x", "y"], chart: "heatmap" },
      { name: "W", kind: "words", chart: "pie" },
      { name: "R", kind: "rating", topics: ["a"], chart: "sparkles" },
      { name: "M", kind: "rating", topics: ["a"], chart: "matrix" }, // removed chart
    ]) {
      expect((await create({ title: "x", focusTopics: [f], criteria: ["c"] })).status, JSON.stringify(f)).toBe(400);
    }
  });
});

describe("POST /api/answer — polls", () => {
  it("saves one choice per voter, lets them change it, and counts it", async () => {
    const { code, poll, options } = await mixed();
    const v = voter();
    expect((await answer({ code, focusId: poll.id, voterId: v, kind: "poll", topicId: options[0].id })).status).toBe(200);
    expect((await answer({ code, focusId: poll.id, voterId: v, kind: "poll", topicId: options[1].id })).status).toBe(200);
    await answer({ code, focusId: poll.id, voterId: voter(), kind: "poll", topicId: options[1].id });

    const r = await results(code);
    expect(r.voterCount).toBe(2);
    expect(r.polls).toEqual([{ focusId: poll.id, topicId: options[1].id, n: 2 }]);
  });

  it("rejects options from another question, the wrong kind, and closed sessions", async () => {
    const { code, bets, poll, info } = await mixed();
    void bets;
    const ratingTopic = info.topics.find((t) => t.focusId === bets.id)!;
    expect((await answer({ code, focusId: poll.id, voterId: voter(), kind: "poll", topicId: ratingTopic.id })).status).toBe(400);
    expect((await answer({ code, focusId: bets.id, voterId: voter(), kind: "poll", topicId: ratingTopic.id })).status).toBe(400);
    expect((await answer({ code, focusId: poll.id, voterId: "nope", kind: "poll", topicId: ratingTopic.id })).status).toBe(400);

    await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: '{"isOpen":false}' })), ctx(code));
    const closed = await answer({ code, focusId: poll.id, voterId: voter(), kind: "poll", topicId: (await mixedOption(code, poll.id)) });
    expect(closed.status).toBe(403);
    expect((await db.query("select 1 from poll_answers")).rows).toHaveLength(0);
  });
});

async function mixedOption(code: string, focusId: string) {
  const info = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  return info.topics.find((t) => t.focusId === focusId)!.id;
}

describe("POST /api/answer — word cloud", () => {
  it("stores up to 3 normalised, de-duplicated words and replaces them on resubmit", async () => {
    const { code, words } = await mixed();
    const v = voter();
    expect((await answer({ code, focusId: words.id, voterId: v, kind: "words", words: ["  Speed ", "speed", "Customer   trust"] })).status).toBe(200);
    await answer({ code, focusId: words.id, voterId: voter(), kind: "words", words: ["SPEED"] });
    let r = await results(code);
    expect(r.words).toEqual([
      { focusId: words.id, word: "speed", n: 2 },
      { focusId: words.id, word: "customer trust", n: 1 },
    ]);
    expect(r.voterCount).toBe(2);

    await answer({ code, focusId: words.id, voterId: v, kind: "words", words: ["Focus"] });
    r = await results(code);
    expect(r.words).toEqual(
      expect.arrayContaining([
        { focusId: words.id, word: "speed", n: 1 },
        { focusId: words.id, word: "focus", n: 1 },
      ]),
    );
    expect(r.words).toHaveLength(2);
  });

  it("validates the words", async () => {
    const { code, words, poll } = await mixed();
    for (const list of [["a", "b", "c", "d"], ["x".repeat(41)], [""], "speed"]) {
      expect((await answer({ code, focusId: words.id, voterId: voter(), kind: "words", words: list })).status, JSON.stringify(list)).toBe(400);
    }
    expect((await answer({ code, focusId: poll.id, voterId: voter(), kind: "words", words: ["hi"] })).status).toBe(400);
  });
});

describe("rating votes", () => {
  it("can't be cast on a poll option", async () => {
    const { code, options, info } = await mixed();
    const res = await voteRoute.POST(
      new Request(`${ORIGIN}/api/vote`, {
        method: "POST",
        body: JSON.stringify({ code, topicId: options[0].id, criterionId: info.criteria[0].id, voterId: voter(), score: 3 }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("admin with question types", () => {
  it("reset clears poll and word answers too", async () => {
    const { code, poll, words, options } = await mixed();
    await answer({ code, focusId: poll.id, voterId: voter(), kind: "poll", topicId: options[0].id });
    await answer({ code, focusId: words.id, voterId: voter(), kind: "words", words: ["hi"] });
    await resetRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST" })), ctx(code));
    const r = await results(code);
    expect(r).toMatchObject({ voterCount: 0, polls: [], words: [] });
    expect((await db.query(CHECK_SQL)).rows).toEqual([]);
  });

  it("summary export lists poll counts and word counts", async () => {
    const { code, poll, words, options } = await mixed();
    await answer({ code, focusId: poll.id, voterId: voter(), kind: "poll", topicId: options[2].id });
    await answer({ code, focusId: words.id, voterId: voter(), kind: "words", words: ["Bold"] });
    const text = await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=summary`, authed()), ctx(code))).text();
    const lines = text.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toContain("Lunch?,Pizza,Poll choice,,0");
    expect(lines).toContain("Lunch?,Salad,Poll choice,,1");
    expect(lines).toContain("One word for 2027,bold,Word,,1");
  });

  it("raw export includes every answer type, numbering people across all of them, without voter ids", async () => {
    const { code, poll, words, options, info } = await mixed();
    const v1 = voter();
    const v2 = voter();
    await answer({ code, focusId: poll.id, voterId: v1, kind: "poll", topicId: options[1].id });
    await new Promise((r) => setTimeout(r, 5));
    await voteRoute.POST(
      new Request(`${ORIGIN}/api/vote`, {
        method: "POST",
        body: JSON.stringify({ code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: v2, score: 4 }),
      }),
    );
    await answer({ code, focusId: words.id, voterId: v1, kind: "words", words: ["Bold", "calm"] });
    const text = await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=raw`, authed()), ctx(code))).text();
    expect(text).not.toContain(v1);
    expect(text).not.toContain(v2);
    const rows = text.replace(/^\uFEFF/, "").trim().split("\r\n").map((l) => l.split(",").slice(0, 5));
    expect(rows.slice(1)).toEqual([
      ["R1", "Lunch?", "Sushi", "Poll choice", ""],
      ["R1", "One word for 2027", "bold", "Word", ""],
      ["R1", "One word for 2027", "calm", "Word", ""],
      ["R2", "Bets", "A", "Impact", "4"],
    ]);
  });

  it("admin list counts poll and word participants as voters", async () => {
    const { poll, options, code } = await mixed();
    await answer({ code, focusId: poll.id, voterId: voter(), kind: "poll", topicId: options[0].id });
    const body = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, authed()))).json()) as { sessions: { voterCount: number }[] };
    expect(body.sessions[0].voterCount).toBe(1);
  });
});
