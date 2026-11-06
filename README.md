# LiveRate

Anonymous, near-real-time audience rating for live sessions. The presenter shows a QR code. People rate each topic on each criterion from their phones. Every tap saves instantly, and the dashboard on the big screen updates about every 1.5 s.

- **Voters** (`/s/[code]`): no login and no names. Each tap saves right away, and a changed rating replaces the old one instead of counting twice.
- **Dashboard** (`/s/[code]/dashboard`): three projector views. Switch with the buttons, the keys `1` `2` `3`, or `?view=heatmap|ranking|breakdown` in the URL.
  - **Heatmap**: topic × criterion averages, with an Overall column, an Average row and an overall bar chart.
  - **Ranking**: topics ranked by overall score as large bars.
  - **Breakdown**: per topic, a donut of how many people gave each score, plus mini bars per criterion.
  - `Q` toggles the QR panel.
- **Admin** (`/admin`): create sessions; open/close voting; reset, recalculate or delete; export CSVs.

Stack: Next.js (App Router) + Tailwind on Vercel, and Neon Postgres from the Vercel Marketplace through `@neondatabase/serverless` over HTTP. The dashboard uses short polling on purpose. There are no WebSockets and no third-party realtime services.

## Deploy

1. Push this repo to GitHub and import it into Vercel (or run `vercel link`).
2. In the Vercel dashboard, open the project → **Storage** → create a **Neon** Postgres database in the region closest to your audience → connect it to the project. `DATABASE_URL` is added automatically. CLI alternative: `vercel install neon`.
3. Open the database in the Neon console (Storage → your database → **Open in Neon**) → **SQL Editor** → paste and run [`db/schema.sql`](db/schema.sql) once.
4. In Project Settings → Environment Variables, add:
   - `ADMIN_PASSWORD`: the password for `/admin`.
   - `NEXT_PUBLIC_SITE_URL`: e.g. `https://your-app.vercel.app`. QR codes and share links use it. If it is missing, the browser's own origin is used.

   Then **redeploy**.
5. Optional: set the Vercel function region (Project Settings → Functions) to match the Neon region for lower latency.

## Local development

With your Neon database:

```bash
vercel env pull .env.local
npm install && npm run dev
```

Without any account, using a local Postgres (PGlite, in-process) that speaks Neon's HTTP protocol:

```bash
npm install
npm run db:local          # terminal 1: http://localhost:4444/sql, data in ./.local-db
cat > .env.local <<'EOF'
DATABASE_URL=postgresql://local:local@localhost/main
NEON_FETCH_ENDPOINT=http://localhost:4444/sql
ADMIN_PASSWORD=demo
EOF
npm run dev               # terminal 2
```

`NEON_FETCH_ENDPOINT` is for local use only. Never set it on Vercel.

## Tests

```bash
npm test
```

- `test/api.test.ts` runs every API route against real Postgres (PGlite) through the real Neon driver. It covers validation, 403/404/503 handling, overwrite-not-double-count, concurrent voters, reset/recalculate/delete, CSV exports, and checks that no voter id ever leaks. After the load tests, `db/check.sql` must return zero rows.
- `test/vote-queue.test.ts` covers the phone's save queue: 300 ms debounce per cell, latest value wins, retry with back-off from 3 s up to 15 s, flush on `online`, and pending ratings kept while voting is closed.
- `test/simulate.test.ts` runs the load simulator end to end, including injected 503s.
- `test/lib.test.ts` covers codes, CSV escaping, heatmap colour contrast (≥ 4.5:1 at every value) and stats.

## Before each event

On the free plan, Neon sleeps after 5 minutes without activity, and the first request wakes it up (a second or two). **Open the dashboard a minute early** and leave it open during the session; its polling keeps the database awake. Votes cast during a cold start show "Saving…" and then "Saved ✓". The phone retries until the save succeeds.

## Running a session

1. Open `/admin`, enter the password, and create a session (title, scale, topics and criteria, one per line).
2. Open the dashboard link on the projector, with the QR shown and Fullscreen on.
3. The audience scans and rates. Results fill in live.
4. Click **Close voting**. Phones show "Voting is closed" within about 10 s.
5. Export the **Summary CSV** (averages, with an Overall row per topic) or the **Raw CSV** (respondents shown as R1, R2…, never their ids).

## Load test

```bash
node scripts/simulate.mjs https://your-app.vercel.app <code> 100 20
```

Every fake voter rates every cell, with realistic per-topic means, random 50–500 ms pauses between taps, about 20% of voters changing a rating at the end, and 503 retries. A summary is printed when it finishes. Then run [`db/check.sql`](db/check.sql) in the Neon SQL Editor. It must return **zero rows**, which proves the dashboard totals match the raw votes.

## How correctness is enforced

- A vote is one SQL statement. It checks that the session is open, that the topic and criterion belong to the session, and that the score is within the session's scale. On a repeat vote it upserts on `(session, topic, criterion, voter)`, so a voter can never count twice.
- The `results` table, which the dashboard reads, is updated by a trigger inside the same statement as the vote. If anything ever drifts, close voting and click **Recalculate totals**. That rebuilds the totals from the raw votes.
- Voter ids are random UUIDs, one per browser per session, stored in `localStorage`. No IPs, names or request bodies are stored or logged.
