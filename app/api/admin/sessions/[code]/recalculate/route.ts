import { recalculateSession } from "@/lib/queries";
import { json, logDbError, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/recalculate">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    if (s.isOpen) return json({ error: "close_voting_first" }, 409);
    await recalculateSession(s.code);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:recalculate", err);
    return unavailable();
  }
}
