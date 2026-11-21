import { setWordHidden } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { wordModerateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Owner only: hide a word from a word cloud (the big screen and phones), or show it again. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/words">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = wordModerateSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await setWordHidden(s.code, body.data.focusId, body.data.word, body.data.hidden)) ? json({ ok: true }) : notFound();
  } catch (err) {
    logDbError("admin:words", err);
    return unavailable();
  }
}
