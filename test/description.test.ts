import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { startTestDb, truncateAll } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import { MAX_DESCRIPTION } from "@/lib/validation";
import { previewQuestions } from "@/lib/preview";
import { groupByFocus } from "@/lib/focus";
import type { SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const as = (init: RequestInit = {}) => ({ ...init, headers: { cookie, origin: ORIGIN, "content-type": "application/json" } });
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;

const create = (focusTopics: unknown[]) =>
  adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, as({ method: "POST", body: JSON.stringify({ title: "Talk", focusTopics, criteria: ["Impact"] }) })),
  );
const edit = (code: string, body: unknown) =>
  adminSession.PUT(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as({ method: "PUT", body: JSON.stringify(body) })), ctx(code));

function editBody(s: SessionPayload, patch: (f: SessionPayload["focusTopics"][number]) => Record<string, unknown> = () => ({})) {
  return {
    title: s.session.title,
    scaleMax: s.session.scaleMax,
    lowLabel: s.session.lowLabel,
    highLabel: s.session.highLabel,
    focusTopics: s.focusTopics.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      chart: f.chart,
      description: f.description,
      topics: s.topics.filter((t) => t.focusId === f.id).map((t) => ({ id: t.id, name: t.name })),
      ...patch(f),
    })),
    criteria: s.criteria.map((c) => ({ id: c.id, name: c.name })),
  };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("describe@example.com")).cookie!;
});
beforeEach(async () => {
  await truncateAll(db);
});

describe("question description: optional extra words under a question", () => {
  it("is saved and sent to phones, for any question type", async () => {
    const res = await create([
      { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"], description: "We order at 12. Pick what you'd eat." },
      { name: "Score these", kind: "rating", topics: ["A"], description: "  1 = not useful, 5 = must have  " },
      { name: "Thoughts?", kind: "text" },
    ]);
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    const s = await info(code);
    expect(s.focusTopics.map((f) => f.description)).toEqual(["We order at 12. Pick what you'd eat.", "1 = not useful, 5 = must have", null]);
  });

  it("blank counts as no description", async () => {
    const { code } = (await (await create([{ name: "Thoughts?", kind: "text", description: "   " }])).json()) as { code: string };
    expect((await info(code)).focusTopics[0].description).toBeNull();
  });

  it(`is at most ${MAX_DESCRIPTION} characters`, async () => {
    expect(MAX_DESCRIPTION).toBe(200);
    const res = await create([{ name: "Thoughts?", kind: "text", description: "x".repeat(MAX_DESCRIPTION + 1) }]);
    expect(res.status).toBe(400);
    expect((await create([{ name: "Thoughts?", kind: "text", description: "x".repeat(MAX_DESCRIPTION) }])).status).toBe(201);
  });

  it("can be added, changed and removed when editing, on old and new questions", async () => {
    const { code } = (await (await create([{ name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] }])).json()) as { code: string };
    let s = await info(code);
    const body = editBody(s, () => ({ description: "Vote by Friday" }));
    body.focusTopics.push({ name: "One word", kind: "words", chart: "cloud", description: "Anything goes", topics: [] } as never);
    expect((await edit(code, body)).status).toBe(200);
    s = await info(code);
    expect(s.focusTopics.map((f) => f.description)).toEqual(["Vote by Friday", "Anything goes"]);

    expect((await edit(code, editBody(s, (f) => (f.kind === "poll" ? { description: "" } : {})))).status).toBe(200);
    s = await info(code);
    expect(s.focusTopics.map((f) => f.description)).toEqual([null, "Anything goes"]);
  });

  it("reaches the phone and big-screen question groups", () => {
    const [g, h] = groupByFocus([{ id: "f1", name: "Lunch?", kind: "text", description: "By noon" }, { id: "f2", name: "Why?", kind: "text" }], []);
    expect(g.focus.description).toBe("By noon");
    expect(h.focus.description).toBeNull();
  });

  it("shows in the builder preview", () => {
    const [q] = previewQuestions([{ kind: "text", name: "Thoughts?", options: [], description: "Be honest" }]);
    expect(q.description).toBe("Be honest");
  });
});
