import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { cookieFrom, GOOD_PASSWORD, logIn, ORIGIN, signUp } from "./auth-helpers";
import * as meRoute from "@/app/api/auth/me/route";
import * as verifyRoute from "@/app/api/auth/verify/route";
import * as resendRoute from "@/app/api/auth/resend-verification/route";
import * as forgotRoute from "@/app/api/auth/forgot/route";
import * as resetRoute from "@/app/api/auth/reset/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import { sentEmails } from "@/lib/email";

let db: PGlite;
const SITE = "https://liverate.example";

const post = (handler: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  handler(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  );

const me = async (cookie: string | null) => {
  const res = await meRoute.GET(new Request(`${ORIGIN}/api/auth/me`, { headers: cookie ? { cookie } : {} }));
  return { status: res.status, body: res.ok ? ((await res.json()) as { user: { email: string; emailVerified: boolean } }) : null };
};

/** Token from the last email sent to `to` whose link goes to `path`. */
function tokenFromEmail(to: string, path: "/verify" | "/reset"): string {
  const mail = [...sentEmails].reverse().find((m) => m.to === to && m.text.includes(`${SITE}${path}?token=`));
  if (!mail) throw new Error(`no ${path} email to ${to}`);
  return new URL(mail.text.match(new RegExp(`${SITE}${path}\\?token=[A-Za-z0-9_-]+`))![0]).searchParams.get("token")!;
}

const createPresentation = (cookie: string) =>
  adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ title: "T", focusTopics: [{ name: "F", topics: ["a"] }], criteria: ["c"] }),
    }),
  );

beforeAll(async () => {
  db = await startTestDb();
  process.env.EMAIL_TRANSPORT = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = SITE;
  process.env.REQUIRE_EMAIL_VERIFICATION = "true";
});

beforeEach(async () => {
  await db.exec("truncate users, sessions, auth_sessions, login_failures, email_tokens cascade");
  sentEmails.length = 0;
});

describe("email verification", () => {
  it("sign-up sends a verification link; unverified accounts can't create presentations", async () => {
    const { cookie } = await signUp("ada@example.com", undefined, { verify: false });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("ada@example.com");
    expect(sentEmails[0].subject).toMatch(/verify|confirm/i);

    expect((await me(cookie)).body?.user).toEqual({ email: "ada@example.com", guest: false, emailVerified: false });
    const blocked = await createPresentation(cookie!);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: "verify_email" });
  });

  it("the link verifies the email once; reuse, junk and expired links fail", async () => {
    const { cookie } = await signUp("ada@example.com", undefined, { verify: false });
    const token = tokenFromEmail("ada@example.com", "/verify");

    expect((await post(verifyRoute.POST, "/api/auth/verify", { token })).status).toBe(200);
    expect((await me(cookie)).body?.user.emailVerified).toBe(true);
    expect((await createPresentation(cookie!)).status).toBe(201);

    expect((await post(verifyRoute.POST, "/api/auth/verify", { token })).status).toBe(400);
    expect((await post(verifyRoute.POST, "/api/auth/verify", { token: "x".repeat(43) })).status).toBe(400);

    await signUp("bob@example.com", undefined, { verify: false });
    const bobToken = tokenFromEmail("bob@example.com", "/verify");
    await db.exec("update email_tokens set expires_at = now() - interval '1 second'");
    expect((await post(verifyRoute.POST, "/api/auth/verify", { token: bobToken })).status).toBe(400);
  });

  it("stores only a hash of the token", async () => {
    await signUp("ada@example.com", undefined, { verify: false });
    const token = tokenFromEmail("ada@example.com", "/verify");
    const rows = (await db.query<{ token_hash: string }>("select token_hash from email_tokens")).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toContain(token);
  });

  it("resending works when signed in and is limited to 3 emails an hour", async () => {
    const { cookie } = await signUp("ada@example.com", undefined, { verify: false }); // email 1
    const resend = () => post(resendRoute.POST, "/api/auth/resend-verification", {}, { cookie: cookie! });
    expect((await resend()).status).toBe(200); // 2
    expect((await resend()).status).toBe(200); // 3
    expect((await resend()).status).toBe(429);
    expect(sentEmails).toHaveLength(3);
    expect((await post(resendRoute.POST, "/api/auth/resend-verification", {})).status).toBe(401);
  });

  it("links use the configured site URL, never the request's Host header", async () => {
    await post((r) => signUpRaw(r), "/api/auth/signup", { email: "ada@example.com", password: GOOD_PASSWORD }, { host: "evil.example" });
    expect(sentEmails[0].text).toContain(`${SITE}/verify?token=`);
    expect(sentEmails[0].text).not.toContain("evil.example");
  });
});

