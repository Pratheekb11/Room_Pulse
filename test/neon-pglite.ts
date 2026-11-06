// Test harness: answers the Neon serverless HTTP protocol from an in-process
// PGlite (real Postgres compiled to WASM), so lib/db.ts + lib/queries.ts run
// unchanged against real SQL, real constraints and the real trigger.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { neonConfig } from "@neondatabase/serverless";

type Q = { query: string; params: unknown[] };

// Neon sends every column as Postgres text output ("Neon-Raw-Text-Output: true");
// PGlite hands back parsed JS values, so turn them back into text.
function toText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? "t" : "f";
  if (v instanceof Date) return v.toISOString().replace("T", " ").replace("Z", "+00"); // Postgres text format
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function startTestDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

  async function run(q: Q, exec: Pick<PGlite, "query">) {
    const res = await exec.query<unknown[]>(q.query, q.params, { rowMode: "array" });
    return {
      fields: res.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
      rows: res.rows.map((row) => row.map(toText)),
      rowCount: res.affectedRows ?? res.rows.length,
      command: "",
    };
  }

  neonConfig.fetchFunction = async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Q | { queries: Q[] };
    try {
      const out =
        "queries" in body
          ? { results: await db.transaction(async (tx) => { const r = []; for (const q of body.queries) r.push(await run(q, tx)); return r; }) }
          : await run(body, db);
      return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      const e = err as { message?: string; code?: string; constraint?: string };
      return new Response(JSON.stringify({ message: e.message, code: e.code, constraint: e.constraint }), { status: 400 });
    }
  };
  process.env.DATABASE_URL = "postgresql://test:test@db.test.invalid/main";
  return db;
}

/** Make the next N database calls fail like a sleeping/unreachable Neon. */
export function failNextFetches(n: number) {
  const real = neonConfig.fetchFunction as (u: string, i: unknown) => Promise<Response>;
  let left = n;
  neonConfig.fetchFunction = async (u: string, i: unknown) => {
    if (left-- > 0) throw new TypeError("fetch failed");
    neonConfig.fetchFunction = real;
    return real(u, i);
  };
}

export async function truncateAll(db: PGlite) {
  await db.exec("truncate sessions cascade");
}
