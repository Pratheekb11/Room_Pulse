// Finishing the team activities (2026-11-15): the host's "how to run it" steps in the builder, boards drawn
// in the All questions cards, the heatmap and the report, hiding just the name on an answer, a leaf limit
// per board, and five more activities.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as moderateRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as publicResults from "@/app/api/results/[code]/public/route";
import * as answerRoute from "@/app/api/answer/route";
import { ACTIVITIES, activityToBody } from "@/lib/activities";
import { leafLimit, MAX_LEAVES, MAX_LEAVES_LIMIT, parseLeafKey } from "@/lib/boards";
import { createSessionSchema } from "@/lib/validation";
import { heatRows } from "@/lib/heat";
import { groupByFocus } from "@/lib/focus";
import { indexCells } from "@/lib/stats";
import { buildReport } from "@/lib/report";
import { BoardThumb } from "@/components/BoardThumb";
import { BoardCard } from "@/components/vote/BoardCard";
import { audienceResults } from "@/lib/answers";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

let db: PGlite;
let cookie = "";
let otherCookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const as = (init: RequestInit = {}, who = cookie) => ({ ...init, headers: { cookie: who, origin: ORIGIN, "content-type": "application/json" } });
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const create = (body: Record<string, unknown>) =>
  adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, as({ method: "POST", body: JSON.stringify({ criteria: [], ...body }) })));
const edit = (code: string, body: unknown) =>
  adminSession.PUT(new Request(`${ORIGIN}/api/admin/sessions/${code}`, as({ method: "PUT", body: JSON.stringify(body) })), ctx(code));
const moderate = (code: string, body: Record<string, unknown>, who = cookie) =>
  moderateRoute.PATCH(new Request(`${ORIGIN}/x`, as({ method: "PATCH", body: JSON.stringify(body) }, who)), ctx(code));
const leaf = (code: string, focusId: string, voterId: string, slot: number, text: string, author = "Kim") =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify({ kind: "text", code, focusId, voterId, slot, text, author }) }));
const exported = async (code: string, type: string) =>
  (await exportRoute.GET(new Request(`${ORIGIN}/x?type=${type}`, { headers: { cookie } }), ctx(code))).text();

