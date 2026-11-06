import { forbiddenOrigin, hashToken, isSameOrigin, startGuestSession } from "@/lib/auth";
import { normalizeGuestCode } from "@/lib/code";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { GUEST_CODE_FAILURES_PER_10_MIN, GUEST_DAYS, GUEST_SESSION_HOURS } from "@/lib/policy";
import { countRecentLoginFailures, findGuestByCodeHash, recordLoginFailure } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Same answer for a malformed, unknown, saved or expired code.
const invalid = () => json({ error: "invalid_guest_code" }, 401);

// Failures are counted site-wide (there's no account to key them on, and no IPs are stored).
const FAILURE_KEY = "guest-code";

/** Guest sign-in on any device with just the guest code. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const body = (await readJson(req)) as { guestCode?: unknown } | undefined;
  const code = typeof body?.guestCode === "string" ? normalizeGuestCode(body.guestCode) : null;
  try {
    if ((await countRecentLoginFailures(FAILURE_KEY, 10)) >= GUEST_CODE_FAILURES_PER_10_MIN) {
      return json({ error: "too_many_attempts" }, 429, { "Cache-Control": "no-store", "Retry-After": "600" });
    }
    const id = code ? await findGuestByCodeHash(hashToken(code), GUEST_DAYS) : null;
    if (!id) {
      await recordLoginFailure(FAILURE_KEY);
      return invalid();
    }
    const setCookie = await startGuestSession(id, GUEST_SESSION_HOURS);
    return json({ user: { email: null, guest: true, emailVerified: false } }, 200, {
      "Cache-Control": "no-store",
      "Set-Cookie": setCookie,
    });
  } catch (err) {
    logDbError("auth:guest-return", err);
    return unavailable();
  }
}
