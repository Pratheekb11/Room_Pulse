import "server-only";

/** How many presentations a guest (no email yet) can create. */
export const GUEST_PRESENTATION_LIMIT = 3;
/** Guest sign-ins and guest presentations last this long. */
export const GUEST_DAYS = 3;
/** A guest sign-in (cookie) lasts at most this long server-side; it also ends when the browser closes. */
export const GUEST_SESSION_HOURS = 12;
/** Wrong PINs allowed per guest per hour before PIN sign-in is locked. */
export const GUEST_PIN_ATTEMPTS_PER_HOUR = 5;
/** New guest accounts allowed per hour across the whole site (abuse brake; no IPs are stored). */
export const GUEST_ACCOUNTS_PER_HOUR = 200;

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
