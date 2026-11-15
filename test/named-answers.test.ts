// Names on every answer of a team activity (2026-11-15). Team building isn't fun anonymously: in "This or
// that" the room wants to see who is on which side, in "Team map" who joins from where. A presentation can
// say "names on" (`sessions.named`; every team activity turns it on): phones ask for a name once, every
// answer carries it, and the results show who picked each option, who said each word. Presentations without
// it stay anonymous, as before.
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
import { ACTIVITIES, activityToBody } from "@/lib/activities";
import { audienceResults } from "@/lib/answers";
import { namesFor, privacyLine, reportPrivacy } from "@/lib/names";
import { NameGate } from "@/components/vote/NameGate";
import { WhoAnswered } from "@/components/results/WhoAnswered";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const as = (init: RequestInit = {}) => ({ ...init, headers: { cookie, origin: ORIGIN, "content-type": "application/json" } });
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const create = (body: Record<string, unknown>) =>
  adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, as({ method: "POST", body: JSON.stringify({ criteria: [], ...body }) })));
const edit = (code: string, body: unknown) =>
  adminSession.PUT(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as({ method: "PUT", body: JSON.stringify(body) })), ctx(code));
const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));
const exported = async (code: string, type: string) =>
  (await exportRoute.GET(new Request(`${ORIGIN}/x?type=${type}`, { headers: { cookie } }), ctx(code))).text();

const QUESTIONS = [
  { name: "Coffee or tea?", kind: "poll", topics: ["Coffee", "Tea"] },
  { name: "Where are you joining from?", kind: "words" },
  { name: "What do you like?", kind: "multi", topics: ["Pizza", "Pasta", "Salad"] },
  { name: "Anything else?", kind: "text" },
  { name: "Order these", kind: "rank", topics: ["Red", "Green", "Blue"] },
];

