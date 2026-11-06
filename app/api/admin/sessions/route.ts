import { requireUser } from "@/lib/auth";
import { createSession, listSessions } from "@/lib/queries";
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
    const parsed = createSessionSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return json({ error: "invalid", issues: parsed.error.issues.map((i) => i.message) }, 400);
    }
    const code = await createSession(parsed.data, user.id);
    return json({ code }, 201);
  } catch (err) {
    logDbError("admin:create", err);
    return unavailable();
  }
}
