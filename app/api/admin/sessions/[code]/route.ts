import { deleteSession, setSessionOpen } from "@/lib/queries";
import { badRequest, json, logDbError, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { patchSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/admin/sessions/[code]">;

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = patchSessionSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    await setSessionOpen(s.code, body.data.isOpen);
    return json({ ok: true, isOpen: body.data.isOpen });
  } catch (err) {
    logDbError("admin:patch", err);
    return unavailable();
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    await deleteSession(s.code);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:delete", err);
    return unavailable();
  }
}
