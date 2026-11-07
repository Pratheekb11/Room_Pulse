# LiveRate

Project instructions are in AGENTS.md (read it first: this Next.js version has breaking changes).

Build test-first: write a failing test, then the code. Check every screen at 390px wide as well as on desktop.

## Not finished

### More question types — planned, not built yet

LiveRate has 8 question types: Score items (`rating`), Pick one (`poll`), Pick several (`multi`), Put in order (`rank`), Number (`number`), Open answer (`text`), Audience Q&A (`qa`) and Word cloud (`words`). The builder also has a one-tap **Yes / No / Not sure** shortcut (`lib/presets.ts`), which makes a Pick one question with those options. These are still to build, cheapest first:

1. **Split 100 points.** Voters spread 100 points across the options to show priority. This needs a new kind (`points`), a table with one row per voter and option holding the points, a check that the points add up to exactly 100, and a voter screen with +/- steppers and a running total. Results show the average points per option.
2. **Quiz.** Questions have a right answer, a timer and a leaderboard. Voters currently answer at their own pace, so a quiz needs a presenter-paced mode first: the presenter moves everyone to the same question, and phones follow along through the status poll. This is the biggest change.

Follow-ups for the types already built:

- Open answers show up on the presenter's screen as they arrive, with no way to hide one. Add a hide button for the owner before using them in big rooms. Audience Q&A already has one (`app/api/admin/sessions/[code]/qa`); reuse that pattern.
- Pick several has no "at least N" setting. Add one if presenters ask for it.
- Audience Q&A: each person can send up to 3 questions (`MAX_QA_PER_VOTER`). Voters' phones read the list from `/api/qa/[code]`, which the CDN caches for 3 seconds, so a phone shows its own question and vote straight away and the server count catches up (`qaVoterView` in `lib/answers.ts`).

How each type is built, so a new one follows the same pattern: kind check and settings columns in `db/schema.sql` (idempotent, at the end); kinds and answer schemas in `lib/validation.ts`; charts in `lib/charts.ts`; labels in `lib/kinds.ts`; save, results, exports, reset and edit counts in `lib/queries.ts`; maths in `lib/answers.ts`; the voter card in `components/vote/`; the results view in `components/results/`; tests in `test/question-types.test.ts`, `test/qa.test.ts` and `test/answers-view.test.ts`. Write the tests first.
