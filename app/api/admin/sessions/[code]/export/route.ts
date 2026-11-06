import { isAdmin, unauthorized } from "@/lib/admin-auth";
import { getRawRows, getSessionIsOpen, getSummaryRows } from "@/lib/queries";
import { badRequest, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema, exportTypeSchema } from "@/lib/validation";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/export">) {
  if (!isAdmin(req)) return unauthorized();
  const code = codeSchema.safeParse((await ctx.params).code);
  const type = exportTypeSchema.safeParse(new URL(req.url).searchParams.get("type") ?? "summary");
  if (!code.success) return notFound();
  if (!type.success) return badRequest();

  try {
    if ((await getSessionIsOpen(code.data)) === null) return notFound();

    let csv: string;
    if (type.data === "summary") {
      const rows = await getSummaryRows(code.data);
      const out: (string | number)[][] = [["Topic", "Criterion", "Average", "Votes"]];
      let i = 0;
      while (i < rows.length) {
        const topic = rows[i].topic;
        let n = 0;
        let sum = 0;
        for (; i < rows.length && rows[i].topic === topic; i++) {
          const r = rows[i];
          out.push([r.topic, r.criterion, r.n ? (r.sum / r.n).toFixed(2) : "", r.n]);
          n += r.n;
          sum += r.sum;
        }
        out.push([topic, "Overall", n ? (sum / n).toFixed(2) : "", n]);
      }
      csv = toCsv(out);
    } else {
      const rows = await getRawRows(code.data);
      csv = toCsv([
        ["Respondent", "Topic", "Criterion", "Score", "UpdatedAt"],
        ...rows.map((r) => [r.respondent, r.topic, r.criterion, r.score, r.updatedAt]),
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
