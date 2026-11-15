import { moderateText } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { textModerateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Owner only: hide an open answer (or only the name it is signed with) from the big screen, or show it again. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/text">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = textModerateSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await moderateText(s.code, body.data.id, body.data)) ? json({ ok: true }) : notFound();
  } catch (err) {
    logDbError("admin:text", err);
    return unavailable();
  }
}
