import { saveQuizAction } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { codeSchema, quizActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Pick a leaderboard nickname, or lock in an answer to the quiz question running now. */
export async function POST(req: Request, ctx: RouteContext<"/api/quiz/[code]">) {
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  const parsed = quizActionSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest();
  try {
    switch (await saveQuizAction(code.data, parsed.data)) {
      case "ok":
        return json({ ok: true });
      case "not_found":
        return notFound();
      case "closed":
        return json({ error: "closed" }, 403);
      case "not_live":
        // not started, time is up, or already answered
        return json({ error: "not_live" }, 409);
      case "invalid":
        return badRequest("invalid_answer");
    }
  } catch (err) {
    logDbError("quiz:save", err);
    return unavailable();
  }
}
