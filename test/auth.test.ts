import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { cookieFrom, GOOD_PASSWORD, logIn, ORIGIN, signUp } from "./auth-helpers";
import * as meRoute from "@/app/api/auth/me/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as resetRoute from "@/app/api/admin/sessions/[code]/reset/route";
import * as recalcRoute from "@/app/api/admin/sessions/[code]/recalculate/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import { hashPassword, verifyPassword } from "@/lib/password";

let db: PGlite;

const me = (cookie: string | null) =>
  meRoute.GET(new Request(`${ORIGIN}/api/auth/me`, { headers: cookie ? { cookie } : {} }));

const authed = (cookie: string, init: RequestInit = {}) => ({
  ...init,
  headers: { cookie, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});

async function createSessionAs(cookie: string, title = "Mine") {
  const res = await adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, authed(cookie, {
      method: "POST",
      body: JSON.stringify({ title, focusTopics: [{ name: "F", topics: ["A"] }], criteria: ["X"] }),
    })),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { code: string }).code;
}

beforeAll(async () => {
  db = await startTestDb();
});

beforeEach(async () => {
  await db.exec("truncate users, sessions, auth_sessions, login_failures cascade");
});

describe("password hashing", () => {
  it("uses salted scrypt and verifies only the right password", async () => {
    const a = await hashPassword("hunter2hunter2");
    const b = await hashPassword("hunter2hunter2");
    expect(a).toMatch(/^scrypt\$/);
    expect(a).not.toContain("hunter2");
    expect(a).not.toBe(b); // unique salt per hash
    expect(await verifyPassword("hunter2hunter2", a)).toBe(true);
    expect(await verifyPassword("hunter2hunter3", a)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("sign up", () => {
  it("creates an account, signs the user in and never stores the plain password", async () => {
    const { res, cookie } = await signUp("  Ada@Example.com ");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ user: { email: "ada@example.com" } });

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Max-Age=\d+/i);

    const row = (await db.query<{ email: string; password_hash: string }>("select email, password_hash from users")).rows;
    expect(row).toHaveLength(1);
    expect(row[0].email).toBe("ada@example.com");
    expect(row[0].password_hash).not.toContain(GOOD_PASSWORD);

    expect(await (await me(cookie)).json()).toEqual({ user: { email: "ada@example.com" } });
  });

  it("stores only a hash of the session token", async () => {
    const { cookie } = await signUp("ada@example.com");
    const token = decodeURIComponent(cookie!.split("=")[1]);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const stored = (await db.query<{ token_hash: string }>("select token_hash from auth_sessions")).rows;
    expect(stored).toHaveLength(1);
    expect(stored[0].token_hash).not.toContain(token);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await signUp("ada@example.com");
    const { res, cookie } = await signUp("ADA@example.com");
    expect(res.status).toBe(409);
    expect(cookie).toBeNull();
  });

  it("validates email and password", async () => {
    for (const [email, pw] of [
      ["not-an-email", GOOD_PASSWORD],
      ["ada@example.com", "short"], // under 10 characters
      ["ada@example.com", "x".repeat(129)], // over 128 characters
      ["ada@example.com", "ada@example.com"], // same as email
    ]) {
      expect((await signUp(email, pw)).res.status, `${email} / ${pw.length}`).toBe(400);
    }
    expect((await db.query("select 1 from users")).rows).toHaveLength(0);
  });
});

describe("log in / log out", () => {
  beforeEach(async () => {
    await signUp("ada@example.com");
  });

  it("logs in with the right password", async () => {
    const { res, cookie } = await logIn("ADA@example.com");
    expect(res.status).toBe(200);
    expect((await me(cookie)).status).toBe(200);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await logIn("ada@example.com", "wrong password!!");
    const unknown = await logIn("nobody@example.com", "wrong password!!");
    expect(wrong.res.status).toBe(401);
    expect(unknown.res.status).toBe(401);
    expect(await wrong.res.json()).toEqual(await unknown.res.json());
    expect(wrong.cookie).toBeNull();
  });

  it("locks the email for a while after 10 failed attempts", async () => {
    for (let i = 0; i < 10; i++) expect((await logIn("ada@example.com", "wrong password!!")).res.status).toBe(401);
    expect((await logIn("ada@example.com")).res.status).toBe(429);
    // Older failures stop counting once they are outside the window.
    await db.exec("update login_failures set at = now() - interval '16 minutes'");
    expect((await logIn("ada@example.com")).res.status).toBe(200);
  });

  it("logout invalidates the session server-side and clears the cookie", async () => {
    const { cookie } = await logIn("ada@example.com");
    const res = await logoutRoute.POST(new Request(`${ORIGIN}/api/auth/logout`, { method: "POST", headers: { cookie: cookie!, origin: ORIGIN } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect((await me(cookie)).status).toBe(401);
  });

  it("rejects expired and forged sessions", async () => {
    const { cookie } = await logIn("ada@example.com");
    expect((await me("lr_session=forged-token-value")).status).toBe(401);
    expect((await me(null)).status).toBe(401);
    await db.exec("update auth_sessions set expires_at = now() - interval '1 second'");
    expect((await me(cookie)).status).toBe(401);
  });

  it("rejects state-changing requests from another origin", async () => {
    const res = await logIn("ada@example.com", GOOD_PASSWORD, { origin: "https://evil.example" });
    expect(res.res.status).toBe(403);
    expect(cookieFrom(res.res)).toBeNull();
  });
});

describe("presenter routes are per-account", () => {
  it("require a signed-in user (the old admin password no longer works)", async () => {
    process.env.ADMIN_PASSWORD = "old";
    const res = await adminSessions.GET(new Request(`${ORIGIN}/api/admin/sessions`, { headers: { "x-admin-key": "old" } }));
    expect(res.status).toBe(401);
  });

  it("blocks cross-origin writes even with a valid cookie", async () => {
    const { cookie } = await signUp("ada@example.com");
    const res = await adminSessions.POST(
      new Request(`${ORIGIN}/api/admin/sessions`, authed(cookie!, {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: JSON.stringify({ title: "x", focusTopics: [{ name: "F", topics: ["A"] }], criteria: ["X"] }),
      })),
    );
    expect(res.status).toBe(403);
  });

  it("each account only sees and controls its own sessions", async () => {
    const ada = (await signUp("ada@example.com")).cookie!;
    const bob = (await signUp("bob@example.com")).cookie!;
    const adaCode = await createSessionAs(ada, "Ada's");
    await createSessionAs(bob, "Bob's");

    const list = async (c: string) =>
      ((await (await adminSessions.GET(new Request(`${ORIGIN}/x`, authed(c)))).json()) as { sessions: { title: string }[] }).sessions.map((s) => s.title);
    expect(await list(ada)).toEqual(["Ada's"]);
    expect(await list(bob)).toEqual(["Bob's"]);

    const ctx = { params: Promise.resolve({ code: adaCode }) };
    expect((await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed(bob, { method: "PATCH", body: '{"isOpen":false}' })), ctx)).status).toBe(404);
    expect((await resetRoute.POST(new Request(`${ORIGIN}/x`, authed(bob, { method: "POST" })), ctx)).status).toBe(404);
    expect((await recalcRoute.POST(new Request(`${ORIGIN}/x`, authed(bob, { method: "POST" })), ctx)).status).toBe(404);
    expect((await exportRoute.GET(new Request(`${ORIGIN}/x?type=raw`, authed(bob)), ctx)).status).toBe(404);
    expect((await adminSession.DELETE(new Request(`${ORIGIN}/x`, authed(bob, { method: "DELETE" })), ctx)).status).toBe(404);

    // Still there and still open for Ada.
    expect(await list(ada)).toEqual(["Ada's"]);
    expect((await adminSession.PATCH(new Request(`${ORIGIN}/x`, authed(ada, { method: "PATCH", body: '{"isOpen":false}' })), ctx)).status).toBe(200);
  });
});
