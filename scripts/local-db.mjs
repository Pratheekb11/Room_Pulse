#!/usr/bin/env node
// Local development database: PGlite (Postgres in WASM) behind Neon's HTTP
// query protocol, so the app runs unchanged without a Neon account.
//
//   node scripts/local-db.mjs            # listens on http://localhost:4444/sql
//
// Then in .env.local:
//   DATABASE_URL=postgresql://local:local@localhost/main
//   NEON_FETCH_ENDPOINT=http://localhost:4444/sql
//
// Data is kept in ./.local-db (delete the folder to start fresh).
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const PORT = Number(process.env.PORT ?? 4444);
const dir = new URL("../.local-db", import.meta.url).pathname;
const fresh = !existsSync(dir);
const db = new PGlite(dir, { extensions: { pgcrypto } });
// db/schema.sql is idempotent: apply it on every start so new columns reach an existing local database.
await db.exec(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));

const toText = (v) =>
  v === null || v === undefined ? null
  : typeof v === "boolean" ? (v ? "t" : "f")
  : v instanceof Date ? v.toISOString().replace("T", " ").replace("Z", "+00")
  : typeof v === "object" ? JSON.stringify(v)
  : String(v);

async function run(q, exec) {
  const res = await exec.query(q.query, q.params, { rowMode: "array" });
  return {
    fields: res.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: res.rows.map((r) => r.map(toText)),
    rowCount: res.affectedRows ?? res.rows.length,
    command: "",
  };
}

// PGlite is single-connection: serialise requests.
let chain = Promise.resolve();

createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    chain = chain.then(async () => {
      try {
        const body = JSON.parse(raw);
        const out = body.queries
          ? { results: await db.transaction(async (tx) => { const r = []; for (const q of body.queries) r.push(await run(q, tx)); return r; }) }
          : await run(body, db);
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
      } catch (err) {
        res.writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify({ message: err.message, code: err.code, constraint: err.constraint }));
      }
    });
  });
}).listen(PORT, () => console.log(`Local Neon-compatible DB on http://localhost:${PORT}/sql${fresh ? " (schema created)" : ""}`));
