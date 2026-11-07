import { aiAvailable, aiDailyLimit } from "@/lib/ai";
import { withAiCredit } from "@/lib/ai-access";
import { draftPresentation } from "@/lib/ai-insights";
import { requireUser } from "@/lib/auth";
import { json, logDbError, readJson, unavailable } from "@/lib/http";
import { aiCreditsUsed } from "@/lib/queries";
import { aiDraftSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Whether AI is set up on this site (no key = every AI control stays hidden), and today's uses left. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const account = !user.isGuest;
    const remaining = account ? Math.max(0, aiDailyLimit() - (await aiCreditsUsed(user.id))) : 0;
    return json({ available: aiAvailable(), account, remaining });
  } catch (err) {
    logDbError("admin:ai-status", err);
    return unavailable();
  }
}

/** Accounts only: draft a presentation's questions from a short description, for the builder to load. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const body = aiDraftSchema.safeParse(await readJson(req));
    if (!body.success) return json({ error: "bad_request", issues: body.error.issues.map((i) => i.message) }, 400);
    const out = await withAiCredit(user, () => draftPresentation(body.data.prompt));
    return out instanceof Response ? out : json({ plan: out });
  } catch (err) {
    logDbError("admin:ai-draft", err);
    return unavailable();
  }
}
