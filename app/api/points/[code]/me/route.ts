import { z } from "zod";
import { listMyPoints } from "@/lib/queries";
import { json, logDbError, notFound, unavailable } from "@/lib/http";
import { codeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** The open points one person raised (by their anonymous voter id) and how far along each is. */
export async function GET(req: Request, ctx: RouteContext<"/api/points/[code]/me">) {
  const code = codeSchema.safeParse((await ctx.params).code);
  const voter = z.uuid().safeParse(new URL(req.url).searchParams.get("voter"));
  if (!code.success || !voter.success) return notFound();
  try {
    const points = await listMyPoints(code.data, voter.data);
    return points ? json({ points }) : notFound();
  } catch (err) {
    logDbError("points:me", err);
    return unavailable();
  }
}
