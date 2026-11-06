import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { hashToken } from "./auth";
import { resetEmail, sendEmail, siteUrlForEmail, verificationEmail } from "./email";
import { countRecentEmailTokens, insertEmailToken, type EmailTokenPurpose, type UserRow } from "./queries";

export const LINK_MINUTES: Record<EmailTokenPurpose, number> = { verify: 24 * 60, reset: 30 };
export const MAX_EMAILS_PER_HOUR = 3;

export const tokenShape = /^[A-Za-z0-9_-]{43}$/;

/**
 * Creates a single-use link and emails it. Returns "rate_limited" (and sends nothing)
 * after MAX_EMAILS_PER_HOUR links of this kind for this account in the last hour.
 */
export async function sendLink(user: UserRow & { email: string }, purpose: EmailTokenPurpose): Promise<"sent" | "rate_limited"> {
  if ((await countRecentEmailTokens(user.id, purpose, 60)) >= MAX_EMAILS_PER_HOUR) return "rate_limited";
  const token = randomBytes(32).toString("base64url"); // 256 bits, 43 characters
  await insertEmailToken(hashToken(token), user.id, purpose, LINK_MINUTES[purpose]);
  const link = `${siteUrlForEmail()}/${purpose}?token=${token}`;
  await sendEmail(purpose === "verify" ? verificationEmail(user.email, link) : resetEmail(user.email, link));
  return "sent";
}

/**
 * Runs `task` after the response is sent when possible, so the response time
 * doesn't depend on whether an email went out. Errors are logged, never thrown.
 */
export async function inBackground(name: string, task: () => Promise<unknown>): Promise<void> {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[${name}] failed`, (err as Error)?.name ?? "Error");
    }
  };
  if (process.env.EMAIL_TRANSPORT === "memory") return safe(); // tests: deterministic
  try {
    after(safe);
  } catch {
    await safe(); // outside a request scope
  }
}
