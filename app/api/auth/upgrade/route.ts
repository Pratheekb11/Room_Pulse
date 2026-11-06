import { extendSession, requireUser } from "@/lib/auth";
import { inBackground, sendLink } from "@/lib/email-links";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { emailEnabled } from "@/lib/policy";
import { upgradeGuest } from "@/lib/queries";
import { credentialsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Saves a guest account: adds an email and password and keeps its presentations for good. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const parsed = credentialsSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return json({ error: "invalid", issues: parsed.error.issues.map((i) => i.message) }, 400);
    }
    if (!user.isGuest) return json({ error: "not_guest" }, 400);
    const { email, password } = parsed.data;
    const outcome = await upgradeGuest(user.id, email, await hashPassword(password));
    if (outcome === "email_taken") return json({ error: "email_taken" }, 409);
    if (outcome === "not_guest") return json({ error: "not_guest" }, 400);
    const setCookie = await extendSession(req, user.id);
    if (emailEnabled()) await inBackground("auth:upgrade-email", () => sendLink({ id: user.id, email }, "verify"));
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (setCookie) headers["Set-Cookie"] = setCookie;
    return json({ user: { email, guest: false, emailVerified: false } }, 200, headers);
  } catch (err) {
    logDbError("auth:upgrade", err);
    return unavailable();
  }
}
