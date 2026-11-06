import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { resetSession } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/reset">) {
  if (!isAdmin(req)) return unauthorized();
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  try {
    await resetSession(code.data);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:reset", err);
    return unavailable();
  }
}
