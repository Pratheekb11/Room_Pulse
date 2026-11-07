import { listPublicQa, saveQaAction } from "@/lib/queries";
import { badRequest, json, logDbError, notFound, readJson, unavailable } from "@/lib/http";
import { codeSchema, qaActionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Polled by every voter's phone on a Q&A question; the CDN answers them all from one read every few seconds.
const CDN_CACHE = { "Cache-Control": "public, s-maxage=3, stale-while-revalidate=3" };

/** Audience questions anyone with the voting code can see (hidden ones left out, no voter ids). */
export async function GET(_req: Request, ctx: RouteContext<"/api/qa/[code]">) {
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  try {
    const questions = await listPublicQa(code.data);
    return questions === null ? notFound() : json({ questions }, 200, CDN_CACHE);
  } catch (err) {
    logDbError("qa:list", err);
    return unavailable();
  }
}

/** Send in a question, or add/take back an upvote. */
export async function POST(req: Request, ctx: RouteContext<"/api/qa/[code]">) {
  const code = codeSchema.safeParse((await ctx.params).code);
  if (!code.success) return notFound();
  const parsed = qaActionSchema.safeParse(await readJson(req));
  if (!parsed.success) return badRequest();
  try {
    const r = await saveQaAction(code.data, parsed.data);
    switch (r.outcome) {
      case "ok":
        return json(r.id ? { ok: true, id: r.id } : { ok: true });
      case "not_found":
        return notFound();
      case "closed":
        return json({ error: "closed" }, 403);
      case "limit":
        return json({ error: "limit" }, 429);
      case "invalid":
        return badRequest("invalid_answer");
    }
  } catch (err) {
    logDbError("qa:save", err);
    return unavailable();
  }
}
