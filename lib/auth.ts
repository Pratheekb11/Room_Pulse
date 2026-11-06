import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { deleteAuthSession, extendAuthSessions, findUserBySessionHash, insertAuthSession, type UserRow } from "./queries";
import { json } from "./http";

export const SESSION_DAYS = 30;

const secure = () => process.env.NODE_ENV === "production";
/** `__Host-` prefix (production): cookie is Secure, host-only and Path=/, so subdomains can't set or read it. */
const cookieName = () => (secure() ? "__Host-lr_session" : "lr_session");

export const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

function readToken(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const name = cookieName();
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      const value = decodeURIComponent(part.slice(i + 1).trim());
      return /^[A-Za-z0-9_-]{20,100}$/.test(value) ? value : null;
    }
  }
  return null;
}

/** maxAge null = browser-session cookie (gone when the browser closes). */
function cookie(value: string, maxAge: number | null): string {
  const attrs = [`${cookieName()}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAge !== null) attrs.push(`Max-Age=${maxAge}`);
  if (secure()) attrs.push("Secure");
  return attrs.join("; ");
}

/** Starts a signed-in session; returns the Set-Cookie header value. */
export async function startSession(userId: string, days = SESSION_DAYS): Promise<string> {
  const token = randomBytes(32).toString("base64url"); // 256 bits
  await insertAuthSession(hashToken(token), userId, days * 24 * 60);
  return cookie(token, days * 24 * 60 * 60);
}

/**
 * Guest sign-in: a browser-session cookie (ends when the browser closes, so the
 * next person on a shared computer starts fresh) that the server also ends after `hours`.
 */
export async function startGuestSession(userId: string, hours: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await insertAuthSession(hashToken(token), userId, hours * 60);
  return cookie(token, null);
}

/** Extends this user's sessions to `days` and re-issues the current cookie with the new lifetime. */
export async function extendSession(req: Request, userId: string, days = SESSION_DAYS): Promise<string | null> {
  await extendAuthSessions(userId, days);
  const token = readToken(req);
  return token ? cookie(token, days * 24 * 60 * 60) : null;
}

export async function endSession(req: Request): Promise<string> {
  const token = readToken(req);
  if (token) await deleteAuthSession(hashToken(token));
  return cookie("", 0);
}

export type SignedInUser = UserRow & { emailVerified: boolean; isGuest: boolean };

export async function currentUser(req: Request): Promise<SignedInUser | null> {
  const token = readToken(req);
  return token ? findUserBySessionHash(hashToken(token)) : null;
}

/**
 * CSRF defence in depth (on top of SameSite=Lax): browsers send Origin /
 * Sec-Fetch-Site on cross-site requests, so refuse writes that come from
 * another site.
 */
export function isSameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients don't send cookies automatically
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export const unauthorized = () => json({ error: "unauthorized" }, 401);
export const forbiddenOrigin = () => json({ error: "bad_origin" }, 403);

/**
 * For presenter routes: the signed-in user, or a 401/403 Response.
 * Writes (non-GET) must also come from this site.
 */
export async function requireUser(req: Request): Promise<SignedInUser | Response> {
  if (req.method !== "GET" && req.method !== "HEAD" && !isSameOrigin(req)) return forbiddenOrigin();
  const user = await currentUser(req);
  return user ?? unauthorized();
}
