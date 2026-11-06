import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { createSession, listSessions } from "@/lib/queries";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { createSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  try {
    return json({ sessions: await listSessions() });
  } catch (err) {
    logDbError("admin:list", err);
    return unavailable();
  }
}

export async function POST(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const parsed = createSessionSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return json({ error: "invalid", issues: parsed.error.issues.map((i) => i.message) }, 400);
  }
  try {
    const code = await createSession(parsed.data);
    return json({ code }, 201);
  } catch (err) {
    logDbError("admin:create", err);
    return unavailable();
  }
}
