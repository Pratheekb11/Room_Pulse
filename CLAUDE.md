# LiveRate

Project instructions are in AGENTS.md (read it first: this Next.js version has breaking changes).

Build test-first: write a failing test, then the code. Check every screen at 390px wide as well as on desktop.

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

- **Templates** (`lib/templates.ts`): Sprint retro, Standup check-in, Meetup icebreaker, Event feedback. Shown in the builder while it's empty. `planToBody` turns a plan into a create request; AI drafts use the same plan shape.
- **Results on phones**: owner setting `sessions.show_results`. Voters see "See live results" (from the status poll) and `/s/[code]/results`, which reads `/api/results/[code]/public` (CDN 3 s). `audienceResults` in `lib/answers.ts` drops hidden answers, hidden questions and everything about quizzes.
- **Copy results as text**: `export?type=markdown` (`lib/markdown.ts`), in the card's More menu.
- **AI insights** (Google Gemini, `lib/ai.ts`, `lib/ai-insights.ts`): off unless the site has `GEMINI_API_KEY` (no key = no AI controls anywhere) and the owner ticks "AI insights" on a presentation (`sessions.ai_enabled`). Accounts only: guests who tick it, or open "Write questions with AI", are asked to save their account; the API answers `account_required`. Daily cap per account (`ai_usage`, `AI_DAILY_LIMIT`, default 20); failed AI calls give the use back. Features: write questions from a description (`/api/admin/ai/questions`), summarise open answers / Q&A into themes and next steps, find repeated Q&A questions and hide the repeats (`/api/admin/sessions/[code]/ai`). Model `GEMINI_MODEL`, default `gemini-3.5-flash-lite`. Tests use `AI_TRANSPORT=memory`.
  - Not done yet: the free Gemini tier may let Google use prompts to improve its products; switch to a paid key (or say so in the privacy note on the home page) before using AI with sensitive answers. AI results aren't saved: refreshing the results screen loses a summary.

Still to do for these users: a room code you reuse every sprint with past rounds kept (today "Clear all answers" is the only way to start fresh).

