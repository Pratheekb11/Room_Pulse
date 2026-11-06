import { forbiddenOrigin, isSameOrigin, startSession } from "@/lib/auth";
import { inBackground, sendLink } from "@/lib/email-links";
import { emailEnabled } from "@/lib/policy";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { createUser } from "@/lib/queries";
import { credentialsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const parsed = credentialsSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return json({ error: "invalid", issues: parsed.error.issues.map((i) => i.message) }, 400);
  }
  const { email, password } = parsed.data;
  try {
    const user = await createUser(email, await hashPassword(password));
    if (!user) return json({ error: "email_taken" }, 409);
    const setCookie = await startSession(user.id);
    // If the email can't be sent now, the user can resend it from the console.
    if (emailEnabled()) await inBackground("auth:signup-email", () => sendLink(user, "verify"));
    return json({ user: { email: user.email, emailVerified: false } }, 201, { "Cache-Control": "no-store", "Set-Cookie": setCookie });
  } catch (err) {
    logDbError("auth:signup", err);
    return unavailable();
  }
}
