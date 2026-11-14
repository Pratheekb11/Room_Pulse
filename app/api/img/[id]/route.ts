import { z } from "zod";
import { logDbError, notFound, unavailable } from "@/lib/http";
import { getImage } from "@/lib/queries";

export const dynamic = "force-dynamic";

// A picture never changes under its id, so phones and the CDN keep it for a day.
// Served as a JPEG and nothing else: no sniffing, and no scripts or frames if opened on its own.
const HEADERS = {
  "Content-Type": "image/jpeg",
  "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Content-Disposition": "inline",
};

/** A question's or option's picture. Ids are random, so only people given the presentation can find one. */
export async function GET(_req: Request, ctx: RouteContext<"/api/img/[id]">) {
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return notFound();
  try {
    const bytes = await getImage(id.data);
    return bytes ? new Response(new Uint8Array(bytes), { headers: HEADERS }) : notFound();
  } catch (err) {
    logDbError("image", err);
    return unavailable();
  }
}