async function board(q: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const res = await create({ title: "Tree", focusTopics: [{ name: "What motivates you?", kind: "text", board: "tree", ...q }], ...extra });
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  return { code, focusId: (await info(code)).focusTopics[0].id };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("finish@example.com")).cookie!;
  otherCookie = (await signUp("finish-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

// ---------------------------------------------------------------- 1. how to run it

describe("the host's 'how to run it' steps", () => {
  const form = read("components/admin/PresentationForm.tsx");

  it("are kept with the start the builder remembers, so a refresh doesn't lose them", () => {
    expect(form).toMatch(/steps\?: string\[\]/);
    expect(form).toMatch(/applyPlan\(a\.plan, `the “\$\{a\.label\}” activity`, true, a\.steps\)/);
  });

  it("show in the builder under 'Started from', as a numbered list", () => {
    expect(form).toContain("How to run it");
    expect(form).toMatch(/<ol[^>]*>[\s\S]{0,400}?steps\.map/);
  });

  it("show on the results screen for a presentation made from an activity", async () => {
    const { activityFor } = await import("@/lib/activities");
    expect(activityFor("Our motivation tree")?.id).toBe("motivation-tree");
    expect(activityFor("Something else")).toBeNull();
    const dash = read("components/DashboardApp.tsx");
    expect(dash).toContain("<HowToRun");
  });
});

// ---------------------------------------------------------------- 2. boards drawn everywhere

const BOARD_INFO: SessionPayload = {
  session: { code: "abc123", title: "Retro", scaleMax: 5, lowLabel: "Low", highLabel: "High", isOpen: true, revision: 0, theme: "paper", decor: true },
  focusTopics: [
    { id: "tr", name: "What motivates you?", kind: "text", chart: "board", board: "tree" },
    { id: "wl", name: "Kudos", kind: "text", chart: "board", board: "wall" },
    { id: "sk", name: "Goals", kind: "text", chart: "board", board: "sky" },
    { id: "pl", name: "Anything else?", kind: "text", chart: "wall" },
  ],
  topics: [],
  criteria: [],
};
const at = (m: number) => `2026-11-15T10:${String(m).padStart(2, "0")}:00.000Z`;
const BOARD_RESULTS: ResultsPayload = {
  isOpen: true,
  voterCount: 3,
  cells: [],
  dist: [],
  polls: [],
  words: [],
  ranks: [],
  numbers: [],
  texts: [
    { id: "a1", focusId: "tr", hidden: false, text: "Growth", author: "Ana", at: at(1), created: at(1) },
    { id: "a2", focusId: "tr", hidden: false, text: "My team", author: "Ravi", at: at(2), created: at(2) },
    { id: "a3", focusId: "tr", hidden: true, text: "HIDDEN-LEAF", author: "Zed", at: at(3), created: at(3) },
    { id: "a4", focusId: "tr", hidden: false, text: "Coffee", author: null, nameHidden: true, at: at(4), created: at(4) },
    { id: "b1", focusId: "wl", hidden: false, text: "Thanks Lee", author: "Kim", at: at(1), created: at(1) },
    { id: "p1", focusId: "pl", hidden: false, text: "More breaks", at: at(1) },
  ],
  respondents: [{ focusId: "tr", n: 3 }, { focusId: "wl", n: 1 }, { focusId: "pl", n: 1 }],
  questions: [],
  quizCounts: [],
} as unknown as ResultsPayload;

describe("a board drawn small (BoardThumb)", () => {
  const thumb = (board: "tree" | "wall" | "sky", pieces: { id: string; text: string; author?: string | null }[]) =>
    renderToStaticMarkup(createElement(BoardThumb, { board, pieces }));

  it("draws a leaf per answer on the tree, a note per answer on the wall and a star per answer in the sky", () => {
    const pieces = [
      { id: "a", text: "Growth", author: "Ana" },
      { id: "b", text: "My team", author: "Ravi" },
    ];
    expect(thumb("tree", pieces).match(/data-piece/g)).toHaveLength(2);
    expect(thumb("wall", pieces).match(/data-piece/g)).toHaveLength(2);
    expect(thumb("sky", pieces).match(/data-piece/g)).toHaveLength(2);
  });

  it("names the picture for screen readers and says how many answers", () => {
    const html = thumb("tree", [{ id: "a", text: "Growth", author: "Ana" }]);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="A tree with 1 leaf"/);
    expect(thumb("wall", [])).toMatch(/aria-label="A wall with 0 notes"/);
    expect(thumb("sky", [{ id: "a", text: "x" }, { id: "b", text: "y" }])).toMatch(/aria-label="A night sky with 2 stars"/);
  });

  it("is still: no hooks, no animation, so it prints and fits any card", () => {
    const src = read("components/BoardThumb.tsx");
    expect(src).not.toMatch(/use(State|Effect|Ref|Layout)/);
    expect(src).not.toContain("animate-");
    expect(src).toContain("cqw");
  });
});

describe("boards in the All questions cards", () => {
  it("draws the board instead of listing three answers", () => {
    const src = read("components/FocusOverview.tsx");
    expect(src).toContain("<BoardThumb");
    expect(src).toMatch(/g\.board/);
  });
});

describe("boards in the heatmap", () => {
  const groups = groupByFocus(BOARD_INFO.focusTopics, BOARD_INFO.topics);
  const { rows, skipped } = heatRows(groups, [], indexCells([]), BOARD_RESULTS, 5);

  it("gives each board question a row with its pieces, without hidden answers or hidden names", () => {
    const tree = rows.find((r) => r.focusId === "tr")!;
    expect(tree.board?.id).toBe("tree");
    expect(tree.board?.pieces.map((p) => p.text)).toEqual(["Growth", "My team", "Coffee"]);
    expect(tree.board?.pieces.map((p) => p.author)).toEqual(["Ana", "Ravi", null]);
    expect(rows.find((r) => r.focusId === "wl")?.board?.id).toBe("wall");
    expect(rows.find((r) => r.focusId === "sk")?.board).toMatchObject({ id: "sky", pieces: [] });
  });

  it("still lists plain open answers as not shown", () => {
    expect(skipped).toEqual(["Anything else?"]);
  });

  it("is drawn by the heatmap", () => {
    expect(read("components/ResultsHeatmap.tsx")).toContain("<BoardThumb");
  });
});

describe("boards in the report", () => {
  const report = buildReport(BOARD_INFO, BOARD_RESULTS);
  const section = (id: string) => report.sections.find((s) => s.focusId === id)!;

  it("says which board and keeps each answer's name", () => {
    expect(section("tr").board).toBe("tree");
    expect(section("tr").pieces.map((p) => [p.text, p.author])).toEqual([
      ["Growth", "Ana"],
      ["My team", "Ravi"],
      ["Coffee", null],
    ]);
    expect(section("tr").texts).toEqual(["Growth — Ana", "My team — Ravi", "Coffee"]);
    expect(section("pl").board).toBeNull();
    expect(JSON.stringify(report)).not.toMatch(/HIDDEN-LEAF|Zed/);
  });

  it("draws the board on the page", () => {
    expect(read("components/admin/ReportApp.tsx")).toContain("<BoardThumb");
  });
});

// ---------------------------------------------------------------- 3. hide just the name

describe("hiding only the name on an answer", () => {
  it("lets the owner hide a name; the answer stays on the board without it", async () => {
    const { code, focusId } = await board({}, { showResults: true });
    await leaf(code, focusId, crypto.randomUUID(), 0, "Growth", "RudeName");
    const id = (await results(code)).texts[0].id;

    expect((await moderate(code, { id, nameHidden: true })).status).toBe(200);
    const [t] = (await results(code)).texts;
    expect(t).toMatchObject({ text: "Growth", hidden: false, nameHidden: true, author: null });

    const pub = (await (await publicResults.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as ResultsPayload;
    expect(JSON.stringify(pub)).not.toContain("RudeName");
    expect(await exported(code, "markdown")).not.toContain("RudeName");
    expect(await exported(code, "raw")).not.toContain("RudeName");
    expect(await exported(code, "markdown")).toContain("Growth — (name hidden)");
  });

  it("keeps the name hidden when its writer changes the answer, and shows it again on request", async () => {
    const { code, focusId } = await board();
    const me = crypto.randomUUID();
    await leaf(code, focusId, me, 0, "Growth", "RudeName");
    const id = (await results(code)).texts[0].id;
    await moderate(code, { id, nameHidden: true });
    await leaf(code, focusId, me, 0, "Growth!", "RudeName2");
    expect((await results(code)).texts[0]).toMatchObject({ text: "Growth!", author: null, nameHidden: true });

    await moderate(code, { id, nameHidden: false });
    expect((await results(code)).texts[0]).toMatchObject({ author: "RudeName2", nameHidden: false });
  });

  it("can hide the answer and its name separately", async () => {
    const { code, focusId } = await board();
    await leaf(code, focusId, crypto.randomUUID(), 0, "Growth", "Ana");
    const id = (await results(code)).texts[0].id;
    await moderate(code, { id, hidden: true });
    expect((await results(code)).texts[0]).toMatchObject({ hidden: true, nameHidden: false, author: "Ana" });
  });

  it("refuses an empty change and strangers", async () => {
    const { code, focusId } = await board();
    await leaf(code, focusId, crypto.randomUUID(), 0, "Growth", "Ana");
    const id = (await results(code)).texts[0].id;
    expect((await moderate(code, { id })).status).toBe(400);
    expect((await moderate(code, { id, nameHidden: true }, otherCookie)).status).toBe(404);
    expect((await results(code)).texts[0].author).toBe("Ana");
  });

  it("never sends a hidden name to phones, even if a payload carried one", () => {
    const r = { ...BOARD_RESULTS, texts: [{ ...BOARD_RESULTS.texts[0], author: "Leak", nameHidden: true }] } as ResultsPayload;
    expect(JSON.stringify(audienceResults(r, new Set()))).not.toContain("Leak");
  });

  it("has Hide name / Show name next to Hide on the big leaf", () => {
    const src = read("components/results/BoardView.tsx");
    expect(src).toContain("Hide name");
    expect(src).toContain("Show name");
    expect(read("components/results/TextResults.tsx")).toContain("nameHidden");
  });
});

// ---------------------------------------------------------------- 4. leaf limit per board

describe("how many leaves each person may add, per board", () => {
  it("defaults to 5 and goes up to 10", () => {
    expect(MAX_LEAVES).toBe(5);
    expect(MAX_LEAVES_LIMIT).toBe(10);
    expect(leafLimit({ maxLeaves: null })).toBe(5);
    expect(leafLimit({})).toBe(5);
    expect(leafLimit({ maxLeaves: 8 })).toBe(8);
    expect(parseLeafKey("f#9")).toEqual({ focusId: "f", slot: 9 });
    expect(parseLeafKey("f#10")).toBeNull();
  });

  it("is saved with a board question and sent to phones", async () => {
    const { code } = await board({ maxLeaves: 8 });
    expect((await info(code)).focusTopics[0].maxLeaves).toBe(8);
    const plain = await create({ title: "x", focusTopics: [{ name: "Anything?", kind: "text", maxLeaves: 8 }] });
    const pcode = ((await plain.json()) as { code: string }).code;
    expect((await info(pcode)).focusTopics[0].maxLeaves ?? null).toBeNull();
  });

  it("refuses less than 1 or more than 10", async () => {
    for (const n of [0, 11]) {
      const res = await create({ title: "x", focusTopics: [{ name: "Leaves", kind: "text", board: "tree", maxLeaves: n }] });
      expect(res.status, String(n)).toBe(400);
    }
  });

  it("lets a person add up to the limit and no more", async () => {
    const { code, focusId } = await board({ maxLeaves: 8 });
    const me = crypto.randomUUID();
    expect((await leaf(code, focusId, me, 7, "Eighth")).status).toBe(200);
    expect((await leaf(code, focusId, me, 8, "Ninth")).status).toBe(400);

    const small = await board({ maxLeaves: 2 });
    expect((await leaf(small.code, small.focusId, me, 1, "Second")).status).toBe(200);
    expect((await leaf(small.code, small.focusId, me, 2, "Third")).status).toBe(400);

    const plain = await board();
    expect((await leaf(plain.code, plain.focusId, me, 5, "Sixth")).status).toBe(400);
  });

  it("can be changed when editing", async () => {
    const { code } = await board();
    const s = await info(code);
    const f = s.focusTopics[0];
    const res = await edit(code, {
      title: s.session.title,
      scaleMax: s.session.scaleMax,
      lowLabel: s.session.lowLabel,
      highLabel: s.session.highLabel,
      criteria: [],
      focusTopics: [{ id: f.id, name: f.name, kind: f.kind, chart: f.chart, board: f.board, maxLeaves: 3, topics: [] }],
    });
    expect(res.status).toBe(200);
    expect((await info(code)).focusTopics[0].maxLeaves).toBe(3);
  });

  it("the phone card counts against the board's own limit", () => {
    const html = renderToStaticMarkup(
      createElement(BoardCard, {
        question: "Q",
        color: "#000",
        board: "wall",
        leaves: ["a", "b"],
        maxLeaves: 2,
        disabled: false,
        onSave: () => {},
        onRemove: () => {},
        onFinish: () => {},
      }),
    );
    expect(html).toContain("Your notes (2 of 2)");
    expect(html).not.toContain("Add another note");
  });

  it("is a setting in the builder next to the board picker", () => {
    const form = read("components/admin/PresentationForm.tsx");
    expect(form).toContain("each person can add");
    expect(form).toMatch(/maxLeaves: f\.kind === "text" && f\.board \? \(f\.maxLeaves \?\? null\) : null/);
  });

  it("is in the database schema, with slots up to 9", () => {
    const schema = read("db/schema.sql");
    expect(schema).toMatch(/add column if not exists max_leaves/);
    expect(schema).toMatch(/slot between 0 and 9/);
    expect(schema).toMatch(/add column if not exists author_hidden/);
  });
});

// ---------------------------------------------------------------- 5. more activities

describe("five more activities", () => {
  const ids = ["two-truths", "gratitude-jar", "time-capsule", "team-map", "bucket-list"];

  it("are in the collection", () => {
    for (const id of ids) expect(ACTIVITIES.map((a) => a.id), id).toContain(id);
    expect(ACTIVITIES.length).toBe(14);
  });

  it("are valid presentations with results on phones", () => {
    for (const id of ids) {
      const a = ACTIVITIES.find((x) => x.id === id)!;
      const parsed = createSessionSchema.safeParse(activityToBody(a));
      expect(parsed.success, `${id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it("Two truths and a lie: three signed notes each, then a round of guessing", () => {
    const a = ACTIVITIES.find((x) => x.id === "two-truths")!;
    const [notes, ...rounds] = a.plan.questions;
    expect(notes).toMatchObject({ kind: "text", board: "wall", maxLeaves: 3 });
    expect(rounds.length).toBeGreaterThanOrEqual(3);
    for (const r of rounds) expect(r).toMatchObject({ kind: "poll", options: ["The first", "The second", "The third"] });
  });

  it("Time capsule says to save the results to open next year", () => {
    const a = ACTIVITIES.find((x) => x.id === "time-capsule")!;
    expect(a.steps.join(" ")).toMatch(/next year/i);
    expect(a.steps.join(" ")).toMatch(/report|download|export/i);
  });

  it("Team map asks where people join from, as a word cloud", () => {
    const a = ACTIVITIES.find((x) => x.id === "team-map")!;
    expect(a.plan.questions[0]).toMatchObject({ kind: "words" });
    expect(a.plan.questions[0].name).toMatch(/where/i);
  });

  it("can be made for real", async () => {
    for (const id of ids) {
      const res = await create(activityToBody(ACTIVITIES.find((x) => x.id === id)!));
      expect(res.status, id).toBe(201);
    }
  });

  it("the plan keeps a board's leaf limit when made", async () => {
    const res = await create(activityToBody(ACTIVITIES.find((x) => x.id === "two-truths")!));
    const { code } = (await res.json()) as { code: string };
    expect((await info(code)).focusTopics[0].maxLeaves).toBe(3);
  });
});
