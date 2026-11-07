import { controlQuiz } from "@/lib/queries";
import { badRequest, json, logDbError, readJson, unavailable } from "@/lib/http";
import { requireOwnedSession } from "@/lib/owned";
import { quizControlSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Owner only: start a quiz question (every phone jumps to it), end it now, or stop the quiz. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/sessions/[code]/quiz">) {
  try {
    const s = await requireOwnedSession(req, (await ctx.params).code);
    if (s instanceof Response) return s;
    const body = quizControlSchema.safeParse(await readJson(req));
    if (!body.success) return badRequest();
    return (await controlQuiz(s.code, body.data)) ? json({ ok: true }) : badRequest("not_a_quiz");
  } catch (err) {
    logDbError("admin:quiz", err);
    return unavailable();
  }
}
