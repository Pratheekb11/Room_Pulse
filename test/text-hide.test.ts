// Open answers: the owner can hide one from the big screen (kept in results and exports, flagged).
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as moderateRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import { visibleTexts } from "@/lib/answers";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
let otherCookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const moderate = (code: string, body: Record<string, unknown>, as = cookie) =>
  moderateRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify(body) }, as)), ctx(code));
const answer = (code: string, focusId: string, voterId: string, text: string) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify({ kind: "text", code, focusId, voterId, text }) }));

async function newText() {
  const res = await adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, authed({ method: "POST", body: JSON.stringify({ title: "Retro", focusTopics: [{ name: "What went well?", kind: "text" }], criteria: [] }) })),
  );
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
  return { code, focusId: s.focusTopics[0].id };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("text-hide@example.com")).cookie!;
  otherCookie = (await signUp("text-hide-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("hiding open answers", () => {
  it("gives each answer an id, not hidden to start with", async () => {
    const { code, focusId } = await newText();
    await answer(code, focusId, crypto.randomUUID(), "Shipping on time");
    const [t] = (await results(code)).texts;
    expect(t).toMatchObject({ text: "Shipping on time", hidden: false });
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("lets the owner hide and show an answer again; editing it doesn't unhide it", async () => {
    const { code, focusId } = await newText();
    const rude = crypto.randomUUID();
    await answer(code, focusId, rude, "something rude");
    await answer(code, focusId, crypto.randomUUID(), "Good demos");
    const id = (await results(code)).texts.find((t) => t.text === "something rude")!.id;

    expect((await moderate(code, { id, hidden: true })).status).toBe(200);
    let r = await results(code);
    expect(r.texts.find((t) => t.id === id)?.hidden).toBe(true);
    expect(visibleTexts(r.texts, focusId).map((t) => t.text)).toEqual(["Good demos"]);

    await answer(code, focusId, rude, "still rude");
    r = await results(code);
    expect(r.texts.find((t) => t.id === id)).toMatchObject({ text: "still rude", hidden: true });

    await moderate(code, { id, hidden: false });
    expect(visibleTexts((await results(code)).texts, focusId)).toHaveLength(2);
  });

  it("only lets the owner hide answers", async () => {
    const { code, focusId } = await newText();
    await answer(code, focusId, crypto.randomUUID(), "hello");
    const id = (await results(code)).texts[0].id;
    expect((await moderate(code, { id, hidden: true }, otherCookie)).status).toBe(404);
    expect((await moderate(code, { id, hidden: true }, "")).status).toBe(401);
    expect((await moderate(code, { id: crypto.randomUUID(), hidden: true })).status).toBe(404);
    expect((await moderate(code, { id })).status).toBe(400);
  });

  it("marks hidden answers in the raw export", async () => {
    const { code, focusId } = await newText();
    await answer(code, focusId, crypto.randomUUID(), "hide me");
    const id = (await results(code)).texts[0].id;
    await moderate(code, { id, hidden: true });
    const raw = await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=raw`, authed()), ctx(code))).text();
    expect(raw).toMatch(/Hidden answer/);
  });
});