async function signUpRaw(r: Request) {
  const mod = await import("@/app/api/auth/signup/route");
  return mod.POST(r);
}

describe("password reset", () => {
  const forgot = (email: string) => post(forgotRoute.POST, "/api/auth/forgot", { email });

  it("answers the same for known and unknown emails, and only emails real accounts", async () => {
    await signUp("ada@example.com");
    sentEmails.length = 0;
    const known = await forgot("ADA@example.com");
    const unknown = await forgot("nobody@example.com");
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(sentEmails.map((m) => m.to)).toEqual(["ada@example.com"]);
    expect(sentEmails[0].subject).toMatch(/reset/i);
  });

  it("sets a new password, signs out every other session and verifies the email", async () => {
    const { cookie: oldCookie } = await signUp("ada@example.com", undefined, { verify: false });
    await forgot("ada@example.com");
    const token = tokenFromEmail("ada@example.com", "/reset");

    expect((await post(resetRoute.POST, "/api/auth/reset", { token, password: "short" })).status).toBe(400);
    const res = await post(resetRoute.POST, "/api/auth/reset", { token, password: "a brand new passphrase" });
    expect(res.status).toBe(200);
    const newCookie = cookieFrom(res);
    expect(newCookie).not.toBeNull();

    expect((await me(oldCookie)).status).toBe(401); // old session gone
    expect((await me(newCookie)).body?.user).toEqual({ email: "ada@example.com", guest: false, emailVerified: true });
    expect((await logIn("ada@example.com", GOOD_PASSWORD)).res.status).toBe(401);
    expect((await logIn("ada@example.com", "a brand new passphrase")).res.status).toBe(200);

    // single use
    expect((await post(resetRoute.POST, "/api/auth/reset", { token, password: "another passphrase!" })).status).toBe(400);
  });

  it("clears a login lockout once the password is reset", async () => {
    await signUp("ada@example.com");
    for (let i = 0; i < 10; i++) await logIn("ada@example.com", "wrong password!!");
    expect((await logIn("ada@example.com")).res.status).toBe(429);
    await forgot("ada@example.com");
    const token = tokenFromEmail("ada@example.com", "/reset");
    await post(resetRoute.POST, "/api/auth/reset", { token, password: "a brand new passphrase" });
    expect((await logIn("ada@example.com", "a brand new passphrase")).res.status).toBe(200);
  });

  it("rejects expired reset links and verification links used as reset links", async () => {
    await signUp("ada@example.com", undefined, { verify: false });
    const verifyToken = tokenFromEmail("ada@example.com", "/verify");
    expect((await post(resetRoute.POST, "/api/auth/reset", { token: verifyToken, password: "a brand new passphrase" })).status).toBe(400);

    await forgot("ada@example.com");
    const resetToken = tokenFromEmail("ada@example.com", "/reset");
    expect((await post(verifyRoute.POST, "/api/auth/verify", { token: resetToken })).status).toBe(400);

    await db.exec("update email_tokens set expires_at = now() - interval '1 second' where purpose = 'reset'");
    expect((await post(resetRoute.POST, "/api/auth/reset", { token: resetToken, password: "a brand new passphrase" })).status).toBe(400);
  });

  it("sends at most 3 reset emails an hour per account", async () => {
    await signUp("ada@example.com");
    sentEmails.length = 0;
    for (let i = 0; i < 5; i++) expect((await forgot("ada@example.com")).status).toBe(200);
    expect(sentEmails).toHaveLength(3);
  });

  it("refuses cross-site requests", async () => {
    const res = await post(forgotRoute.POST, "/api/auth/forgot", { email: "ada@example.com" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });
});
