<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Not finished

### More question types — planned, not built yet

LiveRate has 9 question types: Quiz (`quiz`), Score items (`rating`), Pick one (`poll`), Pick several (`multi`), Put in order (`rank`), Number (`number`), Open answer (`text`), Audience Q&A (`qa`) and Word cloud (`words`). The builder also has a one-tap **Yes / No / Not sure** shortcut (`lib/presets.ts`), which makes a Pick one question with those options. These are still to build:

1. **Split 100 points.** Voters spread 100 points across the options to show priority. This needs a new kind (`points`), a table with one row per voter and option holding the points, a check that the points add up to exactly 100, and a voter screen with +/- steppers and a running total. Results show the average points per option.

Follow-ups for the types already built:

- **Quiz (`quiz`).** Built. A Pick one question with a right answer (`focus_topics.quiz_correct`, the option's index) and a timer (`quiz_seconds`, 5–120, default 20). The owner starts each question from the results screen (`POST /api/admin/sessions/[code]/quiz`: start / end / stop); the running question lives on `sessions.quiz_focus_id` + `quiz_started_at`, and phones learn about it from the status poll (1.5 s while the presentation has a quiz; the CDN caches status for 1 s). Answers lock in once and are scored on arrival: right = 500 + up to 500 for speed, wrong = 0, accepted until 1.5 s after time is up. The right answer is never in the voters' copy of the presentation; it appears in status 2 s after time is up. Players pick a nickname (`quiz_players`) for the top-10 leaderboard; `/api/quiz/[code]/me` gives a player their own score and rank.
  - Not done yet: nicknames go on the big screen with no way for the owner to hide one; changing the right answer after people have answered doesn't re-score them; "Run it again" on a played question only lets people who haven't answered it join in.

- Open answers show up on the presenter's screen as they arrive, with no way to hide one. Add a hide button for the owner before using them in big rooms. Audience Q&A already has one (`app/api/admin/sessions/[code]/qa`); reuse that pattern.
- Pick several has no "at least N" setting. Add one if presenters ask for it.
- Audience Q&A: each person can send up to 3 questions (`MAX_QA_PER_VOTER`). Voters' phones read the list from `/api/qa/[code]`, which the CDN caches for 3 seconds, so a phone shows its own question and vote straight away and the server count catches up (`qaVoterView` in `lib/answers.ts`).

How each type is built, so a new one follows the same pattern: kind check and settings columns in `db/schema.sql` (idempotent, at the end; the kind check is added once, in the last section, with every kind: add the new kind there, and recreate `live_sessions` if you add columns to `sessions`); kinds and answer schemas in `lib/validation.ts`; charts in `lib/charts.ts`; labels in `lib/kinds.ts`; save, results, exports, reset and edit counts in `lib/queries.ts`; maths in `lib/answers.ts`; the voter card in `components/vote/`; the results view in `components/results/`; tests in `test/question-types.test.ts`, `test/qa.test.ts`, `test/quiz.test.ts` and `test/answers-view.test.ts`. Write the tests first.


### Email verification and password reset — built, not switched on (INCOMPLETE)

The code and tests exist (`app/api/auth/{verify,resend-verification,forgot,reset}`, `lib/email.ts`, `lib/email-links.ts`, `test/email-auth.test.ts`), but **production has no email provider configured**, so:

- No verification or password-reset emails are sent in production.
- Verification is **not enforced**: `lib/policy.ts` `requireEmailVerification()` only returns true once `RESEND_API_KEY` is set (or `REQUIRE_EMAIL_VERIFICATION=true`). Until then, new accounts can create presentations without verifying.
- "Forgot password?" in production answers normally but no email arrives.

To finish:

1. Add Resend from the Vercel Marketplace (or resend.com), verify a sending domain.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel (production + preview) and redeploy. Verification is enforced automatically from then on.
3. Decide what to do with accounts created while verification was off. They have `email_verified_at` null and will see the "verify your email" banner and be blocked from creating presentations. Either let them verify, or mark them verified with a one-off SQL update.
4. Test sign-up → verify, and forgot → reset, against production.

The owner decided accounts existing before email verification shipped should be marked verified. At deploy time (2026-11-06) production had no accounts, so nothing needed marking.
