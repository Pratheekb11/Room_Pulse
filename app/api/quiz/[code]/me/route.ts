import { getQuizMe } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** A player's own score and rank (by their anonymous voter id), read after each question ends. */
export async function GET(req: Request, ctx: RouteContext<"/api/quiz/[code]/me">) {
  const code = codeSchema.safeParse((await ctx.params).code);
  const voter = z.uuid().safeParse(new URL(req.url).searchParams.get("voter"));
  if (!code.success || !voter.success) return notFound();
  try {
    const me = await getQuizMe(code.data, voter.data);
    return me ? json(me) : notFound();
  } catch (err) {
    logDbError("quiz:me", err);
    return unavailable();
  }
}
