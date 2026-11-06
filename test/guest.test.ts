import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { cookieFrom, logIn, ORIGIN, signUp } from "./auth-helpers";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as upgradeRoute from "@/app/api/auth/upgrade/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import { sentEmails } from "@/lib/email";

let db: PGlite;

const post = (handler: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  handler(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );

const me = async (cookie: string) =>
  (await (await meRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }))).json()) as {
    user: { email: string | null; guest: boolean; emailVerified: boolean };
  };

const create = (cookie: string, title = "T") =>
  adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ title, focusTopics: [{ name: "F", topics: ["a"] }], criteria: ["c"] }),
    }),
  );

const list = async (cookie: string) =>
  ((await (await adminSessions.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }))).json()) as { sessions: { title: string }[] }).sessions.map(
    (s) => s.title,
  );

async function guest() {
  const res = await post(guestRoute.POST, "/api/auth/guest", {});
  expect(res.status).toBe(201);
  return cookieFrom(res)!;
}

beforeAll(async () => {
  db = await startTestDb();
});

beforeEach(async () => {
  await db.exec("truncate users, sessions, auth_sessions, login_failures, email_tokens cascade");
  sentEmails.length = 0;
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
});

describe("guest mode", () => {
  it("signs in a guest with no email or password who can create presentations", async () => {
    const cookie = await guest();
    expect((await me(cookie)).user).toEqual({ email: null, guest: true, emailVerified: false });
    expect((await create(cookie)).status).toBe(201);
    const row = (await db.query<{ email: string | null; password_hash: string | null; is_guest: boolean }>("select email, password_hash, is_guest from users")).rows;
    expect(row).toEqual([{ email: null, password_hash: null, is_guest: true }]);
  });

  it("limits a guest to 3 presentations", async () => {
    const cookie = await guest();
    for (let i = 0; i < 3; i++) expect((await create(cookie, `P${i}`)).status).toBe(201);
    const fourth = await create(cookie, "P3");
    expect(fourth.status).toBe(403);
    expect(await fourth.json()).toEqual({ error: "guest_limit" });
  });

  it("keeps guests apart from each other", async () => {
    const a = await guest();
    const b = await guest();
    await create(a, "A's");
    expect(await list(a)).toEqual(["A's"]);
    expect(await list(b)).toEqual([]);
  });

  it("caps how many guest accounts can be created per hour across the site", async () => {
    await db.exec(`insert into users (is_guest) select true from generate_series(1, 300)`);
    expect((await post(guestRoute.POST, "/api/auth/guest", {})).status).toBe(429);
  });

  it("refuses cross-site guest creation", async () => {
    expect((await post(guestRoute.POST, "/api/auth/guest", {}, { origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("saving a guest account", () => {
  it("turns the guest into a normal account and keeps its presentations", async () => {
    const cookie = await guest();
    await create(cookie, "Kept");
    const res = await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "Ada@Example.com", password: "a long passphrase" }, { cookie });
    expect(res.status).toBe(200);
    expect((await me(cookie)).user).toMatchObject({ email: "ada@example.com", guest: false });
    expect(await list(cookie)).toEqual(["Kept"]);
    const fresh = await logIn("ada@example.com", "a long passphrase");
    expect(fresh.res.status).toBe(200);
    expect(await list(fresh.cookie!)).toEqual(["Kept"]);
  });

  it("lifts the 3-presentation limit once saved", async () => {
    const cookie = await guest();
    for (let i = 0; i < 3; i++) await create(cookie, `P${i}`);
    await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "ada@example.com", password: "a long passphrase" }, { cookie });
    expect((await create(cookie, "P3")).status).toBe(201);
  });

  it("rejects a taken email, a weak password, and non-guests", async () => {
    await signUp("taken@example.com");
    const cookie = await guest();
    expect((await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "taken@example.com", password: "a long passphrase" }, { cookie })).status).toBe(409);
    expect((await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "new@example.com", password: "short" }, { cookie })).status).toBe(400);
    const member = (await signUp("member@example.com")).cookie!;
    expect((await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "x@example.com", password: "a long passphrase" }, { cookie: member })).status).toBe(400);
    expect((await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "x@example.com", password: "a long passphrase" })).status).toBe(401);
  });
});

