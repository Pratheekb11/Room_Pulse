import { getChoiceSummaryRows, getRawRows, getSummaryRows } from "@/lib/queries";
import { badRequest, logDbError, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { exportTypeSchema } from "@/lib/validation";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/export">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const code = { data: s.code };
    const type = exportTypeSchema.safeParse(new URL(req.url).searchParams.get("type") ?? "summary");
    if (!type.success) return badRequest();

    let csv: string;
    if (type.data === "summary") {
      const rows = await getSummaryRows(code.data);
      const out: (string | number)[][] = [["Question", "Item or option", "Measure", "Average score", "Answers"]];
      let i = 0;
      while (i < rows.length) {
        // Rows arrive ordered by topic position; group by it (names can repeat across focus topics).
        const { focus, topic, topicPosition } = rows[i];
        let n = 0;
        let sum = 0;
        for (; i < rows.length && rows[i].topicPosition === topicPosition; i++) {
          const r = rows[i];
          out.push([r.focus, r.topic, r.criterion, r.n ? (r.sum / r.n).toFixed(2) : "", r.n]);
          n += r.n;
          sum += r.sum;
        }
        out.push([focus, topic, "All measures", n ? (sum / n).toFixed(2) : "", n]);
      }
      for (const r of await getChoiceSummaryRows(s.code)) out.push([r.focus, r.label, r.kind, r.average === null ? "" : r.average.toFixed(2), r.n]);
      csv = toCsv(out);
    } else {
      const rows = await getRawRows(code.data);
      csv = toCsv([
        ["Person", "Question", "Item or option", "Measure", "Score", "Answered at"],
        ...rows.map((r) => [r.respondent, r.focus, r.topic, r.criterion, r.score, r.updatedAt]),
      ]);
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="liverate-${code.data}-${type.data}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    logDbError("admin:export", err);
    return unavailable();
  }
}
