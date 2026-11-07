<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Not finished

### More question types — planned, not built yet

LiveRate has 9 question types: Quiz (`quiz`), Score items (`rating`), Pick one (`poll`), Pick several (`multi`), Put in order (`rank`), Number (`number`), Open answer (`text`), Audience Q&A (`qa`) and Word cloud (`words`). The builder also has a one-tap **Yes / No / Not sure** shortcut (`lib/presets.ts`), which makes a Pick one question with those options. These are still to build:

1. **Split 100 points.** Voters spread 100 points across the options to show priority. This needs a new kind (`points`), a table with one row per voter and option holding the points, a check that the points add up to exactly 100, and a voter screen with +/- steppers and a running total. Results show the average points per option. Build this next: it's dot voting, the usual way a retro picks what to fix, and LiveRate now targets small meetups and team standups/retros. Once it exists, add it to the Sprint retro template in `lib/templates.ts`.

Follow-ups for the types already built:

- **Quiz (`quiz`).** Built. A Pick one question with a right answer (`focus_topics.quiz_correct`, the option's index) and a timer (`quiz_seconds`, 5–120, default 20). The owner starts each question from the results screen (`POST /api/admin/sessions/[code]/quiz`: start / end / stop); the running question lives on `sessions.quiz_focus_id` + `quiz_started_at`, and phones learn about it from the status poll (1.5 s while the presentation has a quiz; the CDN caches status for 1 s). Answers lock in once and are scored on arrival: right = 500 + up to 500 for speed, wrong = 0, accepted until 1.5 s after time is up. The right answer is never in the voters' copy of the presentation; it appears in status 2 s after time is up. Players pick a nickname (`quiz_players`) for the top-10 leaderboard; `/api/quiz/[code]/me` gives a player their own score and rank.
  - Not done yet: nicknames go on the big screen with no way for the owner to hide one; changing the right answer after people have answered doesn't re-score them; "Run it again" on a played question only lets people who haven't answered it join in.

- Open answers: the owner can hide one (`PATCH /api/admin/sessions/[code]/text`, `text_answers.hidden`, keyed by `text_answers.id` so the voter is never exposed). Hidden answers stay in exports marked "Hidden answer" and are never sent to the AI.
- Pick several has no "at least N" setting. Add one if presenters ask for it.
- Audience Q&A: each person can send up to 3 questions (`MAX_QA_PER_VOTER`). Voters' phones read the list from `/api/qa/[code]`, which the CDN caches for 3 seconds, so a phone shows its own question and vote straight away and the server count catches up (`qaVoterView` in `lib/answers.ts`).

How each type is built, so a new one follows the same pattern: kind check and settings columns in `db/schema.sql` (idempotent, at the end; the kind check is added once, in the last section, with every kind: add the new kind there, and recreate `live_sessions` if you add columns to `sessions`); kinds and answer schemas in `lib/validation.ts`; charts in `lib/charts.ts`; labels in `lib/kinds.ts`; save, results, exports, reset and edit counts in `lib/queries.ts`; maths in `lib/answers.ts`; the voter card in `components/vote/`; the results view in `components/results/`; tests in `test/question-types.test.ts`, `test/qa.test.ts`, `test/quiz.test.ts` and `test/answers-view.test.ts`. Write the tests first.


### Small groups: templates, results on phones, Markdown, AI insights

Built for the target users (small meetups and team standups/retros):

- **Templates** (`lib/templates.ts`): Sprint retro, Standup check-in, Meetup icebreaker, Event feedback. Shown in the builder while it's empty, under an equal "Start blank" choice (templates are optional). After a template or AI draft the builder says what it started from and offers "Choose a different start" (asks first if anything was changed; remembered across a refresh). `planToBody` turns a plan into a create request; AI drafts use the same plan shape.
- **Results on phones**: owner setting `sessions.show_results`. Voters see "See live results" (from the status poll) and `/s/[code]/results`, which reads `/api/results/[code]/public` (CDN 3 s). `audienceResults` in `lib/answers.ts` drops hidden answers, hidden questions and everything about quizzes.
- **Slide designs** (`lib/themes.ts`, `sessions.theme`): 11 looks covering the usual families of slide design: Paper and Mono (minimal), Harbour (professional), Forest (nature), Blush (elegant), Pop (playful), Anime (sakura pink, halftone-dot background via `--theme-pattern`, Mochiy Pop One headings), Chalkboard (classroom), Midnight (dark), Neon (tech), Arcade (bold, for quizzes). Each swaps the colour variables in `app/globals.css` (`surface` replaces white, so dark designs flip `bg-white` and `text-white`) plus the headline font; `useDocumentTheme` puts it on `<html>` on the voter page and the results screens. The builder recommends one from the title and question types (`recommendTheme`) and uses it unless the presenter picks another. Editing without `theme` keeps the current one. QR codes always sit on real white.
- **Fun illustrations** (`components/Doodle.tsx`, `lib/decor.ts`, `sessions.decor`, on by default): original sticker-style doodle characters (paper plane, pencil, boat, leaf, flower, star, chibi cat, moon, robot, trophy, mug, bulb, blob), one pair per design: a bigger one by the title on the big screen and the thank-you screen, a small one by the title on phones. Dark designs give them a white sticker edge (`--doodle-halo`). Drawn in code; no third-party art.
- **Preview** (`components/admin/PresentationPreview.tsx`, `lib/preview.ts`): from the builder, shows each question on the big screen (sample results) or on a phone (the real answer cards, taps not saved), in any design.
- **Copy results as text**: `export?type=markdown` (`lib/markdown.ts`), in the card's More menu.
- **AI insights** (Google Gemini, `lib/ai.ts`, `lib/ai-insights.ts`): off unless the site has `GEMINI_API_KEY` (no key = no AI controls anywhere) and the owner ticks "AI insights" on a presentation (`sessions.ai_enabled`). Accounts only: guests who tick it, or open "Write questions with AI", are asked to save their account; the API answers `account_required`. Daily cap per account (`ai_usage`, `AI_DAILY_LIMIT`, default 20); failed AI calls give the use back. Features: write questions from a description (`/api/admin/ai/questions`), summarise open answers / Q&A into themes and next steps, find repeated Q&A questions and hide the repeats (`/api/admin/sessions/[code]/ai`). Model `GEMINI_MODEL`, default `gemini-3.5-flash-lite`. Tests use `AI_TRANSPORT=memory`.
  - Not done yet: the free Gemini tier may let Google use prompts to improve its products; switch to a paid key (or say so in the privacy note on the home page) before using AI with sensitive answers. AI results aren't saved: refreshing the results screen loses a summary.

### Speed (first visit must feel instant)

- The home page is static and served from the CDN (`○` in the build). It gets its CSP from `next.config.ts` (no nonce, `'unsafe-inline'` scripts; it shows no user content). Every other page needs this request's nonce from `proxy.ts`, so it exports `dynamic = "force-dynamic"` (guarded by `test/speed.test.ts`). A new page must do the same.
- `WarmUp` (home and /admin) calls `/api/warm` (`select 1`) in the background at most every 4 minutes, so a sleeping Vercel function and Neon database are awake before the visitor signs in or creates something.
- The voter page (`/s/[code]`) fetches the questions on the server and passes them to `VoteApp` (`initial`), so phones skip a round trip.
- Loading screens say "Starting up…" after 1.5 s (`SlowHint`).
- Not done: Neon's free tier still pauses the database after ~5 idle minutes and Vercel functions cold-start. A paid Neon plan with autosuspend off (or a keep-warm ping, which uses free-tier compute hours) removes the last cold start.

Still to do for these users: a room code you reuse every sprint with past rounds kept (today "Clear all answers" is the only way to start fresh).

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
