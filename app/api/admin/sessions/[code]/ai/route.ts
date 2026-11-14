import { aiAvailable, aiDailyLimit } from "@/lib/ai";
import { accountRequired, withAiCredit } from "@/lib/ai-access";
import { buildDigest } from "@/lib/ai-digest";
import { findDuplicates, overview, summarise } from "@/lib/ai-insights";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { aiCreditsUsed, getAiReport, getAiSource, getResults, getSession, getSessionAiEnabled, saveAiReport } from "@/lib/queries";
import { aiActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Fewest people who must have answered before a whole-presentation summary is worth asking for. */
const MIN_PEOPLE = 3;

/** Owner only: whether AI insights are on for this presentation, how many uses are left today, and the saved summary. */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/ai">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const enabled = !s.isGuest && (await getSessionAiEnabled(s.code));
    const remaining = s.isGuest ? 0 : Math.max(0, aiDailyLimit() - (await aiCreditsUsed(s.userId)));
    const report = s.isGuest ? null : await getAiReport(s.code);
    return json({ enabled, available: aiAvailable(), remaining, account: !s.isGuest, report });
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

    if (body.data.action === "overview") {
      // The whole presentation: every question's results as the presenter's screen shows them.
      const [info, results] = await Promise.all([getSession(s.code), getResults(s.code, { ownerId: s.userId })]);
      if (!info || !results) return notFound();
      if (results.voterCount < MIN_PEOPLE) return badRequest("too_few_answers");
      const digest = buildDigest(info, results);
      const out = await withAiCredit({ id: s.userId, isGuest: s.isGuest }, () => overview(digest));
      if (out instanceof Response) return out;
      const saved = await saveAiReport(s.code, out, results.voterCount);
      return saved ? json(saved) : notFound();
    }

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
