import { saveAnswer } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { answerSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Poll choices and word-cloud answers. (Ratings use /api/vote.) */
export async function POST(req: Request) {
  const parsed = answerSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest();
  try {
    switch (await saveAnswer(parsed.data)) {
      case "ok":
        return json({ ok: true });
      case "not_found":
        return notFound();
      case "closed":
        return json({ error: "closed" }, 403);
      case "invalid":
        return badRequest("invalid_answer");
    }
  } catch (err) {
    logDbError("answer", err);
    return unavailable();
  }
}
