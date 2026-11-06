import { forbiddenOrigin, hashToken, isSameOrigin } from "@/lib/auth";
import { tokenShape } from "@/lib/email-links";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { consumeEmailToken, markEmailVerified } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const body = (await readJson(req)) as { token?: unknown } | undefined;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!tokenShape.test(token)) return json({ error: "invalid_link" }, 400);
  try {
    const user = await consumeEmailToken(hashToken(token), "verify");
    if (!user) return json({ error: "invalid_link" }, 400);
    await markEmailVerified(user.id);
    return json({ ok: true, email: user.email });
  } catch (err) {
    logDbError("auth:verify", err);
    return unavailable();
  }
}
