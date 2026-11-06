import { endSession, forbiddenOrigin, isSameOrigin } from "@/lib/auth";
import { json, logDbError, unavailable } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenOrigin();
  try {
    const setCookie = await endSession(req);
    return json({ ok: true }, 200, { "Cache-Control": "no-store", "Set-Cookie": setCookie });
  } catch (err) {
    logDbError("auth:logout", err);
    return unavailable();
  }
}
