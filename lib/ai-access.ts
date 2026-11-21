import "server-only";
import { aiAvailable, aiDailyLimit, aiSiteDailyLimit } from "./ai";
import { giveBack, takeKey } from "./limits";
import { json } from "./http";
import { refundAiCredit, takeAiCredit } from "./queries";

const SITE_BUCKET = "ai-site";
const DAY = 24 * 60 * 60;

export const accountRequired = () => json({ error: "account_required" }, 403);

/**
 * Runs one AI request for a signed-in account: checks the key and the daily cap, and gives the use
 * back if the AI fails or its reply can't be used (`run` returns null).
 */
export async function withAiCredit<T>(user: { id: string; isGuest: boolean }, run: () => Promise<T | null>): Promise<Response | T> {
  if (user.isGuest) return accountRequired();
  if (!aiAvailable()) return json({ error: "ai_unavailable" }, 503);
  if (!(await takeAiCredit(user.id, aiDailyLimit()))) return json({ error: "ai_limit" }, 429);
  // The site's own daily cap: new accounts are free to make, so per-account caps alone don't bound the total.
  if (!(await takeKey(SITE_BUCKET, aiSiteDailyLimit(), DAY))) {
    await refundAiCredit(user.id);
    return json({ error: "ai_limit" }, 429);
  }
  let out: T | null = null;
  try {
    out = await run();
  } catch (err) {
    console.error("[ai] request failed", (err as Error).name, (err as Error).message.slice(0, 80));
  }
  if (out === null) {
    await refundAiCredit(user.id);
    await giveBack(SITE_BUCKET, DAY);
    return json({ error: "ai_failed" }, 502);
  }
  return out;
}
