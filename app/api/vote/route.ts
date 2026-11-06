import { saveVote } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { voteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = voteSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest();

  try {
    const outcome = await saveVote(parsed.data);
    switch (outcome) {
      case "ok":
        return json({ ok: true });
      case "not_found":
        return notFound();
      case "closed":
        return json({ error: "closed" }, 403);
      case "invalid":
        return badRequest("invalid_vote");
    }
  } catch (err) {
    logDbError("vote", err);
    return unavailable();
  }
}
