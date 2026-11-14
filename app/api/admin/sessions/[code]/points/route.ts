import { addOpenPoint, changeOpenPoint, deleteOpenPoint, listOpenPoints } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { addPointSchema, changePointSchema, pointIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/admin/sessions/[code]/points">;

/** Owner only: the open point list. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    return json({ points: await listOpenPoints(s.code) });
  } catch (err) {
    logDbError("admin:points", err);
    return unavailable();
  }
}

/** Owner only: add a point, typed or made from a result or an AI suggestion (once each). */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = addPointSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    const r = await addOpenPoint(s.code, body.data);
    if (r.outcome === "ok") return json({ ok: true, id: r.id, number: r.number }, 201);
    return r.outcome === "exists" ? json({ error: "exists" }, 409) : notFound();
  } catch (err) {
    logDbError("admin:points", err);
    return unavailable();
  }
}

/** Owner only: assign, set a due date, change the status, add a note or reword. */
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = changePointSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await changeOpenPoint(s.code, body.data)) ? json({ ok: true }) : notFound();
  } catch (err) {
    logDbError("admin:points", err);
    return unavailable();
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = pointIdSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await deleteOpenPoint(s.code, body.data.id)) ? json({ ok: true }) : notFound();
  } catch (err) {
    logDbError("admin:points", err);
    return unavailable();
  }
}
