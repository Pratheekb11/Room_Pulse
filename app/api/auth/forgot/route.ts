import { forbiddenOrigin, isSameOrigin } from "@/lib/auth";
import { inBackground, sendLink } from "@/lib/email-links";
import { json, readJson } from "@/lib/http";
import { findUserByEmail } from "@/lib/queries";
import { emailSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Always answers the same way, whether or not the email has an account, so the
 * form can't be used to discover who is registered. The email is sent after the
 * response, so timing doesn't reveal it either.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  const body = (await readJson(req)) as { email?: unknown } | undefined;
  const email = emailSchema.safeParse(body?.email);
  if (email.success) {
    await inBackground("auth:forgot", async () => {
      const user = await findUserByEmail(email.data);
      if (user) await sendLink({ id: user.id, email: user.email }, "reset");
    });
  }
  return json({ ok: true });
}
