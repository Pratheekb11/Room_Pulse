#!/usr/bin/env node
// Runs a .sql file on a Neon database, as one transaction (all of it or none of it).
//
//   node scripts/run-sql.mjs db/2026-11-14-pictures-points-ai.sql
//
// Asks for the connection string without showing it (or reads DATABASE_URL if it's set), so it
// isn't saved in your shell history. Works on networks whose DNS can't find *.neon.tech: the
// address is looked up with DNS over HTTPS (Cloudflare, then Google) and TLS still checks the real
// host name. Prints the rows of the file's last statement.
import { readFileSync } from "node:fs";
import https from "node:https";
import { createInterface } from "node:readline";
import { neon, neonConfig } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}
const text = readFileSync(file, "utf8");

/** Statements in order: splits on `;` outside quotes, comments and $$ blocks. */
function statements(src) {
  const out = [];
  let cur = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "-" && src[i + 1] === "-") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? src.length : end;
      cur += "\n";
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1);
      cur += src.slice(i, end + 1);
      i = end;
    } else if (c === "$") {
      const tag = src.slice(i).match(/^\$[A-Za-z_]*\$/)?.[0];
      if (!tag) cur += c;
      else {
        const end = src.indexOf(tag, i + tag.length);
        cur += src.slice(i, end + tag.length);
        i = end + tag.length - 1;
      }
    } else if (c === ";") {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function ask(question) {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.output.write("\n");
      rl.close();
      done(answer.trim());
    });
  });
}

const resolved = new Map();
async function addressOf(host) {
  if (resolved.has(host)) return resolved.get(host);
  for (const doh of ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"]) {
    try {
      const res = await fetch(`${doh}?name=${encodeURIComponent(host)}&type=A`, { headers: { accept: "application/dns-json" } });
      const ip = (await res.json()).Answer?.filter((a) => a.type === 1).at(-1)?.data;
      if (ip) {
        resolved.set(host, ip);
        return ip;
      }
    } catch {
      /* try the next one */
    }
  }
  throw new Error(`Couldn't find the address of ${host}`);
}

// Local development database (scripts/local-db.mjs): plain HTTP, no address lookup needed.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else neonConfig.fetchFunction = async (target, init) => {
  const u = new URL(target);
  const ip = await addressOf(u.hostname);
  return new Promise((done, fail) => {
    const req = https.request(
      {
        host: u.hostname,
        servername: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: init.method ?? "POST",
        headers: init.headers,
        lookup: (_host, opts, cb) => (opts?.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4)),
        timeout: 60_000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          done(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: Object.entries(res.headers).filter(([, v]) => typeof v === "string") })),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", fail);
    if (init.body) req.write(init.body);
    req.end();
  });
};

const url = process.env.DATABASE_URL || (await ask("Connection string (hidden): "));
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error("That doesn't look like a connection string (it starts with postgresql://).");
  process.exit(1);
}
const sql = neon(url);
const list = statements(text);
console.log(`Running ${list.length} statements from ${file} on ${new URL(url).hostname.split(".")[0]}…`);
try {
  const results = await sql.transaction(list.map((s) => sql.query(s)));
  console.log("Done. Everything was applied.");
  const last = results[results.length - 1];
  if (Array.isArray(last) && last.length) console.table(last);
} catch (err) {
  console.error("Failed, so nothing was changed:", err.message);
  process.exit(1);
}
