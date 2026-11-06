# LiveRate

Anonymous, near-real-time audience voting for live sessions. Presenters start straight away as a guest (no sign-up; they get an 8-character **guest code** like `K7QM-3XPA` to get back in on any device, and guest presentations are deleted after 3 days) or sign up with email and password. A presentation has up to 10 **questions**. Each question is one of:

- **Rate topics:** up to 10 topics, each scored on your criteria (e.g. Impact, Feasibility).
- **Poll:** pick one of 2–10 options.
- **Word cloud:** up to 3 words or short phrases per person.

The audience scans a QR code and answers on their phones: one screen at a time, with emoji rating keys, levels and points. Every tap saves instantly, and the dashboard on the big screen updates about every 1.5 s.

- **Voters** (`/s/[code]`): no login and no names. Each tap saves right away, and a changed rating replaces the old one instead of counting twice.
- **Results screen** (`/s/[code]/dashboard#k=…`): private. It needs the secret key in the presenter link (after `#`, so it never reaches server logs) or the owner's sign-in; the public voting code alone shows nothing. Opens on an overview card per question. Click a card (or press `→`/`←`, `Esc` for the overview, or use `?focus=2`) to see its results:
  - Rating questions have four views (keys `1`–`4`, or `?view=`):
    - **Heatmap:** topic × criterion averages.
    - **Ranking:** topics ranked by overall score.
    - **Breakdown:** a donut of the score distribution per topic.
    - **Summary:** an executive view with the top pick, the strongest and weakest criterion, and how much the room agrees on each topic.
  - Polls show bars or a pie chart. Word clouds show a live word cloud.
  - `Q` toggles the QR panel.
- **Presenter console** (`/admin`): sign up / log in; build presentations; open/close voting; reset, recalculate or delete; export CSVs. Each account only sees its own presentations.

