import { forbiddenOrigin, isSameOrigin, startSession } from "@/lib/auth";
import { clientId, limited } from "@/lib/limits";
import { LOGIN_FAILURES_PER_EMAIL, LOGIN_FAILURES_PER_IP } from "@/lib/policy";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { dummyHash, verifyPassword } from "@/lib/password";
import { clearLoginFailures, countRecentLoginFailures, findUserByEmail, recordLoginFailure } from "@/lib/queries";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const WINDOW_MINUTES = 15;

// One message for "no such email" and "wrong password", so emails can't be probed here.
const invalid = () => json({ error: "invalid_credentials" }, 401);

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return invalid();
  const { email, password } = parsed.data;

  try {
    // Before the (deliberately slow) password check: each address gets a few tries per minute.
    const busy = await limited(req, "auth");
    if (busy) return busy;
    // Wrong passwords pause this address for this email, so someone else's guesses can't lock the
    // owner out. Very many from everywhere pause the email itself.
    const id = clientId(req);
    const perAddress = id ? `${email}|${id}` : email;
    const total = `total:${email}`;
    if (
      (await countRecentLoginFailures(perAddress, WINDOW_MINUTES)) >= LOGIN_FAILURES_PER_IP ||
      (await countRecentLoginFailures(total, WINDOW_MINUTES)) >= LOGIN_FAILURES_PER_EMAIL
    ) {
      return json({ error: "too_many_attempts" }, 429, { "Cache-Control": "no-store", "Retry-After": String(WINDOW_MINUTES * 60) });
    }
    const user = await findUserByEmail(email);
    // Always run a full hash check so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok) {
      await recordLoginFailure([perAddress, total]);
      return invalid();
    }
    await clearLoginFailures(perAddress);
    const setCookie = await startSession(user.id);
    return json({ user: { email: user.email, emailVerified: user.emailVerified } }, 200, { "Cache-Control": "no-store", "Set-Cookie": setCookie });
  } catch (err) {
    logDbError("auth:login", err);
    return unavailable();
  }
}
