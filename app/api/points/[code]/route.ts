import { raisePoint } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { MAX_POINTS_PER_VOTER } from "@/lib/points";
import { codeSchema, raisePointSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Someone raises an open point from their phone: something for the presenter to follow up after the poll. */
export async function POST(req: Request, ctx: RouteContext<"/api/points/[code]">) {
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  const parsed = raisePointSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest();
  try {
    const r = await raisePoint(code.data, parsed.data.voterId, parsed.data.text, parsed.data.name, MAX_POINTS_PER_VOTER);
    switch (r.outcome) {
      case "ok":
        return json({ ok: true, id: r.id, number: r.number }, 201);
      case "not_found":
        return notFound();
      case "off":
        return json({ error: "points_off" }, 403);
      case "closed":
        return json({ error: "closed" }, 403);
      case "limit":
        return json({ error: "limit" }, 429);
    }
  } catch (err) {
    logDbError("points:raise", err);
    return unavailable();
  }
}
