import { sql } from "@/lib/db";
import { NO_STORE, logDbError, unavailable } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Wake-up call. Pages a first-time visitor sees first (home, sign-in) call this in the background,
 * so a sleeping server function and database are awake by the time they create or join something.
 */
export async function GET() {
  try {
    await sql`select 1`;
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch (err) {
    logDbError("warm", err);
    return unavailable();
  }
}
