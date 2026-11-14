// Team activities: open answers shown as a board (leaves on a tree, sticky notes, stars),
// optionally signed with a name, and a collection of ready-made activities.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as publicResults from "@/app/api/results/[code]/public/route";
import * as answerRoute from "@/app/api/answer/route";
import { ACTIVITIES, activityToBody } from "@/lib/activities";
import { arrivalOrder, BOARDS, boardSpot, leafTilt, MAX_AUTHOR } from "@/lib/boards";
import { createSessionSchema } from "@/lib/validation";
import { chartsFor } from "@/lib/charts";
import { groupByFocus } from "@/lib/focus";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

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
const answer = (code: string, focusId: string, voterId: string, text: string, author?: string) =>
  answerRoute.POST(
    new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify({ kind: "text", code, focusId, voterId, text, ...(author === undefined ? {} : { author }) }) }),
  );

async function tree(extra: Record<string, unknown> = {}) {
  const res = await create({ title: "Motivation tree", focusTopics: [{ name: "What motivates you?", kind: "text", board: "tree" }], ...extra });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  return { code, focusId: (await info(code)).focusTopics[0].id };
}

function editBody(s: SessionPayload, patch: (f: SessionPayload["focusTopics"][number]) => Record<string, unknown> = () => ({})) {
  return {
    title: s.session.title,
    scaleMax: s.session.scaleMax,
    lowLabel: s.session.lowLabel,
    highLabel: s.session.highLabel,
    focusTopics: s.focusTopics.map((f) => ({ id: f.id, name: f.name, kind: f.kind, chart: f.chart, board: f.board, topics: [], ...patch(f) })),
    criteria: [],
  };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("activities@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("boards: an open answer question shown as leaves, notes or stars", () => {
  it("has three looks", () => {
    expect(BOARDS.map((b) => b.id)).toEqual(["tree", "wall", "sky"]);
    for (const b of BOARDS) expect(b.label.length).toBeGreaterThan(0);
  });

  it("is saved on an open answer question and sent to phones", async () => {
    const { code } = await tree();
    expect((await info(code)).focusTopics[0].board).toBe("tree");
  });

  it("is null when not asked for, and on other question types", async () => {
    const res = await create({
      title: "Mix",
      focusTopics: [
        { name: "Plain", kind: "text" },
        { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"], board: "tree" },
      ],
    });
    const { code } = (await res.json()) as { code: string };
    expect((await info(code)).focusTopics.map((f) => f.board)).toEqual([null, null]);
  });

  it("opens the results on the board, unless the presenter picked another view", async () => {
    const res = await create({
      title: "Views",
      focusTopics: [
        { name: "Leaves", kind: "text", board: "tree" },
        { name: "Spot", kind: "text", board: "sky", chart: "spotlight" },
        { name: "Plain", kind: "text", chart: "board" },
        { name: "Plain too", kind: "text" },
      ],
    });
    const { code } = (await res.json()) as { code: string };
    expect((await info(code)).focusTopics.map((f) => f.chart)).toEqual(["board", "spotlight", "wall", "wall"]);
  });

  it("offers the board view first, named after the board, only on board questions", () => {
    expect(chartsFor("text", null).map((c) => c.id)).toEqual(["wall", "spotlight"]);
    expect(chartsFor("text", "tree").map((c) => [c.id, c.label])).toEqual([
      ["board", "Tree"],
      ["wall", "Answer wall"],
      ["spotlight", "One at a time"],
    ]);
    expect(chartsFor("text", "wall")[0].label).toBe("Sticky notes");
    expect(chartsFor("poll", null).map((c) => c.id)).toEqual(["bars", "columns", "pie", "donut"]);
  });

  it("reaches the results screen with each question", () => {
    const groups = groupByFocus(
      [
        { id: "a", name: "Leaves", kind: "text", board: "tree" },
        { id: "b", name: "Plain", kind: "text" },
      ],
      [],
    );
    expect(groups.map((g) => g.board)).toEqual(["tree", null]);
  });

  it("refuses an unknown look", async () => {
    const res = await create({ title: "x", focusTopics: [{ name: "Q", kind: "text", board: "volcano" }] });
    expect(res.status).toBe(400);
  });

  it("can be changed and removed when editing, keeping the answers", async () => {
    const { code, focusId } = await tree();
    await answer(code, focusId, crypto.randomUUID(), "Learning new things");
    let s = await info(code);
    expect((await edit(code, editBody(s, () => ({ board: "sky" })))).status).toBe(200);
    s = await info(code);
    expect(s.focusTopics[0].board).toBe("sky");
    expect((await edit(code, editBody(s, () => ({ board: null })))).status).toBe(200);
    expect((await info(code)).focusTopics[0].board).toBeNull();
    expect((await results(code)).texts.map((t) => t.text)).toEqual(["Learning new things"]);
  });
});

describe("signing an answer with a name (optional)", () => {
  it("keeps the name on a board question, tidied", async () => {
    const { code, focusId } = await tree();
    expect((await answer(code, focusId, crypto.randomUUID(), "My team", "  Priya   S ")).status).toBe(200);
    expect((await answer(code, focusId, crypto.randomUUID(), "Shipping things"))).toHaveProperty("status", 200);
    const texts = (await results(code)).texts;
    expect(texts.find((t) => t.text === "My team")?.author).toBe("Priya S");
    expect(texts.find((t) => t.text === "Shipping things")?.author).toBeNull();
  });

  it("treats a blank name as no name, and changing the answer can drop the name", async () => {
    const { code, focusId } = await tree();
    const me = crypto.randomUUID();
    await answer(code, focusId, me, "Growth", "   ");
    expect((await results(code)).texts[0].author).toBeNull();
    await answer(code, focusId, me, "Growth", "Sam");
    expect((await results(code)).texts[0].author).toBe("Sam");
    await answer(code, focusId, me, "Growth and people");
    expect((await results(code)).texts[0]).toMatchObject({ text: "Growth and people", author: null });
  });

  it(`is at most ${MAX_AUTHOR} characters`, async () => {
    const { code, focusId } = await tree();
    expect((await answer(code, focusId, crypto.randomUUID(), "x", "a".repeat(MAX_AUTHOR + 1))).status).toBe(400);
    expect((await answer(code, focusId, crypto.randomUUID(), "x", "a".repeat(MAX_AUTHOR))).status).toBe(200);
  });

  it("is never stored on a plain open answer (those stay anonymous)", async () => {
    const res = await create({ title: "Retro", focusTopics: [{ name: "What went well?", kind: "text" }] });
    const { code } = (await res.json()) as { code: string };
    const focusId = (await info(code)).focusTopics[0].id;
    expect((await answer(code, focusId, crypto.randomUUID(), "Demos", "Priya")).status).toBe(200);
    expect((await results(code)).texts[0].author).toBeNull();
  });

  it("shows on voters' phones when results are shared, but hidden answers don't", async () => {
    const { code, focusId } = await tree({ showResults: true });
    await answer(code, focusId, crypto.randomUUID(), "Kind teammates", "Ana");
    const pub = (await (await publicResults.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as ResultsPayload;
    expect(pub.texts.map((t) => [t.text, t.author])).toEqual([["Kind teammates", "Ana"]]);
  });

  it("goes into the exports next to the answer", async () => {
    const { code, focusId } = await tree();
    await answer(code, focusId, crypto.randomUUID(), "Autonomy", "Ravi");
    await answer(code, focusId, crypto.randomUUID(), "Coffee");
    const md = await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=markdown`, { headers: { cookie } }), ctx(code))).text();
    expect(md).toContain("Autonomy — Ravi");
    expect(md).toContain("- Coffee");
    const raw = await (await exportRoute.GET(new Request(`${ORIGIN}/x?type=raw`, { headers: { cookie } }), ctx(code))).text();
    expect(raw).toContain("Autonomy — Ravi");
  });
});

describe("creating a presentation with results already shared on phones", () => {
  it("can turn on results on phones from the start", async () => {
    const { code } = await tree({ showResults: true });
    const res = await publicResults.GET(new Request(`${ORIGIN}/x`), ctx(code));
    expect(res.status).toBe(200);
  });

  it("keeps them off by default", async () => {
    const { code } = await tree();
    expect((await publicResults.GET(new Request(`${ORIGIN}/x`), ctx(code))).status).not.toBe(200);
  });
});

describe("board layout", () => {
  it("puts every spot inside the board", () => {
    for (const b of BOARDS)
      for (let i = 0; i < 300; i++) {
        const p = boardSpot(b.id, i);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
  });

  it("never moves an earlier leaf when new ones arrive (a spot depends only on its place in line)", () => {
    expect(boardSpot("tree", 7)).toEqual(boardSpot("tree", 7));
    const first = Array.from({ length: 10 }, (_, i) => boardSpot("tree", i));
    const later = Array.from({ length: 40 }, (_, i) => boardSpot("tree", i)).slice(0, 10);
    expect(later).toEqual(first);
  });

  it("spreads the first 40 leaves so none sit on top of each other", () => {
    for (const id of ["tree", "sky"] as const) {
      const pts = Array.from({ length: 40 }, (_, i) => boardSpot(id, i));
      let closest = Infinity;
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) closest = Math.min(closest, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
      expect(closest).toBeGreaterThan(0.04);
    }
  });

  it("keeps a leaf in its spot when its answer is edited (ordered by when it was first sent)", () => {
    const a = { id: "a", at: "2026-11-14T10:05:00.000Z", created: "2026-11-14T10:00:00.000Z" };
    const b = { id: "b", at: "2026-11-14T10:02:00.000Z", created: "2026-11-14T10:02:00.000Z" };
    expect(arrivalOrder([b, a]).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("tilts each leaf a little, the same way every time", () => {
    const t = leafTilt("3f1c2a90-0000-4000-8000-000000000000");
    expect(t).toBe(leafTilt("3f1c2a90-0000-4000-8000-000000000000"));
    expect(Math.abs(t)).toBeLessThanOrEqual(14);
  });
});

describe("the activity collection", () => {
  it("has at least 8 team activities with different ids", () => {
    expect(ACTIVITIES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
  });

  it("starts with the Motivation tree, on a tree board", () => {
    const tree = ACTIVITIES[0];
    expect(tree.id).toBe("motivation-tree");
    expect(tree.plan.questions[0]).toMatchObject({ kind: "text", board: "tree" });
  });

  it("gives every activity a way to run it, a length and a valid presentation with results on phones", () => {
    for (const a of ACTIVITIES) {
      expect(a.label.length, a.id).toBeGreaterThan(0);
      expect(a.icon.length, a.id).toBeGreaterThan(0);
      expect(a.blurb.length, a.id).toBeGreaterThan(0);
      expect(a.steps.length, a.id).toBeGreaterThanOrEqual(2);
      expect(a.minutes, a.id).toBeGreaterThan(0);
      const body = activityToBody(a);
      expect(body.showResults, a.id).toBe(true);
      const parsed = createSessionSchema.safeParse(body);
      expect(parsed.success, `${a.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it("only puts boards on open answer questions", () => {
    for (const a of ACTIVITIES) for (const q of a.plan.questions) if (q.board) expect(q.kind, a.id).toBe("text");
  });

  it("includes a Sailboat retro with its four parts", () => {
    const boat = ACTIVITIES.find((a) => a.id === "sailboat");
    expect(boat?.plan.questions).toHaveLength(4);
    expect(boat?.plan.questions.every((q) => q.kind === "text" && q.board === "wall")).toBe(true);
  });

  it("can be made for real", async () => {
    for (const a of ACTIVITIES) {
      const res = await create(activityToBody(a));
      expect(res.status, a.id).toBe(201);
    }
  });
});
