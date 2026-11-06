import { getResults } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/results/[code]">) {
  const parsed = codeSchema.safeParse((await ctx.params).code);
  if (!parsed.success) return notFound();
  try {
    const data = await getResults(parsed.data);
    return data ? json(data) : notFound();
  } catch (err) {
    logDbError("results", err);
    return unavailable();
  }
}
