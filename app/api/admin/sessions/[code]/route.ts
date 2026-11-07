import { deleteSession, getAnswerCounts, getSession, setSessionSettings, updateSession } from "@/lib/queries";
import { badRequest, json, logDbError, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { editSessionSchema, patchSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/admin/sessions/[code]">;

/** The presentation as the edit form needs it: questions with ids, answers per item, scale lock. */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const [session, answers] = await Promise.all([getSession(s.code, { withAnswers: true }), getAnswerCounts(s.code, s.userId)]);
    if (!session || !answers) return json({ error: "not_found" }, 404);
    return json({ session, ...answers });
  } catch (err) {
    logDbError("admin:get", err);
    return unavailable();
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const parsed = editSessionSchema.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "invalid", issues: parsed.error.issues.map((i) => i.message) }, 400);
    const outcome = await updateSession(s.code, s.userId, parsed.data);
    if (outcome === "not_found") return json({ error: "not_found" }, 404);
    if (outcome === "invalid") return json({ error: "invalid", issues: ["Something changed since you opened this. Reload and try again."] }, 400);
    if (outcome === "scale_locked")
      return json({ error: "scale_locked", issues: ["The rating scale can't change after people have rated. Reset the votes first."] }, 409);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:edit", err);
    return unavailable();
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = patchSessionSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    // AI insights are for accounts: a guest is asked to sign in or create one.
    if (body.data.aiEnabled && s.isGuest) return json({ error: "account_required" }, 403);
    await setSessionSettings(s.code, body.data);
    return json({ ok: true, ...body.data });
  } catch (err) {
    logDbError("admin:patch", err);
    return unavailable();
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    await deleteSession(s.code);
    return json({ ok: true });
  } catch (err) {
    logDbError("admin:delete", err);
    return unavailable();
  }
}