**Editing**: open **Edit questions** from your presentations or from the results screen. Renamed or moved items keep their answers; removed items delete theirs (you're asked first). A question's type can't change, and the scoring range locks once anyone has scored. Phones pick up changes within about 15 seconds.

Stack: Next.js (App Router) + Tailwind on Vercel, and Neon Postgres from the Vercel Marketplace through `@neondatabase/serverless` over HTTP. The dashboard uses short polling on purpose. There are no WebSockets and no third-party realtime services.

## Deploy

1. Push this repo to GitHub and import it into Vercel (or run `vercel link`).
2. In the Vercel dashboard, open the project → **Storage** → create a **Neon** Postgres database in the region closest to your audience → connect it to the project. `DATABASE_URL` is added automatically. CLI alternative: `vercel install neon`.
3. Open the database in the Neon console (Storage → your database → **Open in Neon**) → **SQL Editor** → paste and run [`db/schema.sql`](db/schema.sql) once.
4. In Project Settings → Environment Variables, add:
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
EOF
npm run dev               # terminal 2
```

`NEON_FETCH_ENDPOINT` is for local use only. Never set it on Vercel.

## Tests

```bash
npm test
```

- `test/email-auth.test.ts` covers email verification and password reset: single use, expiry, rate limits, no account discovery, sign-out on reset, and links that can't be redirected via the Host header.
- `test/auth.test.ts` covers sign-up, log-in, log-out, password hashing, lockout, cross-site blocking and per-account separation.
- `test/questions.test.ts` covers polls and word clouds: validation, changing answers, closed sessions, reset and exports.
- `test/api.test.ts` runs every API route against real Postgres (PGlite) through the real Neon driver. It covers validation, 403/404/503 handling, overwrite-not-double-count, concurrent voters, reset/recalculate/delete, CSV exports, and checks that no voter id ever leaks. After the load tests, `db/check.sql` must return zero rows.
- `test/vote-queue.test.ts` covers the phone's save queue: 300 ms debounce per cell, latest value wins, retry with back-off from 3 s up to 15 s, flush on `online`, and pending ratings kept while voting is closed.
- `test/simulate.test.ts` runs the load simulator end to end, including injected 503s.
- `test/lib.test.ts` covers codes, CSV escaping, heatmap colour contrast (≥ 4.5:1 at every value) and stats.

## Before each event

On the free plan, Neon sleeps after 5 minutes without activity, and the first request wakes it up (a second or two). **Open the dashboard a minute early** and leave it open during the session; its polling keeps the database awake. Votes cast during a cold start show "Saving…" and then "Saved ✓". The phone retries until the save succeeds.

## Running a session

1. Open `/admin`, enter the password, and create a session (title, scale, topics and criteria, one per line).
2. Open the private results link on the projector, with the QR shown and Fullscreen on.
3. The audience scans and rates. Results fill in live.
4. Click **Close voting**. Phones show "Voting is closed" within about 10 s.
5. Export the **Summary CSV** (averages, with an Overall row per topic) or the **Raw CSV** (respondents shown as R1, R2…, never their ids).

## Load test

```bash
node scripts/simulate.mjs https://your-app.vercel.app <code> 100 20
```

Every fake voter rates every cell, with realistic per-topic means, random 50–500 ms pauses between taps, about 20% of voters changing a rating at the end, and 503 retries. A summary is printed when it finishes. Then run [`db/check.sql`](db/check.sql) in the Neon SQL Editor. It must return **zero rows**, which proves the dashboard totals match the raw votes.

## Email (verification and password reset)

New accounts must verify their email before they can create presentations, and "Forgot password?" sends a reset link. Emails go through [Resend](https://resend.com) over its HTTP API:

1. In Vercel, open the project → **Storage / Integrations** → add **Resend** from the Marketplace (or create an API key at resend.com).
2. Verify a sending domain in Resend.
3. Set `RESEND_API_KEY` and `EMAIL_FROM` (for example `LiveRate <no-reply@yourdomain.com>`) in Project Settings → Environment Variables, then redeploy.

Without `RESEND_API_KEY`, local development prints the links to the server console. In production, emails fail (and are logged as `EmailNotConfiguredError`), so new accounts can't verify. Configure email before relying on sign-up.

Links in emails always use `NEXT_PUBLIC_SITE_URL` (or Vercel's production URL), never the request's Host header.

## Upgrading an existing database

`db/schema.sql` is idempotent. Re-running it in the Neon SQL Editor adds anything new (accounts, focus topics, polls, word clouds) without touching existing data. Presentations created before accounts existed have no owner, so they don't appear in anyone's console.

## Accounts and security

- **Passwords:** stored only as salted **scrypt** hashes (N=2^15, r=8, p=1, using Node's built-in crypto). They are compared in constant time and must be 10–128 characters.
- **Sign-in:** a random 256-bit token in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie with the `__Host-` prefix. Only a SHA-256 hash of the token is stored. Sessions last 30 days and are deleted on log-out.
- **Login errors:** the same response for an unknown email and a wrong password. A full hash check runs either way, so response time doesn't reveal which emails exist.
- **Lockout:** an email is locked for 15 minutes after 10 failed logins. No IP addresses are stored.
- **Cross-site writes:** account and presenter changes from another site are rejected (checked with the `Origin` and `Sec-Fetch-Site` headers).
- **Separation between accounts:** someone else's presentation looks exactly like one that doesn't exist (404).
- **Email verification and password reset:** links are random 256-bit tokens, stored only as SHA-256 hashes. They work once and expire (24 hours for verification, 30 minutes for reset). Each account gets at most 3 emails of each kind per hour. The forgot-password form answers the same way for any email, and sends after responding, so neither the answer nor its timing reveals who has an account. A reset signs out every session and clears any login lockout. Pages that receive a link remove the token from the address bar and send no referrer.
- **Open sign-up:** anyone with the URL can create an account, but must verify their email before creating presentations.

## How correctness is enforced

- A vote is one SQL statement. It checks that the session is open, that the topic and criterion belong to the session, and that the score is within the session's scale. On a repeat vote it upserts on `(session, topic, criterion, voter)`, so a voter can never count twice.
- The `results` table, which the dashboard reads, is updated by a trigger inside the same statement as the vote. If anything ever drifts, close voting and click **Recount totals**. That rebuilds the totals from the raw votes.
- Poll choices are one row per voter per poll (changing your pick updates it). Word answers are replaced as a set, in one transaction. Results for both are counted straight from these rows on every poll, so their totals can't drift.
- On the phone, every answer goes through the same save queue. It waits 300 ms after a tap, sends only the latest value, retries with back-off on network errors and 5xx responses, and keeps unsent answers in `localStorage`, so even a page reload while offline doesn't lose them.
- Voter ids are random UUIDs, one per browser per session, stored in `localStorage`. No IPs, names or request bodies are stored or logged. Exports replace voter ids with R1, R2….
