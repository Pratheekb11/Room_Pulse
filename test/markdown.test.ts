// "Copy as Markdown": results to paste into Slack, Notion or Jira after a retro.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as textRoute from "@/app/api/admin/sessions/[code]/text/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}) => ({
  ...init,
  headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const answer = (body: Record<string, unknown>) =>
  answerRoute.POST(new Request(`${ORIGIN}/api/answer`, { method: "POST", body: JSON.stringify(body) }));

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("markdown@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("Markdown export", () => {
  it("lists each question with its results, leaving hidden answers out", async () => {
    const res = await adminSessions.POST(
      new Request(
        `${ORIGIN}/x`,
        authed({
          method: "POST",
          body: JSON.stringify({
            title: "Sprint 12 retro",
            focusTopics: [
              { name: "How did it feel?", kind: "poll", topics: ["Great", "Rough"] },
              { name: "What should we try?", kind: "text" },
              { name: "Score it", kind: "number", min: 0, max: 10 },
            ],
            criteria: [],
          }),
        }),
      ),
    );
    const { code } = (await res.json()) as { code: string };
    const s = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
    const [poll, text, num] = s.focusTopics;
    const great = s.topics.find((t) => t.name === "Great")!.id;
    for (let i = 0; i < 3; i++) await answer({ kind: "poll", code, focusId: poll.id, voterId: crypto.randomUUID(), topicId: great });
    await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: "Pair on reviews" });
    await answer({ kind: "text", code, focusId: text.id, voterId: crypto.randomUUID(), text: "*rude*" });
    await answer({ kind: "number", code, focusId: num.id, voterId: crypto.randomUUID(), value: 8 });
    const r = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
    const rude = r.texts.find((t) => t.text === "*rude*")!;
    await textRoute.PATCH(new Request(`${ORIGIN}/x`, authed({ method: "PATCH", body: JSON.stringify({ id: rude.id, hidden: true }) })), ctx(code));

    const md = await exportRoute.GET(new Request(`${ORIGIN}/x?type=markdown`, authed()), ctx(code));
    expect(md.status).toBe(200);
    expect(md.headers.get("content-type")).toMatch(/text\/markdown/);
    const body = await md.text();
    expect(body).toContain("# Sprint 12 retro");
    expect(body).toContain("## How did it feel?");
    expect(body).toContain("- Great: 3 (100%)");
    expect(body).toContain("- Rough: 0 (0%)");
    expect(body).toContain("## What should we try?\n\n- Pair on reviews");
    expect(body).not.toContain("rude");
    expect(body).toContain("- Average: 8");
  });

  it("escapes Markdown in answers so they can't break the layout", async () => {
    const { toMarkdown } = await import("@/lib/markdown");
    const md = toMarkdown("T", [], [{ focus: "Q", label: "# not a heading [link](x)", kind: "Answer", average: null, n: 1 }]);
    expect(md).toContain("- \\# not a heading \\[link\\](x)");
  });
});
