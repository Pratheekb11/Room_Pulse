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

  it("guest sign-in ends when the browser closes, and after 12 hours at most", async () => {
    const res = await post(guestRoute.POST, "/api/auth/guest", {});
    expect(res.headers.get("set-cookie")).not.toMatch(/Max-Age|Expires/i);
    const row = (await db.query<{ hours: number }>("select round(extract(epoch from expires_at - now()) / 3600)::int as hours from auth_sessions")).rows;
    expect(row[0].hours).toBe(12);
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
    const results = (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as { cells: { n: number }[] };
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
    expect((await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).status).toBe(404);
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

import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";

describe("one guest can't reach another guest's presentations", () => {
  it("returns 404 for every presenter action on someone else's guest presentation", async () => {
    const owner = await guest();
    const other = await guest();
    const { code } = (await (await create(owner, "Private")).json()) as { code: string };
    const ctx = { params: Promise.resolve({ code }) };
    const as = (cookie: string, init: RequestInit = {}) => ({
      ...init,
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
    });

    expect(await list(other)).toEqual([]);
    expect((await adminSession.PATCH(new Request(`${ORIGIN}/x`, as(other, { method: "PATCH", body: '{"isOpen":false}' })), ctx)).status).toBe(404);
    expect((await resetRoute.POST(new Request(`${ORIGIN}/x`, as(other, { method: "POST" })), ctx)).status).toBe(404);
    expect((await exportRoute.GET(new Request(`${ORIGIN}/x?type=raw`, as(other)), ctx)).status).toBe(404);
    expect((await adminSession.DELETE(new Request(`${ORIGIN}/x`, as(other, { method: "DELETE" })), ctx)).status).toBe(404);
    // A guest can't take over another guest by "saving" with the owner's cookie missing
    expect((await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "x@example.com", password: "a long passphrase" }, { cookie: other })).status).toBe(200);
    expect(await list(other)).toEqual([]);

    expect(await list(owner)).toEqual(["Private"]);
  });

  it("each guest gets a different, unguessable sign-in token", async () => {
    const a = await guest();
    const b = await guest();
    expect(a).not.toEqual(b);
    expect(decodeURIComponent(a.split("=")[1]).length).toBeGreaterThanOrEqual(43);
  });
});


import * as guestReturnRoute from "@/app/api/auth/guest-return/route";

describe("guest PIN", () => {
  async function guestWithPin() {
    const res = await post(guestRoute.POST, "/api/auth/guest", {});
    const body = (await res.json()) as { pin: string };
    const cookie = cookieFrom(res)!;
    const { code } = (await (await create(cookie, "Mine")).json()) as { code: string };
    return { pin: body.pin, cookie, code };
  }
  const back = (code: string, pin: string) => post(guestReturnRoute.POST, "/api/auth/guest-return", { code, pin });

  it("gives a 6-digit PIN once and stores only a hash", async () => {
    const { pin } = await guestWithPin();
    expect(pin).toMatch(/^\d{6}$/);
    const row = (await db.query<{ guest_pin_hash: string }>("select guest_pin_hash from users")).rows[0];
    expect(row.guest_pin_hash).toMatch(/^scrypt\$/);
    expect(row.guest_pin_hash).not.toContain(pin);
  });

  it("lets the guest back in on another device with a presentation code and the PIN", async () => {
    const { pin, code } = await guestWithPin();
    const res = await back(code.toUpperCase(), pin);
    expect(res.status).toBe(200);
    expect(await list(cookieFrom(res)!)).toEqual(["Mine"]);
  });

  it("answers the same for a wrong PIN, an unknown code and a non-guest presentation", async () => {
    const { pin, code } = await guestWithPin();
    const member = (await signUp("member@example.com")).cookie!;
    const { code: memberCode } = (await (await create(member, "Member's")).json()) as { code: string };
    const wrongPin = await back(code, pin === "000000" ? "111111" : "000000");
    const unknown = await back("zzzzzz", pin);
    const notGuest = await back(memberCode, pin);
    for (const r of [wrongPin, unknown, notGuest]) {
      expect(r.status).toBe(401);
      expect(cookieFrom(r)).toBeNull();
    }
    const bodies = await Promise.all([wrongPin.json(), unknown.json(), notGuest.json()]);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
  });

  it("locks the guest for an hour after 5 wrong PINs", async () => {
    const { pin, code } = await guestWithPin();
    const wrong = pin === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await back(code, wrong)).status).toBe(401);
    expect((await back(code, pin)).status).toBe(429);
    await db.exec("update login_failures set at = now() - interval '61 minutes'");
    expect((await back(code, pin)).status).toBe(200);
  });

  it("stops working once the presentations expire or the account is saved", async () => {
    const a = await guestWithPin();
    await db.exec(`update sessions set expires_at = now() - interval '1 second' where code = '${a.code}'`);
    expect((await back(a.code, a.pin)).status).toBe(401);

    const b = await guestWithPin();
    await post(upgradeRoute.POST, "/api/auth/upgrade", { email: "b@example.com", password: "a long passphrase" }, { cookie: b.cookie });
    expect((await back(b.code, b.pin)).status).toBe(401);
  });

  it("rejects malformed input and other sites", async () => {
    expect((await post(guestReturnRoute.POST, "/api/auth/guest-return", { code: "abc234", pin: "12ab56" })).status).toBe(401);
    expect((await post(guestReturnRoute.POST, "/api/auth/guest-return", { code: "abc234", pin: "123456" }, { origin: "https://evil.example" })).status).toBe(403);
  });
});
