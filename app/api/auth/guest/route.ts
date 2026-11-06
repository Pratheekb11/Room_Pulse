import { randomInt } from "node:crypto";
import { forbiddenOrigin, isSameOrigin, startGuestSession } from "@/lib/auth";
import { json, logDbError, unavailable } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { GUEST_ACCOUNTS_PER_HOUR, GUEST_DAYS, GUEST_SESSION_HOURS } from "@/lib/policy";
import { createGuestUser, purgeExpiredGuestData } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Starts a guest presenter account (no email or password). Returns a 6-digit PIN,
 * shown once: with any of the guest's presentation codes it signs them back in.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  try {
    await purgeExpiredGuestData(GUEST_DAYS);
    const pin = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const id = await createGuestUser(GUEST_ACCOUNTS_PER_HOUR, await hashPassword(pin));
    if (!id) return json({ error: "guest_busy" }, 429, { "Cache-Control": "no-store", "Retry-After": "600" });
    const setCookie = await startGuestSession(id, GUEST_SESSION_HOURS);
    return json({ user: { email: null, guest: true, emailVerified: false }, pin }, 201, {
      "Cache-Control": "no-store",
      "Set-Cookie": setCookie,
    });
  } catch (err) {
    logDbError("auth:guest", err);
    return unavailable();
  }
}
