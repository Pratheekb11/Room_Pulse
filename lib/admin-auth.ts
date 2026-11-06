import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Constant-time check of the `x-admin-key` header against ADMIN_PASSWORD. */
export function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // never allow access when no password is configured
  const given = req.headers.get("x-admin-key") ?? "";
  // Hashing first gives equal-length buffers, so timingSafeEqual never throws.
  return timingSafeEqual(digest(given), digest(expected));
}

export function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
