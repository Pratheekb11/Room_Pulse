import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { startTestDb, truncateAll } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import type { SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const as = (init: RequestInit = {}) => ({ ...init, headers: { cookie, origin: ORIGIN, "content-type": "application/json" } });
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const revision = async (code: string) => ((await (await statusRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as { revision: number }).revision;

async function create(extra: Record<string, unknown> = {}) {
  const body = { title: "Talk", focusTopics: [{ name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] }], criteria: [], ...extra };
  const res = await adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, as({ method: "POST", body: JSON.stringify(body) })));
  return res;
}

function editBody(s: SessionPayload, extra: Record<string, unknown> = {}) {
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
      topics: s.topics.filter((t) => t.focusId === f.id).map((t) => ({ id: t.id, name: t.name })),
    })),
    criteria: [],
    ...extra,
  };
}
const edit = (code: string, body: unknown) =>
  adminSession.PUT(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as({ method: "PUT", body: JSON.stringify(body) })), ctx(code));

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("themes@example.com")).cookie!;
});
beforeEach(async () => {
  await truncateAll(db);
});

describe("slide design (theme) of a presentation", () => {
  it("is Paper unless the presenter picks one", async () => {
    const { code } = (await (await create()).json()) as { code: string };
    expect((await info(code)).session.theme).toBe("paper");
  });

  it("keeps the picked design, and phones see it", async () => {
    const res = await create({ theme: "midnight" });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect((await info(code)).session.theme).toBe("midnight");
  });

  it("saves the anime design", async () => {
    const { code } = (await (await create({ theme: "anime" })).json()) as { code: string };
    expect((await info(code)).session.theme).toBe("anime");
  });

  it("illustrations are on by default, can be turned off, and an edit without them keeps the setting", async () => {
    const { code } = (await (await create()).json()) as { code: string };
    expect((await info(code)).session.decor).toBe(true);
    const s = await info(code);
    expect((await edit(code, editBody(s, { decor: false }))).status).toBe(200);
    expect((await info(code)).session.decor).toBe(false);
    expect((await edit(code, editBody(s))).status).toBe(200);
    expect((await info(code)).session.decor).toBe(false);
  });

  it("refuses a design that doesn't exist", async () => {
    expect((await create({ theme: "sparkly" })).status).toBe(400);
  });

  it("changing it in the editor reaches phones (revision bumps); leaving it out keeps it", async () => {
    const { code } = (await (await create({ theme: "chalk" })).json()) as { code: string };
    const s = await info(code);
    const before = await revision(code);

    expect((await edit(code, editBody(s))).status).toBe(200);
    expect((await info(code)).session.theme).toBe("chalk");

    expect((await edit(code, editBody(s, { theme: "arcade" }))).status).toBe(200);
    expect((await info(code)).session.theme).toBe("arcade");
    expect(await revision(code)).toBe(before + 2);
  });
});
