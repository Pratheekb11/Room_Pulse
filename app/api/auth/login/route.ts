import { forbiddenOrigin, isSameOrigin, startSession } from "@/lib/auth";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { dummyHash, verifyPassword } from "@/lib/password";
import { clearLoginFailures, countRecentLoginFailures, findUserByEmail, recordLoginFailure } from "@/lib/queries";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_FAILURES = 10;
const WINDOW_MINUTES = 15;

// One message for "no such email" and "wrong password", so emails can't be probed here.
const invalid = () => json({ error: "invalid_credentials" }, 401);

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return invalid();
  const { email, password } = parsed.data;

  try {
    if ((await countRecentLoginFailures(email, WINDOW_MINUTES)) >= MAX_FAILURES) {
      return json({ error: "too_many_attempts" }, 429, { "Cache-Control": "no-store", "Retry-After": String(WINDOW_MINUTES * 60) });
    }
    const user = await findUserByEmail(email);
    // Always run a full hash check so response time doesn't reveal whether the email exists.
    const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
    if (!user || !ok) {
      await recordLoginFailure(email);
      return invalid();
    }
    await clearLoginFailures(email);
    const setCookie = await startSession(user.id);
    return json({ user: { email: user.email } }, 200, { "Cache-Control": "no-store", "Set-Cookie": setCookie });
  } catch (err) {
    logDbError("auth:login", err);
    return unavailable();
  }
}
