import { requireUser } from "@/lib/auth";
import { sendLink } from "@/lib/email-links";
import { json, logDbError, unavailable } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    if (user.emailVerified) return json({ ok: true, alreadyVerified: true });
    const email = user.email;
    if (user.isGuest || !email) return json({ error: "no_email" }, 400);
    const result = await sendLink({ id: user.id, email }, "verify");
    if (result === "rate_limited") return json({ error: "too_many_emails" }, 429, { "Cache-Control": "no-store", "Retry-After": "3600" });
    return json({ ok: true });
  } catch (err) {
    logDbError("auth:resend", err);
    return unavailable();
  }
}
