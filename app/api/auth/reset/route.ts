import { forbiddenOrigin, hashToken, isSameOrigin, startSession } from "@/lib/auth";
import { tokenShape } from "@/lib/email-links";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { consumeEmailToken, emailTokenUsable, resetPassword } from "@/lib/queries";
import { limited } from "@/lib/limits";
import { passwordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const body = (await readJson(req)) as { token?: unknown; password?: unknown } | undefined;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!tokenShape.test(token)) return json({ error: "invalid_link" }, 400);
  const password = passwordSchema.safeParse(body?.password);
  if (!password.success) {
    return json({ error: "invalid", issues: password.error.issues.map((i) => i.message) }, 400);
  }
  try {
    const busy = await limited(req, "auth");
    if (busy) return busy;
    // A link that can't work is refused before the (deliberately slow) hashing.
    if (!(await emailTokenUsable(hashToken(token), "reset"))) return json({ error: "invalid_link" }, 400);
    // Hash before using the link up, so it's only used once everything else is ready.
    const passwordHash = await hashPassword(password.data);
    const user = await consumeEmailToken(hashToken(token), "reset");
    if (!user || !user.email) return json({ error: "invalid_link" }, 400);
    await resetPassword(user.id, user.email, passwordHash);
    const setCookie = await startSession(user.id);
    return json({ ok: true, user: { email: user.email, emailVerified: true } }, 200, {
      "Cache-Control": "no-store",
      "Set-Cookie": setCookie,
    });
  } catch (err) {
    logDbError("auth:reset", err);
    return unavailable();
  }
}
