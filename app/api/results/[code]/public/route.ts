import { audienceResults } from "@/lib/answers";
import { getResults, getSession } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Polled by voters' phones when the owner shows them results: the CDN answers them all
// from one database read every few seconds.
const CDN_CACHE = { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=3" };

/** Live results for the audience, only while the owner has "Show results on phones" on. */
export async function GET(_req: Request, ctx: RouteContext<"/api/results/[code]/public">) {
  const parsed = codeSchema.safeParse((await ctx.params).code);
  if (!parsed.success) return notFound();
  try {
    const data = await getResults(parsed.data, { audience: true });
    if (!data) return notFound();
    const session = await getSession(parsed.data);
    const quizIds = new Set((session?.focusTopics ?? []).filter((f) => f.kind === "quiz").map((f) => f.id));
    return json(audienceResults(data, quizIds), 200, CDN_CACHE);
  } catch (err) {
    logDbError("results:public", err);
    return unavailable();
  }
}
