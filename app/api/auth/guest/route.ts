import { forbiddenOrigin, hashToken, isSameOrigin, startGuestSession } from "@/lib/auth";
import { generateGuestCode, normalizeGuestCode } from "@/lib/code";
import { json, logDbError, unavailable } from "@/lib/http";
import { GUEST_ACCOUNTS_PER_HOUR, GUEST_DAYS, GUEST_SESSION_HOURS } from "@/lib/policy";
import { createGuestUser, purgeExpiredGuestData } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Starts a guest presenter account (no email or password). Returns a guest code, shown once:
 * typed on any device, it signs the guest back in. Only its hash is stored.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  try {
    await purgeExpiredGuestData(GUEST_DAYS);
    const guestCode = generateGuestCode();
    const id = await createGuestUser(GUEST_ACCOUNTS_PER_HOUR, hashToken(normalizeGuestCode(guestCode)!));
    if (!id) return json({ error: "guest_busy" }, 429, { "Cache-Control": "no-store", "Retry-After": "600" });
    const setCookie = await startGuestSession(id, GUEST_SESSION_HOURS);
    return json({ user: { email: null, guest: true, emailVerified: false }, guestCode }, 201, {
      "Cache-Control": "no-store",
      "Set-Cookie": setCookie,
    });
  } catch (err) {
    logDbError("auth:guest", err);
    return unavailable();
  }
}
