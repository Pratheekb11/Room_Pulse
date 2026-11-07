// Pick several, open answer, ranking and number questions: creating, answering, results, exports, editing.
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
import type { AdminSessionRow, ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}) => ({
  ...init,
  headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const voter = () => crypto.randomUUID();

const create = (body: Record<string, unknown>) =>
  adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, authed({ method: "POST", body: JSON.stringify(body) })));
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const csv = async (code: string, type: "summary" | "raw") =>
  (await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=${type}`, authed()), ctx(code))).text())
    .replace(/^﻿/, "")
    .trim()
    .split("\r\n");

async function newTypes() {
  const res = await create({
    title: "Planning",
    focusTopics: [
      { name: "Which perks?", kind: "multi", topics: ["Gym", "Lunch", "Remote", "Books"], maxPicks: 2 },
      { name: "Any ideas?", kind: "text" },
      { name: "Order these", kind: "rank", topics: ["Speed", "Price", "Design"] },
      { name: "How many users by Q4?", kind: "number", min: 0, max: 1000, unit: "users" },
    ],
    criteria: [],
  });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = await info(code);
  const [multi, text, rank, number] = s.focusTopics;
  const opts = (id: string) => s.topics.filter((t) => t.focusId === id);
  return { code, s, multi, text, rank, number, perks: opts(multi.id), ranks: opts(rank.id) };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("types@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("creating the new question types", () => {
  it("stores kind, options and settings; open answer and number questions have no options", async () => {
    const { s, multi, text, number, perks, ranks } = await newTypes();
    expect(s.focusTopics.map((f) => f.kind)).toEqual(["multi", "text", "rank", "number"]);
    expect(perks.map((t) => t.name)).toEqual(["Gym", "Lunch", "Remote", "Books"]);
    expect(ranks.map((t) => t.name)).toEqual(["Speed", "Price", "Design"]);
    expect(s.topics.filter((t) => t.focusId === text.id || t.focusId === number.id)).toEqual([]);
    expect(multi.maxPicks).toBe(2);
    expect(number).toMatchObject({ min: 0, max: 1000, unit: "users" });
    expect(s.focusTopics.map((f) => f.chart)).toEqual(["bars", "wall", "ranking", "histogram"]);
  });

  it("lets pick-several have no limit, and numbers default to 0 to 100", async () => {
    const res = await create({
      title: "x",
      focusTopics: [
        { name: "M", kind: "multi", topics: ["a", "b"] },
        { name: "N", kind: "number" },
      ],
      criteria: [],
    });
    expect(res.status).toBe(201);
    const s = await info(((await res.json()) as { code: string }).code);
    expect(s.focusTopics[0].maxPicks).toBeNull();
    expect(s.focusTopics[1]).toMatchObject({ min: 0, max: 100, unit: null });
  });

  it("rejects bad settings, too few options and charts from another type", async () => {
    for (const f of [
      { name: "M", kind: "multi", topics: ["only one"] },
      { name: "M", kind: "multi", topics: ["a", "b"], maxPicks: 0 },
      { name: "M", kind: "multi", topics: ["a", "b"], maxPicks: 11 },
      { name: "R", kind: "rank", topics: ["only one"] },
      { name: "N", kind: "number", min: 10, max: 10 },
      { name: "N", kind: "number", min: 50, max: 0 },
      { name: "N", kind: "number", min: 0, max: 1e13 },
      { name: "N", kind: "number", unit: "x".repeat(21) },
      { name: "T", kind: "text", chart: "cloud" },
      { name: "M", kind: "multi", topics: ["a", "b"], chart: "pie" },
    ]) {
      expect((await create({ title: "x", focusTopics: [f], criteria: [] })).status, JSON.stringify(f)).toBe(400);
    }
  });
});

describe("pick several", () => {
  it("saves a set of picks, replaces it, and counts each option and each person", async () => {
    const { code, multi, perks } = await newTypes();
    const v = voter();
    expect((await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds: [perks[0].id, perks[1].id] })).status).toBe(200);
    expect((await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds: [perks[1].id, perks[2].id] })).status).toBe(200);
    await answer({ code, kind: "multi", focusId: multi.id, voterId: voter(), topicIds: [perks[1].id] });

    const r = await results(code);
    expect(r.voterCount).toBe(2);
    expect(r.polls).toEqual(
      expect.arrayContaining([
        { focusId: multi.id, topicId: perks[1].id, n: 2 },
        { focusId: multi.id, topicId: perks[2].id, n: 1 },
      ]),
    );
    expect(r.polls).toHaveLength(2);
    expect(r.respondents).toContainEqual({ focusId: multi.id, n: 2 });
  });

  it("an empty set clears the answer", async () => {
    const { code, multi, perks } = await newTypes();
    const v = voter();
    await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds: [perks[0].id] });
    expect((await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds: [] })).status).toBe(200);
    const r = await results(code);
    expect(r.polls).toEqual([]);
    expect(r.voterCount).toBe(0);
  });

  it("rejects more picks than allowed, repeats and other questions' options, keeping the earlier answer", async () => {
    const { code, multi, perks, ranks } = await newTypes();
    const v = voter();
    await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds: [perks[3].id] });
    for (const topicIds of [
      [perks[0].id, perks[1].id, perks[2].id],
      [perks[0].id, perks[0].id],
      [ranks[0].id],
      ["nope"],
    ]) {
      expect((await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds })).status, JSON.stringify(topicIds)).toBe(400);
    }
    expect((await results(code)).polls).toEqual([{ focusId: multi.id, topicId: perks[3].id, n: 1 }]);
  });
});

describe("open answer", () => {
  it("keeps one answer per person, tidied, newest first, and lets them change it", async () => {
    const { code, text } = await newTypes();
    const v = voter();
    expect((await answer({ code, kind: "text", focusId: text.id, voterId: v, text: "  More   demos  " })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 5));
    await answer({ code, kind: "text", focusId: text.id, voterId: voter(), text: "Shorter meetings" });
    let r = await results(code);
    expect(r.texts.map((t) => t.text)).toEqual(["Shorter meetings", "More demos"]);
    expect(r.respondents).toContainEqual({ focusId: text.id, n: 2 });

    await answer({ code, kind: "text", focusId: text.id, voterId: v, text: "Fewer slides" });
    r = await results(code);
    expect(r.texts.map((t) => t.text).sort()).toEqual(["Fewer slides", "Shorter meetings"]);
  });

  it("rejects empty and over-long answers and the wrong question", async () => {
    const { code, text, multi } = await newTypes();
    for (const t of ["", "   ", "x".repeat(281)]) {
      expect((await answer({ code, kind: "text", focusId: text.id, voterId: voter(), text: t })).status, t).toBe(400);
    }
    expect((await answer({ code, kind: "text", focusId: multi.id, voterId: voter(), text: "hi" })).status).toBe(400);
  });
});

describe("ranking", () => {
  it("stores each person's full order and reports how many put each option in each place", async () => {
    const { code, rank, ranks } = await newTypes();
    const [speed, price, design] = ranks.map((t) => t.id);
    const v = voter();
    expect((await answer({ code, kind: "rank", focusId: rank.id, voterId: v, topicIds: [design, speed, price] })).status).toBe(200);
    // changing the order replaces it
    expect((await answer({ code, kind: "rank", focusId: rank.id, voterId: v, topicIds: [speed, design, price] })).status).toBe(200);
    await answer({ code, kind: "rank", focusId: rank.id, voterId: voter(), topicIds: [speed, price, design] });

    const r = await results(code);
    const mine = r.ranks.filter((x) => x.focusId === rank.id);
    expect(mine).toEqual(
      expect.arrayContaining([
        { focusId: rank.id, topicId: speed, rank: 1, n: 2 },
        { focusId: rank.id, topicId: design, rank: 2, n: 1 },
        { focusId: rank.id, topicId: price, rank: 2, n: 1 },
        { focusId: rank.id, topicId: price, rank: 3, n: 1 },
        { focusId: rank.id, topicId: design, rank: 3, n: 1 },
      ]),
    );
    expect(mine).toHaveLength(5);
    expect(r.respondents).toContainEqual({ focusId: rank.id, n: 2 });
  });

  it("needs every option exactly once", async () => {
    const { code, rank, ranks, perks } = await newTypes();
    const [a, b, c] = ranks.map((t) => t.id);
    for (const topicIds of [[a, b], [a, b, b], [a, b, c, perks[0].id], [a, b, perks[0].id], []]) {
      expect((await answer({ code, kind: "rank", focusId: rank.id, voterId: voter(), topicIds })).status, JSON.stringify(topicIds)).toBe(400);
    }
    expect((await results(code)).ranks).toEqual([]);
  });
});

describe("number", () => {
  it("saves one number per person within the range and counts equal answers together", async () => {
    const { code, number } = await newTypes();
    const v = voter();
    expect((await answer({ code, kind: "number", focusId: number.id, voterId: v, value: 120 })).status).toBe(200);
    expect((await answer({ code, kind: "number", focusId: number.id, voterId: v, value: 250.5 })).status).toBe(200);
    await answer({ code, kind: "number", focusId: number.id, voterId: voter(), value: 250.5 });
    await answer({ code, kind: "number", focusId: number.id, voterId: voter(), value: 1000 });
    const r = await results(code);
    expect(r.numbers).toEqual(
      expect.arrayContaining([
        { focusId: number.id, value: 250.5, n: 2 },
        { focusId: number.id, value: 1000, n: 1 },
      ]),
    );
    expect(r.numbers).toHaveLength(2);
    expect(r.respondents).toContainEqual({ focusId: number.id, n: 3 });
  });

  it("rejects numbers outside the range or that aren't numbers", async () => {
    const { code, number } = await newTypes();
    for (const value of [-1, 1000.01, "12", null, 1e400]) {
      expect((await answer({ code, kind: "number", focusId: number.id, voterId: voter(), value })).status, String(value)).toBe(400);
    }
  });
});

describe("closed voting and admin", () => {
  it("refuses every new answer type once voting is closed", async () => {
    const { code, multi, text, rank, number, perks, ranks } = await newTypes();
    await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: '{"isOpen":false}' })), ctx(code));
    for (const body of [
      { kind: "multi", focusId: multi.id, topicIds: [perks[0].id] },
      { kind: "text", focusId: text.id, text: "hi" },
      { kind: "rank", focusId: rank.id, topicIds: ranks.map((t) => t.id) },
      { kind: "number", focusId: number.id, value: 5 },
    ]) {
      expect((await answer({ code, voterId: voter(), ...body })).status, body.kind).toBe(403);
    }
  });

  it("counts people across all types in the console, and reset clears everything", async () => {
    const { code, multi, text, rank, number, perks, ranks } = await newTypes();
    await answer({ code, kind: "multi", focusId: multi.id, voterId: voter(), topicIds: [perks[0].id] });
    await answer({ code, kind: "text", focusId: text.id, voterId: voter(), text: "hi" });
    await answer({ code, kind: "rank", focusId: rank.id, voterId: voter(), topicIds: ranks.map((t) => t.id) });
    const v = voter();
    await answer({ code, kind: "number", focusId: number.id, voterId: v, value: 5 });
    await answer({ code, kind: "text", focusId: text.id, voterId: v, text: "me too" });

    const list = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, authed()))).json()) as { sessions: AdminSessionRow[] };
    expect(list.sessions[0].voterCount).toBe(4);
    expect((await results(code)).voterCount).toBe(4);

    await resetRoute.POST(new Request(`${ORIGIN}/x`, authed({ method: "POST" })), ctx(code));
    expect(await results(code)).toMatchObject({ voterCount: 0, polls: [], ranks: [], numbers: [], texts: [], respondents: [] });
  });

  it("exports summaries and raw answers for the new types without voter ids", async () => {
    const { code, multi, text, rank, number, perks, ranks } = await newTypes();
    const v = voter();
    await answer({ code, kind: "multi", focusId: multi.id, voterId: v, topicIds: [perks[0].id, perks[2].id] });
    await answer({ code, kind: "text", focusId: text.id, voterId: v, text: "Bring snacks, please" });
    await answer({ code, kind: "rank", focusId: rank.id, voterId: v, topicIds: [ranks[2].id, ranks[0].id, ranks[1].id] });
    await answer({ code, kind: "number", focusId: number.id, voterId: v, value: 300 });
    await answer({ code, kind: "number", focusId: number.id, voterId: voter(), value: 100 });

    const summary = await csv(code, "summary");
    expect(summary).toContain("Which perks?,Gym,Picked,,1");
    expect(summary).toContain("Which perks?,Lunch,Picked,,0");
    expect(summary).toContain("Order these,Design,Average place,1.00,1");
    expect(summary).toContain("Order these,Price,Average place,3.00,1");
    expect(summary).toContain("How many users by Q4?,,Average,200.00,2");
    expect(summary).toContain("How many users by Q4?,,Middle value,200.00,2");
    expect(summary).toContain('Any ideas?,"Bring snacks, please",Answer,,1');

    const raw = await csv(code, "raw");
    expect(raw.join("\n")).not.toContain(v);
    const r1 = raw.filter((l) => l.startsWith("R1,")).map((l) => l.split(",").slice(0, 5).join(","));
    expect(r1).toEqual([
      "R1,Which perks?,Gym,Picked,",
      "R1,Which perks?,Remote,Picked,",
      'R1,Any ideas?,"Bring snacks, please",Answer',
      "R1,Order these,Speed,Place,2",
      "R1,Order these,Price,Place,3",
      "R1,Order these,Design,Place,1",
      "R1,How many users by Q4?,,Number,300",
    ]);
  });
});

describe("editing the new types", () => {
  it("changes settings and keeps answers; the type can't change", async () => {
    const { code, s, multi, perks } = await newTypes();
    await answer({ code, kind: "multi", focusId: multi.id, voterId: voter(), topicIds: [perks[0].id] });
    const body = {
      title: s.session.title,
      scaleMax: s.session.scaleMax,
      lowLabel: s.session.lowLabel,
      highLabel: s.session.highLabel,
      focusTopics: s.focusTopics.map((f) => ({
        id: f.id,
        name: f.name,
        kind: f.kind,
        chart: f.chart,
        maxPicks: f.kind === "multi" ? 3 : undefined,
        min: f.kind === "number" ? 10 : undefined,
        max: f.kind === "number" ? 20 : undefined,
        unit: f.kind === "number" ? "%" : undefined,
        topics: s.topics.filter((t) => t.focusId === f.id).map((t) => ({ id: t.id, name: t.name })),
      })),
      criteria: [],
    };
    const put = (b: unknown) =>
      adminSession.PUT(new Request(`${ORIGIN}/x`, authed({ method: "PUT", body: JSON.stringify(b) })), ctx(code));
    expect((await put(body)).status).toBe(200);
    const after = await info(code);
    expect(after.focusTopics[0].maxPicks).toBe(3);
    expect(after.focusTopics[3]).toMatchObject({ min: 10, max: 20, unit: "%" });
    expect((await results(code)).polls).toHaveLength(1);

    const changed = { ...body, focusTopics: body.focusTopics.map((f, i) => (i === 0 ? { ...f, kind: "poll" } : f)) };
    expect((await put(changed)).status).toBe(400);
  });
});
