import { forbiddenOrigin, isSameOrigin, startGuestSession } from "@/lib/auth";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { dummyHash, verifyPassword } from "@/lib/password";
import { GUEST_PIN_ATTEMPTS_PER_HOUR, GUEST_SESSION_HOURS } from "@/lib/policy";
import { clearLoginFailures, countRecentLoginFailures, findGuestByPresentationCode, recordLoginFailure } from "@/lib/queries";
import { normalizeCode } from "@/lib/code";

export const dynamic = "force-dynamic";

// Same answer for an unknown code, a non-guest presentation and a wrong PIN.
const invalid = () => json({ error: "invalid_guest_pin" }, 401);

/** Guest sign-in on any device: one of the guest's presentation codes + their PIN. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const body = (await readJson(req)) as { code?: unknown; pin?: unknown } | undefined;
  const code = typeof body?.code === "string" ? normalizeCode(body.code) : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!/^[a-z0-9]{4,12}$/.test(code) || !/^\d{6}$/.test(pin)) return invalid();

  try {
    const guest = await findGuestByPresentationCode(code);
    if (!guest) {
      await verifyPassword(pin, await dummyHash()); // same work either way, so timing reveals nothing
      return invalid();
    }
    // Lockout per guest (keyed by account id; no IPs stored).
    const key = `guest:${guest.id}`;
    if ((await countRecentLoginFailures(key, 60)) >= GUEST_PIN_ATTEMPTS_PER_HOUR) {
      return json({ error: "too_many_attempts" }, 429, { "Cache-Control": "no-store", "Retry-After": "3600" });
    }
    if (!(await verifyPassword(pin, guest.pinHash))) {
      await recordLoginFailure(key);
      return invalid();
    }
    await clearLoginFailures(key);
    const setCookie = await startGuestSession(guest.id, GUEST_SESSION_HOURS);
    return json({ user: { email: null, guest: true, emailVerified: false } }, 200, {
      "Cache-Control": "no-store",
      "Set-Cookie": setCookie,
    });
  } catch (err) {
    logDbError("auth:guest-return", err);
    return unavailable();
  }
}
