import { resetSession } from "@/lib/queries";
import { json, logDbError, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/reset">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    await resetSession(s.code);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:reset", err);
    return unavailable();
  }
}
