import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb, truncateAll } from "./neon-pglite";
import { ORIGIN, cookieFrom, signUp } from "./auth-helpers";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as purgeRoute from "@/app/api/cron/purge/route";
import { GUEST_DAYS } from "@/lib/guest-rules";

let db: PGlite;
const SECRET = "test-cron-secret-0123456789";

const newGuest = async () => {
  const res = await guestRoute.POST(new Request(`${ORIGIN}/api/auth/guest`, { method: "POST", headers: { origin: ORIGIN } }));
  return cookieFrom(res)!;
};
const create = async (cookie: string, title: string) => {
  const res = await adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ title, focusTopics: [{ name: "F", topics: ["a"] }], criteria: ["c"] }),
    }),
  );
  return ((await res.json()) as { code: string }).code;
};
const purge = (auth?: string) => purgeRoute.GET(new Request(`${ORIGIN}/api/cron/purge`, { headers: auth ? { authorization: auth } : {} }));
const titles = async () => (await db.query<{ title: string }>("select title from sessions order by title")).rows.map((r) => r.title);

beforeAll(async () => {
  db = await startTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.exec("delete from users");
  process.env.CRON_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("guest data is kept 7 days, then deleted for good", () => {
  it("guest presentations last 7 days", async () => {
    expect(GUEST_DAYS).toBe(7);
    const cookie = await newGuest();
    await create(cookie, "Mine");
    const listed = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }))).json()) as {
      sessions: { expiresAt: string }[];
    };
    const hours = (Date.parse(listed.sessions[0].expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(167.9);
    expect(hours).toBeLessThanOrEqual(168);
  });

  it("a daily job deletes expired guest presentations with all their answers, even when no new guest comes along", async () => {
    const cookie = await newGuest();
    await create(cookie, "Old");
    await create(cookie, "Fresh");
    await db.exec("insert into votes (session_id, topic_id, criterion_id, voter_id, score) select s.id, t.id, c.id, gen_random_uuid(), 3 from sessions s join topics t on t.session_id = s.id join criteria c on c.session_id = s.id");
    await db.exec("update sessions set expires_at = now() - interval '1 second' where title = 'Old'");

    const res = await purge(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sessions: 1 });
    expect(await titles()).toEqual(["Fresh"]);
    expect((await db.query<{ n: number }>("select count(*)::int n from votes")).rows[0].n).toBe(1);
  });

  it("deletes guest accounts older than 7 days once they have nothing left", async () => {
    const cookie = await newGuest();
    await create(cookie, "Old");
    await db.exec("update sessions set expires_at = now() - interval '1 second'");
    await db.exec(`update users set created_at = now() - interval '${GUEST_DAYS} days 1 minute'`);
    await db.exec("update auth_sessions set expires_at = now() - interval '1 second'");
    const res = await purge(`Bearer ${SECRET}`);
    expect(await res.json()).toMatchObject({ sessions: 1, users: 1 });
    expect((await db.query<{ n: number }>("select count(*)::int n from users")).rows[0].n).toBe(0);
  });

  it("never cuts short a guest presentation made late: the old guest account stays until it expires", async () => {
    const cookie = await newGuest();
    await create(cookie, "Made on day 6");
    await db.exec(`update users set created_at = now() - interval '${GUEST_DAYS} days 1 minute'`);
    await db.exec("update auth_sessions set expires_at = now() - interval '1 second'");
    await purge(`Bearer ${SECRET}`);
    expect(await titles()).toEqual(["Made on day 6"]);
  });

  it("leaves saved accounts and their presentations alone, however old", async () => {
    const { cookie } = await signUp("keep@example.com");
    await create(cookie!, "Account talk");
    await db.exec("update sessions set created_at = now() - interval '400 days'");
    await db.exec("update users set created_at = now() - interval '400 days'");
    await purge(`Bearer ${SECRET}`);
    expect(await titles()).toEqual(["Account talk"]);
    expect((await db.query<{ n: number }>("select count(*)::int n from users")).rows[0].n).toBe(1);
  });

  it("only Vercel's scheduler can run it (secret required; refused if no secret is set)", async () => {
    expect((await purge()).status).toBe(401);
    expect((await purge("Bearer wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await purge("Bearer undefined")).status).toBe(401);
    expect((await purge("Bearer ")).status).toBe(401);
  });

  it("is scheduled once a day in vercel.json", () => {
    const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { crons?: { path: string; schedule: string }[] };
    const job = config.crons?.find((c) => c.path === "/api/cron/purge");
    expect(job).toBeTruthy();
    expect(job!.schedule.split(" ")).toHaveLength(5);
    expect(job!.schedule).toMatch(/^\d+ \d+ \* \* \*$/);
  });
});
