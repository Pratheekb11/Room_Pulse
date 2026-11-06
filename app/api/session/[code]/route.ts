import { getSession } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/session/[code]">) {
  const parsed = codeSchema.safeParse((await ctx.params).code);
  if (!parsed.success) return notFound();
  try {
    const data = await getSession(parsed.data);
    return data ? json(data) : notFound();
  } catch (err) {
    logDbError("session", err);
    return unavailable();
  }
}
