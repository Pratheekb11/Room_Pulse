import "server-only";

export { GUEST_DAYS, GUEST_PRESENTATION_LIMIT } from "./guest-rules";
/** A guest sign-in (cookie) lasts at most this long server-side; it also ends when the browser closes. */
export const GUEST_SESSION_HOURS = 12;
/**
 * New guest accounts allowed per hour across the whole site: a last-resort brake. Each address has its
 * own, much lower limit (lib/limits.ts), so one script can't use this up and block everyone.
 */
export const GUEST_ACCOUNTS_PER_HOUR = 1000;

/**
 * Wrong guest codes allowed site-wide per 10 minutes before guest sign-in pauses for everyone: a last
 * resort against guessing from many addresses at once. Each address is limited far sooner (lib/limits.ts).
 * With 31^8 possible codes this keeps guessing any guest's code far out of reach.
 */
export const GUEST_CODE_FAILURES_PER_10_MIN = 2000;

/** Wrong passwords for one email from one address (15 minutes) before that address is paused for it. */
export const LOGIN_FAILURES_PER_IP = 10;
/** Wrong passwords for one email from all addresses together (15 minutes) before the email is paused. */
export const LOGIN_FAILURES_PER_EMAIL = 100;

/** True when emails can actually be sent (or captured in tests / printed in development). */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY) || process.env.EMAIL_TRANSPORT === "memory" || process.env.NODE_ENV !== "production";
}

/**
 * Email verification is only enforced once sending email is configured
 * (RESEND_API_KEY), or when REQUIRE_EMAIL_VERIFICATION=true. Until then,
 * new accounts can create presentations straight away. See AGENTS.md.
 */
export function requireEmailVerification(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true" || Boolean(process.env.RESEND_API_KEY);
}
