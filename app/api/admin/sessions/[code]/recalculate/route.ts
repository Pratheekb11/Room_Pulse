import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { getSessionIsOpen, recalculateSession } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/recalculate">) {
  if (!isAdmin(req)) return unauthorized();
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  try {
    const isOpen = await getSessionIsOpen(code.data);
    if (isOpen === null) return notFound();
    if (isOpen) return json({ error: "close_voting_first" }, 409);
    await recalculateSession(code.data);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:recalculate", err);
    return unavailable();
  }
}
