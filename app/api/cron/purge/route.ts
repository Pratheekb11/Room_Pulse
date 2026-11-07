import { timingSafeEqual } from "node:crypto";
import { GUEST_DAYS } from "@/lib/policy";
import { purgeExpiredGuestData } from "@/lib/queries";
import { NO_STORE, json, logDbError, unavailable } from "@/lib/http";

export const dynamic = "force-dynamic";

/** True when the request carries `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it). No secret set = refused. */
function fromScheduler(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Daily clean-up (vercel.json `crons`): deletes guest presentations and guest accounts once their
 * GUEST_DAYS are up, so no guest data is kept longer, even on days no new guest arrives.
 */
export async function GET(req: Request) {
  if (!fromScheduler(req)) return json({ error: "unauthorized" }, 401, NO_STORE);
  try {
    const deleted = await purgeExpiredGuestData(GUEST_DAYS);
    console.log(`[cron:purge] deleted ${deleted.sessions} presentations and ${deleted.users} guest accounts`);
    return json(deleted, 200, NO_STORE);
  } catch (err) {
    logDbError("cron:purge", err);
    return unavailable();
  }
}