describe("email verification switch", () => {
  it("is not enforced while email isn't configured", async () => {
    const { cookie } = await signUp("ada@example.com", undefined, { verify: false });
    expect((await create(cookie!)).status).toBe(201);
  });

  it("is enforced once RESEND_API_KEY (or REQUIRE_EMAIL_VERIFICATION=true) is set", async () => {
    const { cookie } = await signUp("ada@example.com", undefined, { verify: false });
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    expect((await create(cookie!)).status).toBe(403);
  });
});

import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as voteRoute from "@/app/api/vote/route";
import type { SessionPayload } from "@/lib/types";

describe("guest 3-day limit", () => {
  const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
  async function guestPresentation() {
    const cookie = await guest();
    const { code } = (await (await create(cookie, "Guest deck")).json()) as { code: string };
    return { cookie, code };
  }

  it("guest sign-in lasts 3 days", async () => {
    const res = await post(guestRoute.POST, "/api/auth/guest", {});
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=259200\b/);
    const row = (await db.query<{ days: number }>("select round(extract(epoch from expires_at - now()) / 86400)::int as days from auth_sessions")).rows;
    expect(row[0].days).toBe(3);
  });

  it("stores votes in real time and shows an expiry date to the owner", async () => {
    const { cookie, code } = await guestPresentation();
    const info = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
    const v = await voteRoute.POST(
      new Request(`${ORIGIN}/api/vote`, {
        method: "POST",
        body: JSON.stringify({ code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: crypto.randomUUID(), score: 4 }),
      }),
    );
    expect(v.status).toBe(200);
    const results = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as { cells: { n: number }[] };
    expect(results.cells[0].n).toBe(1);

    const listed = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }))).json()) as {
      sessions: { expiresAt: string | null }[];
    };
    const hours = (Date.parse(listed.sessions[0].expiresAt!) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(71.9);
    expect(hours).toBeLessThanOrEqual(72);
  });

  it("after 3 days the presentation, its voting link and its results are gone", async () => {
    const { cookie, code } = await guestPresentation();
    const info = (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
    await db.exec("update sessions set expires_at = now() - interval '1 second'");

    expect((await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).status).toBe(404);
    expect((await resultsRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).status).toBe(404);
    const v = await voteRoute.POST(
      new Request(`${ORIGIN}/api/vote`, {
        method: "POST",
        body: JSON.stringify({ code, topicId: info.topics[0].id, criterionId: info.criteria[0].id, voterId: crypto.randomUUID(), score: 4 }),
      }),
    );
    expect(v.status).toBe(404);
    expect(await list(cookie)).toEqual([]);
  });

  it("expired guest data is deleted for good", async () => {
    await guestPresentation();
    await db.exec("update sessions set expires_at = now() - interval '1 second'");
    await db.exec("update users set created_at = now() - interval '4 days'");
    await db.exec("update auth_sessions set expires_at = now() - interval '1 second'");
    await guest(); // creating a guest also cleans up expired guest data
    const n = (await db.query<{ s: number; u: number }>("select (select count(*)::int from sessions) s, (select count(*)::int from users) u")).rows[0];
    expect(n).toEqual({ s: 0, u: 1 });
  });

  it("saving the account removes the limit", async () => {
    const { cookie, code } = await guestPresentation();
    await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "ada@example.com", password: "a long passphrase" }, { cookie });
    const listed = (await (await adminSessions.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }))).json()) as {
      sessions: { expiresAt: string | null }[];
    };
    expect(listed.sessions[0].expiresAt).toBeNull();
    const ttl = (await db.query<{ days: number }>("select round(extract(epoch from expires_at - now()) / 86400)::int as days from auth_sessions")).rows;
    expect(ttl[0].days).toBe(30);
    expect((await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).status).toBe(200);
  });
});