async function make(named: boolean | undefined) {
  const res = await create({ title: "Team", focusTopics: QUESTIONS, ...(named === undefined ? {} : { named }) });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = await info(code);
  const [poll, words, multi, text, rank] = s.focusTopics;
  const opt = (focusId: string, name: string) => s.topics.find((t) => t.focusId === focusId && t.name === name)!.id;
  return { code, s, poll, words, multi, text, rank, opt };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("named@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("a presentation with names on", () => {
  it("is off unless asked for, and every team activity turns it on", async () => {
    const plain = await make(undefined);
    expect(plain.s.session.named ?? false).toBe(false);
    const on = await make(true);
    expect(on.s.session.named).toBe(true);
    for (const a of ACTIVITIES) expect(activityToBody(a), a.id).toMatchObject({ named: true });
  });

  it("can be turned on or off when editing; leaving it out keeps it", async () => {
    const { code, s } = await make(true);
    const body = {
      title: "Team",
      scaleMax: 5,
      lowLabel: "Low",
      highLabel: "High",
      criteria: [],
      focusTopics: s.focusTopics.map((f) => ({ id: f.id, name: f.name, kind: f.kind, chart: f.chart, topics: s.topics.filter((t) => t.focusId === f.id).map((t) => ({ id: t.id, name: t.name })) })),
    };
    expect((await edit(code, body)).status).toBe(200);
    expect((await info(code)).session.named).toBe(true);
    expect((await edit(code, { ...body, named: false })).status).toBe(200);
    expect((await info(code)).session.named).toBe(false);
  });

  it("shows who picked each option, who said each word, who put what first, and signs open answers", async () => {
    const { code, poll, words, multi, text, rank, opt } = await make(true);
    const ana = randomUUID();
    const ravi = randomUUID();
    expect((await answer({ kind: "poll", code, focusId: poll.id, voterId: ana, topicId: opt(poll.id, "Coffee"), author: "Ana" })).status).toBe(200);
    expect((await answer({ kind: "poll", code, focusId: poll.id, voterId: ravi, topicId: opt(poll.id, "Tea"), author: "Ravi" })).status).toBe(200);
    await answer({ kind: "words", code, focusId: words.id, voterId: ana, words: ["Bengaluru"], author: "Ana" });
    await answer({ kind: "words", code, focusId: words.id, voterId: ravi, words: ["bengaluru", "home"], author: "Ravi" });
    await answer({ kind: "multi", code, focusId: multi.id, voterId: ana, topicIds: [opt(multi.id, "Pizza"), opt(multi.id, "Salad")], author: "Ana" });
    await answer({ kind: "text", code, focusId: text.id, voterId: ana, text: "More breaks", author: "Ana" });
    await answer({ kind: "rank", code, focusId: rank.id, voterId: ravi, topicIds: [opt(rank.id, "Blue"), opt(rank.id, "Red"), opt(rank.id, "Green")], author: "Ravi" });

    const r = await results(code);
    expect(namesFor(r, poll.id, opt(poll.id, "Coffee"))).toEqual(["Ana"]);
    expect(namesFor(r, poll.id, opt(poll.id, "Tea"))).toEqual(["Ravi"]);
    expect(namesFor(r, words.id, "bengaluru")).toEqual(["Ana", "Ravi"]);
    expect(namesFor(r, words.id, "home")).toEqual(["Ravi"]);
    expect(namesFor(r, multi.id, opt(multi.id, "Pizza"))).toEqual(["Ana"]);
    expect(namesFor(r, multi.id, opt(multi.id, "Pasta"))).toEqual([]);
    expect(namesFor(r, rank.id, opt(rank.id, "Blue"))).toEqual(["Ravi"]);
    expect(r.texts.find((t) => t.focusId === text.id)).toMatchObject({ text: "More breaks", author: "Ana" });
  });

  it("uses the latest name for all of a person's answers", async () => {
    const { code, poll, words, opt } = await make(true);
    const v = randomUUID();
    await answer({ kind: "poll", code, focusId: poll.id, voterId: v, topicId: opt(poll.id, "Tea"), author: "Kim" });
    await answer({ kind: "words", code, focusId: words.id, voterId: v, words: ["Pune"], author: "Kimberly" });
    const r = await results(code);
    expect(namesFor(r, poll.id, opt(poll.id, "Tea"))).toEqual(["Kimberly"]);
  });

  it("keeps bad words off the names", async () => {
    const { code, poll, opt } = await make(true);
    const res = await answer({ kind: "poll", code, focusId: poll.id, voterId: randomUUID(), topicId: opt(poll.id, "Tea"), author: "sh1t head" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("blocked_words");
    expect((await results(code)).who ?? []).toEqual([]);
  });

  it("are shown to the room too when results are on phones (it's a team activity)", async () => {
    const { code, poll, opt } = await make(true);
    await answer({ kind: "poll", code, focusId: poll.id, voterId: randomUUID(), topicId: opt(poll.id, "Tea"), author: "Ana" });
    const r = await results(code);
    expect(namesFor(audienceResults(r, new Set()), poll.id, opt(poll.id, "Tea"))).toEqual(["Ana"]);
  });

  it("are cleared with the answers", async () => {
    const { code, poll, opt } = await make(true);
    const v = randomUUID();
    await answer({ kind: "poll", code, focusId: poll.id, voterId: v, topicId: opt(poll.id, "Tea"), author: "Ana" });
    const res = await resetRoute.POST(new Request(`${ORIGIN}/x`, as({ method: "POST" })), ctx(code));
    expect(res.status).toBe(200);
    await answer({ kind: "poll", code, focusId: poll.id, voterId: v, topicId: opt(poll.id, "Tea") });
    expect(namesFor(await results(code), poll.id, opt(poll.id, "Tea"))).toEqual([]);
  });

  it("go in the Markdown export", async () => {
    const { code, poll, opt } = await make(true);
    await answer({ kind: "poll", code, focusId: poll.id, voterId: randomUUID(), topicId: opt(poll.id, "Coffee"), author: "Ana" });
    await answer({ kind: "poll", code, focusId: poll.id, voterId: randomUUID(), topicId: opt(poll.id, "Coffee"), author: "Ravi" });
    expect(await exported(code, "markdown")).toMatch(/Coffee[^\n]*\n[^\n]*Ana, Ravi/);
  });
});

describe("a presentation without names stays anonymous", () => {
  it("ignores a name sent with an answer", async () => {
    const { code, poll, text, opt } = await make(false);
    const v = randomUUID();
    expect((await answer({ kind: "poll", code, focusId: poll.id, voterId: v, topicId: opt(poll.id, "Tea"), author: "Ana" })).status).toBe(200);
    await answer({ kind: "text", code, focusId: text.id, voterId: v, text: "Hello", author: "Ana" });
    const r = await results(code);
    expect(r.who ?? []).toEqual([]);
    expect(r.texts[0].author ?? null).toBeNull();
    expect(await exported(code, "markdown")).not.toContain("Ana");
  });
});

describe("on the phone", () => {
  it("says honestly who sees what", () => {
    expect(privacyLine({ named: true, boards: false })).toMatch(/show your name/i);
    expect(privacyLine({ named: false, boards: true })).toMatch(/board show your name/i);
    expect(privacyLine({ named: false, boards: false })).toMatch(/anonymous/i);
  });

  it("asks for a name once before the first question, and won't go on without one", () => {
    const html = renderToStaticMarkup(createElement(NameGate, { title: "This or that", initial: "", onDone: () => {} }));
    expect(html).toContain("Your name");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*Start/);
    const filled = renderToStaticMarkup(createElement(NameGate, { title: "This or that", initial: "Ana", onDone: () => {} }));
    expect(filled).not.toMatch(/<button[^>]*disabled[^>]*>[^<]*Start/);
  });

  it("the voter page uses the gate and sends the name with every answer", () => {
    const src = read("components/VoteApp.tsx");
    expect(src).toContain("<NameGate");
    expect(src).toMatch(/session\.named/);
    expect(src).toContain("privacyLine(");
  });
});

describe("in the report", () => {
  it("doesn't call answers anonymous when names show", () => {
    expect(reportPrivacy({ named: true, boards: false })).not.toMatch(/anonymous/i);
    expect(reportPrivacy({ named: true, boards: false })).toMatch(/names/i);
    expect(reportPrivacy({ named: false, boards: true })).toMatch(/board[^.]*name/i);
    expect(reportPrivacy({ named: false, boards: false })).toMatch(/anonymous/i);
    const app = read("components/admin/ReportApp.tsx");
    expect(app).toContain("report.privacy");
    expect(app).not.toContain("Answers are anonymous.");
  });
});

describe("on the results screen", () => {
  it("lists who picked each option", () => {
    const html = renderToStaticMarkup(
      createElement(WhoAnswered, {
        rows: [
          { key: "a", label: "Coffee", names: ["Ana", "Ravi"] },
          { key: "b", label: "Tea", names: [] },
        ],
      }),
    );
    expect(html).toContain("Coffee");
    expect(html).toContain("Ana");
    expect(html).toContain("Ravi");
    expect(html).toContain("Nobody yet");
  });

  it("is on the presenter's screen and the builder can turn names on", () => {
    expect(read("components/DashboardApp.tsx")).toContain("<WhoAnswered");
    const form = read("components/admin/PresentationForm.tsx");
    expect(form).toMatch(/named/);
    expect(form).toContain("Show who answered");
  });

  it("is in the database schema", () => {
    const schema = read("db/schema.sql");
    expect(schema).toMatch(/add column if not exists named boolean/);
    expect(schema).toMatch(/create table if not exists voter_names/);
  });
});
