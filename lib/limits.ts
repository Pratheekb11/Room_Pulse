import "server-only";
import { createHash } from "node:crypto";
import { sql } from "./db";
import { json } from "./http";

/**
 * Abuse limits: how many requests one client (by network address) may make per time window.
 * Counted in the database (`rate_hits`), so every server instance shares them. Only a salted hash
 * of the address is stored, and counters are deleted after a day (the daily clean-up).
 */
export const LIMITS = {
  /**
   * Password checks (log in, sign up, reset, save a guest account): scrypt is deliberately slow.
   * A 100-person workshop on one Wi-Fi signs up and logs in again within minutes.
   */
  auth: { max: 300, seconds: 600 },
  /** New accounts with an email: everyone in a 100-person workshop on one Wi-Fi. */
  signup: { max: 100, seconds: 3600 },
  /** New guest accounts: everyone in a 100-person workshop on one Wi-Fi. */
  guest: { max: 100, seconds: 3600 },
  /** Guest-code sign-ins. */
  guestCode: { max: 100, seconds: 600 },
  /**
   * Answers of any kind. Generous: a whole room can share one Wi-Fi address, and 100 people scoring
   * 5 items on 3 measures in the same minute is 1,500 taps. Still far below a flood.
   */
  answer: { max: 6000, seconds: 60 },
  /** New voters (anonymous voter ids) one address brings: a full presentation's worth, from one venue Wi-Fi. */
  newVoter: { max: 1000, seconds: 3600 },
  /** Pictures uploaded (each up to 200 KB): a room of presenters building at once, but not a disk-filling script. */
  upload: { max: 300, seconds: 3600 },
} as const satisfies Record<string, { max: number; seconds: number }>;
export type LimitName = keyof typeof LIMITS;

/** Voters one presentation takes (LiveRate is for meetups and teams); "Clear all answers" starts over. */
export const MAX_VOTERS_PER_PRESENTATION = 1000;
/** Presentations a saved account can have at once. */
export const ACCOUNT_PRESENTATION_LIMIT = 100;

/**
 * The client's address as the host reports it (Vercel sets x-real-ip and overwrites x-forwarded-for,
 * so clients can't fake them). Null outside production when there is none (tests, scripts): no limit.
 */
function clientAddress(req: Request): string | null {
  const real = req.headers.get("x-real-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const addr = real || forwarded;
  if (addr) return addr;
  return process.env.NODE_ENV === "production" ? "unknown" : null;
}

/** Salted hash of the client's address (never stored as is), or null when there is none. */
export function clientId(req: Request): string | null {
  const addr = clientAddress(req);
  if (!addr) return null;
  const salt = process.env.RATE_LIMIT_SECRET || process.env.CRON_SECRET || "liverate";
  return createHash("sha256").update(`${salt}:${addr}`).digest("base64url").slice(0, 22);
}

/** Counts one use of `bucket` in the current window; false once it has gone over `max`. */
export async function takeKey(bucket: string, max: number, seconds: number): Promise<boolean> {
  const rows = (await sql`
    insert into rate_hits (bucket, window_start, n)
    values (${bucket}, to_timestamp(floor(extract(epoch from now()) / ${seconds}::int) * ${seconds}::int), 1)
    on conflict (bucket, window_start) do update set n = rate_hits.n + 1
    returning n
  `) as { n: number }[];
  return Number(rows[0].n) <= max;
}

/** Takes back one use of `bucket` in the current window (for work that failed). */
export async function giveBack(bucket: string, seconds: number): Promise<void> {
  await sql`
    update rate_hits set n = greatest(0, n - 1)
     where bucket = ${bucket} and window_start = to_timestamp(floor(extract(epoch from now()) / ${seconds}::int) * ${seconds}::int)
  `;
}

/** Counts one request from this client against a limit; false when it's over. */
export async function take(req: Request, name: LimitName): Promise<boolean> {
  const id = clientId(req);
  if (!id) return true;
  const { max, seconds } = LIMITS[name];
  return takeKey(`${name}:${id}`, max, seconds);
}

export const tooMany = (retryAfterSeconds: number): Response =>
  json({ error: "too_many_requests" }, 429, { "Cache-Control": "no-store", "Retry-After": String(retryAfterSeconds) });

/** A 429 response when this client is over the limit, otherwise null (and the request is counted). */
export async function limited(req: Request, name: LimitName): Promise<Response | null> {
  return (await take(req, name)) ? null : tooMany(LIMITS[name].seconds);
}

