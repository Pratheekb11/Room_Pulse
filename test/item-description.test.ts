import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { startTestDb, truncateAll } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import { MAX_ITEM_DESCRIPTION } from "@/lib/validation";
import type { SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const as = (init: RequestInit = {}) => ({ ...init, headers: { cookie, origin: ORIGIN, "content-type": "application/json" } });
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const create = (q: Record<string, unknown>) =>
  adminSessions.POST(
    new Request(
      `${ORIGIN}/api/admin/sessions`,
      as({ method: "POST", body: JSON.stringify({ title: "Ideas", criteria: ["Impact"], focusTopics: [{ name: "Score these", kind: "rating", ...q }] }) }),
    ),
  );
const edit = (code: string, body: unknown) =>
  adminSession.PUT(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as({ method: "PUT", body: JSON.stringify(body) })), ctx(code));
const described = (s: SessionPayload) => Object.fromEntries(s.topics.map((t) => [t.name, t.description]));

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("items@example.com")).cookie!;
});
beforeEach(async () => {
  await truncateAll(db);
});

describe("a description for each item to score", () => {
  it("is saved per item (matched by name, whatever the spacing or case) and sent to phones", async () => {
    const res = await create({
      topics: ["Dark mode", "Offline  mode", "Faster search"],
      itemDescriptions: { "dark mode": "A night theme for the whole app", "Offline mode": "  Works on the train  ", "Faster search": "" },
    });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect(described(await info(code))).toEqual({
      "Dark mode": "A night theme for the whole app",
      "Offline mode": "Works on the train",
      "Faster search": null,
    });
  });

  it("is optional", async () => {
    const { code } = (await (await create({ topics: ["A", "B"] })).json()) as { code: string };
    expect(described(await info(code))).toEqual({ A: null, B: null });
  });

  it(`is at most ${MAX_ITEM_DESCRIPTION} characters`, async () => {
    expect(MAX_ITEM_DESCRIPTION).toBe(140);
    expect((await create({ topics: ["A"], itemDescriptions: { A: "x".repeat(141) } })).status).toBe(400);
    expect((await create({ topics: ["A"], itemDescriptions: { A: "x".repeat(140) } })).status).toBe(201);
  });

  it("can be added, changed and removed when editing, keeping the item's scores", async () => {
    const { code } = (await (await create({ topics: ["A", "B"], itemDescriptions: { A: "First" } })).json()) as { code: string };
    let s = await info(code);
    const body = (notes: Record<string, string>) => ({
      title: s.session.title,
      scaleMax: s.session.scaleMax,
      lowLabel: s.session.lowLabel,
      highLabel: s.session.highLabel,
      focusTopics: s.focusTopics.map((f) => ({
        id: f.id,
        name: f.name,
        kind: f.kind,
        chart: f.chart,
        topics: s.topics.map((t) => ({ id: t.id, name: t.name })),
        itemDescriptions: notes,
      })),
      criteria: s.criteria.map((c) => ({ id: c.id, name: c.name })),
    });
    const ids = s.topics.map((t) => t.id);
    expect((await edit(code, body({ A: "Changed", B: "New one" }))).status).toBe(200);
    s = await info(code);
    expect(described(s)).toEqual({ A: "Changed", B: "New one" });
    expect(s.topics.map((t) => t.id)).toEqual(ids);
    expect((await edit(code, body({ B: "New one" }))).status).toBe(200);
    expect(described(await info(code))).toEqual({ A: null, B: "New one" });
  });
});
