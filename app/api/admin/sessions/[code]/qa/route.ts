import { moderateQuestion } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { qaModerateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Owner only: hide/unhide an audience question, or mark it answered. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/qa">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = qaModerateSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await moderateQuestion(s.code, body.data.id, body.data)) ? json({ ok: true }) : notFound();
  } catch (err) {
    logDbError("admin:qa", err);
    return unavailable();
  }
}
