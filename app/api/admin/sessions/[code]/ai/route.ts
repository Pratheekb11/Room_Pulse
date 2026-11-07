import { aiAvailable, aiDailyLimit } from "@/lib/ai";
import { accountRequired, withAiCredit } from "@/lib/ai-access";
import { findDuplicates, summarise } from "@/lib/ai-insights";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { aiCreditsUsed, getAiSource, getSessionAiEnabled } from "@/lib/queries";
import { aiActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Owner only: whether AI insights are on for this presentation, and how many uses are left today. */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/ai">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const enabled = !s.isGuest && (await getSessionAiEnabled(s.code));
    const remaining = s.isGuest ? 0 : Math.max(0, aiDailyLimit() - (await aiCreditsUsed(s.userId)));
    return json({ enabled, available: aiAvailable(), remaining, account: !s.isGuest });
  } catch (err) {
    logDbError("admin:ai", err);
    return unavailable();
  }
}

/**
 * Owner only, with AI insights switched on: summarise a question's answers into themes and next
 * steps, or find audience questions that ask the same thing. Hidden answers are never sent.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/ai">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    if (s.isGuest) return accountRequired();
    const body = aiActionSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    if (!(await getSessionAiEnabled(s.code))) return json({ error: "ai_off" }, 403);
    const source = await getAiSource(s.code, body.data.focusId);
    if (!source) return notFound();

    if (body.data.action === "summary") {
      const answers = source.kind === "qa" ? source.questions.map((q) => q.text) : source.kind === "text" ? source.texts : [];
      if (source.kind !== "text" && source.kind !== "qa") return badRequest("wrong_kind");
      if (answers.length < 3) return badRequest("too_few_answers");
      const out = await withAiCredit({ id: s.userId, isGuest: s.isGuest }, () => summarise(source.name, answers));
      return out instanceof Response ? out : json({ ...out, answers: answers.length });
    }

    if (source.kind !== "qa") return badRequest("wrong_kind");
    if (source.questions.length < 2) return badRequest("too_few_answers");
    const out = await withAiCredit({ id: s.userId, isGuest: s.isGuest }, () => findDuplicates(source.questions));
    return out instanceof Response ? out : json({ groups: out });
  } catch (err) {
    logDbError("admin:ai", err);
    return unavailable();
  }
}
