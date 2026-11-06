import { currentUser } from "@/lib/auth";
import { getResults } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Results are private: the request needs the presentation's dashboard key (from the presenter
// link's #k=… part, sent as a header) or the owner's sign-in. Anything else looks like a missing
// presentation, so the public voting code alone reveals nothing.
const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request, ctx: RouteContext<"/api/results/[code]">) {
  const parsed = codeSchema.safeParse((await ctx.params).code);
  if (!parsed.success) return notFound();
  try {
    const key = req.headers.get("x-dashboard-key");
    const dashboardKey = key && /^[A-Za-z0-9_-]{20,64}$/.test(key) ? key : null;
    const owner = dashboardKey ? null : await currentUser(req);
    const data = await getResults(parsed.data, { dashboardKey, ownerId: owner?.id ?? null });
    return data ? json(data, 200, PRIVATE) : json({ error: "not_found" }, 404, PRIVATE);
  } catch (err) {
    logDbError("results", err);
    return unavailable();
  }
}
