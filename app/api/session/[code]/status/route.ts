import { getSessionStatus } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Polled by every voter's phone. Vercel's CDN answers them all from one
// database read a second (quiz questions start on every phone within ~2 seconds).
const CDN_CACHE = { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=1" };

export async function GET(_req: Request, ctx: RouteContext<"/api/session/[code]/status">) {
  const parsed = codeSchema.safeParse((await ctx.params).code);
  if (!parsed.success) return notFound();
  try {
    const status = await getSessionStatus(parsed.data);
    return status === null ? notFound() : json(status, 200, CDN_CACHE);
  } catch (err) {
    logDbError("status", err);
    return unavailable();
  }
}
