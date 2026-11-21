import { getFollow, setFollow } from "@/lib/queries";
import { badRequest, json, logDbError, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { followSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Owner only: the question phones are being led to (null = "Follow me" is off). */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/follow">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    return json({ focusId: await getFollow(s.code) });
  } catch (err) {
    logDbError("admin:follow", err);
    return unavailable();
  }
}

/** Owner only: lead every phone to a question (`{ focusId }`), or stop (`{ focusId: null }`). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/follow">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = followSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await setFollow(s.code, body.data.focusId)) ? json({ ok: true, focusId: body.data.focusId }) : badRequest("not_a_question");
  } catch (err) {
    logDbError("admin:follow", err);
    return unavailable();
  }
}
