#!/usr/bin/env node
// Vote simulator / load test.
//
//   node scripts/simulate.mjs <baseUrl> <code> [voters=50] [concurrency=10]
//
// Each fake voter gets a random UUID and rates every topic × criterion with a
// random 50–500 ms pause between taps. Every topic has a hidden "true" mean plus
// noise so the heatmap looks realistic. About 20% of voters change one rating at
// the end. 503s / network errors are retried with the same back-off as the browser.

const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Approximately normal noise (sum of uniforms). */
const noise = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.4;

/**
 * @param {{
 *   baseUrl: string, code: string, voters?: number, concurrency?: number,
 *   fetch?: typeof fetch, minDelayMs?: number, maxDelayMs?: number,
 *   retryBaseMs?: number, maxAttempts?: number, log?: (msg: string) => void,
 * }} opts
 */
export async function simulate(opts) {
  const {
    baseUrl,
    code,
    voters = 50,
    concurrency = 10,
    fetch: doFetch = globalThis.fetch,
    minDelayMs = 50,
    maxDelayMs = 500,
    retryBaseMs = 3000,
    maxAttempts = 8,
    log = console.log,
  } = opts;
  const base = baseUrl.replace(/\/+$/, "");
  const stats = { requests: 0, failures: 0, retries: 0, changed: 0, pollsSent: 0, wordsSent: 0, elapsedMs: 0 };
  const started = Date.now();

  const res = await doFetch(`${base}/api/session/${encodeURIComponent(code)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load session ${code}: HTTP ${res.status}`);
  const { session, topics: allTopics, criteria, focusTopics = [] } = await res.json();
  const kindOf = new Map(focusTopics.map((f) => [f.id, f.kind ?? "rating"]));
  // Rating topics get scores; polls get one choice; word clouds get 1–3 words.
  const topics = allTopics.filter((t) => !t.focusId || kindOf.get(t.focusId) === "rating");
  const polls = focusTopics.filter((f) => f.kind === "poll").map((f) => ({ ...f, options: allTopics.filter((t) => t.focusId === f.id) }));
  const clouds = focusTopics.filter((f) => f.kind === "words");
  const WORDS = ["speed", "trust", "focus", "growth", "customers", "quality", "simplicity", "bold", "ai", "teamwork"];
  const max = session.scaleMax;
  if (!session.isOpen) throw new Error("Session is closed: reopen voting in /admin first.");

  // Hidden "true" mean per topic, and a small bias per criterion.
  const topicMean = new Map(topics.map((t) => [t.id, rand(1.6, max - 0.4)]));
  const critBias = new Map(criteria.map((c) => [c.id, rand(-0.6, 0.6)]));
  const scoreFor = (t, c) => Math.round(clamp(topicMean.get(t.id) + critBias.get(c.id) + noise(), 1, max));

  async function post(body, path = "/api/vote") {
    let delay = retryBaseMs;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      stats.requests++;
      let status = 0;
      try {
        const r = await doFetch(`${base}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        status = r.status;
        if (r.ok) return true;
      } catch {
        status = 0; // network error
      }
      if (status !== 0 && status < 500 && status !== 429) break; // 4xx: retrying won't help
      if (attempt < maxAttempts) {
        stats.retries++;
        await sleep(delay);
        delay = Math.min(delay * 2, 15000);
      }
    }
    stats.failures++;
    return false;
  }

  async function runVoter() {
    const voterId = crypto.randomUUID();
    for (const t of topics) {
      for (const c of criteria) {
        await post({ code, topicId: t.id, criterionId: c.id, voterId, score: scoreFor(t, c) });
        await sleep(rand(minDelayMs, maxDelayMs));
      }
    }
    for (const p of polls) {
      // Earlier options are a bit more popular, so the chart isn't flat.
      const i = Math.min(p.options.length - 1, Math.floor(Math.random() ** 1.6 * p.options.length));
      if (await post({ code, voterId, kind: "poll", focusId: p.id, topicId: p.options[i].id }, "/api/answer")) stats.pollsSent++;
      await sleep(rand(minDelayMs, maxDelayMs));
    }
    for (const c of clouds) {
      const n = 1 + Math.floor(Math.random() * 3);
      const picks = [...new Set(Array.from({ length: n }, () => WORDS[Math.floor(Math.random() ** 1.8 * WORDS.length)]))];
      if (await post({ code, voterId, kind: "words", focusId: c.id, words: picks }, "/api/answer")) stats.wordsSent += picks.length;
      await sleep(rand(minDelayMs, maxDelayMs));
    }
    if (topics.length && criteria.length && (Math.random() < 0.2 || stats.changed === 0)) {
      // ~20% change one rating (and at least one voter always does, to exercise updates).
      stats.changed++;
      const t = topics[Math.floor(Math.random() * topics.length)];
      const c = criteria[Math.floor(Math.random() * criteria.length)];
      await post({ code, topicId: t.id, criterionId: c.id, voterId, score: Math.ceil(rand(0, max)) || 1 });
    }
  }

  let next = 0;
  let done = 0;
  async function worker() {
    while (next < voters) {
      next++;
      await runVoter();
      done++;
      if (done % 10 === 0 || done === voters) log(`  ${done}/${voters} voters finished`);
    }
  }

  log(`Simulating ${voters} voters (${concurrency} at a time) on “${session.title}” — ${topics.length} × ${criteria.length} cells`);
  await Promise.all(Array.from({ length: Math.min(concurrency, voters) }, worker));

  stats.elapsedMs = Date.now() - started;
  return stats;
}

async function main() {
  const [baseUrl, code, voters = "50", concurrency = "10"] = process.argv.slice(2);
  if (!baseUrl || !code) {
    console.error("Usage: node scripts/simulate.mjs <baseUrl> <code> [voters=50] [concurrency=10]");
    process.exit(1);
  }
  const s = await simulate({ baseUrl, code, voters: Number(voters), concurrency: Number(concurrency) });
  console.log("\nDone.");
  console.log(`  Requests: ${s.requests}`);
  console.log(`  Failures: ${s.failures}`);
  console.log(`  Retries:  ${s.retries}`);
  console.log(`  Changed:  ${s.changed} voters changed a rating`);
  console.log(`  Polls:    ${s.pollsSent} poll answers, ${s.wordsSent} words`);
  console.log(`  Elapsed:  ${(s.elapsedMs / 1000).toFixed(1)} s`);
  if (s.failures > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
