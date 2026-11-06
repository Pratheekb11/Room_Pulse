import { requireUser } from "@/lib/auth";
import { countOwnedSessions, createSession, listSessions } from "@/lib/queries";
import { GUEST_DAYS, GUEST_PRESENTATION_LIMIT, requireEmailVerification } from "@/lib/policy";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { createSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    return json({ sessions: await listSessions(user.id) });
  } catch (err) {
    logDbError("admin:list", err);
    return unavailable();
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    if (user.isGuest) {
      if ((await countOwnedSessions(user.id)) >= GUEST_PRESENTATION_LIMIT) return json({ error: "guest_limit" }, 403);
    } else if (requireEmailVerification() && !user.emailVerified) {
      return json({ error: "verify_email" }, 403);
    }
    const parsed = createSessionSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return json({ error: "invalid", issues: parsed.error.issues.map((i) => i.message) }, 400);
    }
    const created = await createSession(parsed.data, user.id, user.isGuest ? GUEST_DAYS : null);
    return json(created, 201);
  } catch (err) {
    logDbError("admin:create", err);
    return unavailable();
  }
}
