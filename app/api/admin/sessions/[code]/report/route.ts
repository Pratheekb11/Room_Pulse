import { getAiReport, getResults, getSession, listOpenPoints } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * Owner only: the whole report as data (results with their analysis, what needs attention, the saved
 * AI summary and the open point list). The report page prints it; the browser saves that as a PDF.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/report">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const [info, results, points, ai] = await Promise.all([
      getSession(s.code),
      getResults(s.code, { ownerId: s.userId }),
      listOpenPoints(s.code),
      s.isGuest ? null : getAiReport(s.code),
    ]);
    if (!info || !results) return notFound();
    return json({ ...buildReport(info, results, { points, ai }), generatedAt: new Date().toISOString() });
  } catch (err) {
    logDbError("admin:report", err);
    return unavailable();
  }
}
