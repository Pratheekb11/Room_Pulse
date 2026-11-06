import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { deleteSession, setSessionOpen } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { codeSchema, patchSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/admin/sessions/[code]">;

export async function PATCH(req: Request, ctx: Ctx) {
  if (!isAdmin(req)) return unauthorized();
  const code = codeSchema.safeParse((await ctx.params).code);
  const body = patchSessionSchema.safeParse(await readJson(req));
  if (!code.success) return notFound();
  if (!body.success) return badRequest();
  try {
    const found = await setSessionOpen(code.data, body.data.isOpen);
    return found ? json({ ok: true, isOpen: body.data.isOpen }) : notFound();
  } catch (err) {
    logDbError("admin:patch", err);
    return unavailable();
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!isAdmin(req)) return unauthorized();
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  try {
    await deleteSession(code.data);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:delete", err);
    return unavailable();
  }
}
