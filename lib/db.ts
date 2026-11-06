import "server-only";
import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

// Optional, for local development only: point the HTTP driver at a local
// Neon-compatible HTTP proxy (e.g. http://localhost:4444/sql).
if (process.env.NEON_FETCH_ENDPOINT) {
  neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
}

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;

function getClient(): Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Database is not configured: set DATABASE_URL (added automatically by the Vercel Marketplace Neon integration) or POSTGRES_URL.",
    );
  }
  client = neon(url);
  return client;
}

/**
 * The Neon HTTP query function. Created lazily on first use so that `next build`
 * works without a database connection string.
 */
export const sql: Sql = new Proxy((() => undefined) as unknown as Sql, {
  apply(_target, _thisArg, args: unknown[]) {
    return Reflect.apply(getClient() as unknown as (...a: unknown[]) => unknown, undefined, args);
  },
  get(_target, prop) {
    const c = getClient();
    const value: unknown = Reflect.get(c, prop);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
