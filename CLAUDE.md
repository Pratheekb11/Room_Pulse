# LiveRate

Project instructions are in AGENTS.md (read it first: this Next.js version has breaking changes).

Build test-first: write a failing test, then the code. Check every screen at 390px wide as well as on desktop.

## Not finished

### More question types — planned, not built yet

LiveRate has 7 question types: Score items (`rating`), Pick one (`poll`), Pick several (`multi`), Put in order (`rank`), Number (`number`), Open answer (`text`) and Word cloud (`words`). These are still to build, cheapest first:

1. **Yes / No / Not sure.** A preset Pick one question with those 3 options filled in, so making one takes a single tap. It needs only a builder shortcut, with no new kind or table.
2. **Split 100 points.** Voters spread 100 points across the options to show priority. This needs a new kind (`points`), a table with one row per voter and option holding the points, a check that the points add up to exactly 100, and a voter screen with +/- steppers and a running total. Results show the average points per option.
3. **Audience Q&A.** Voters send in questions and upvote other people's. The presenter can hide a question or mark it answered, and the list re-sorts live. This needs a moderation API that only the owner can use, one upvote per voter, and a dashboard list sorted by votes.
4. **Quiz.** Questions have a right answer, a timer and a leaderboard. Voters currently answer at their own pace, so a quiz needs a presenter-paced mode first: the presenter moves everyone to the same question, and phones follow along through the status poll. This is the biggest change.

Follow-ups for the types already built:

- Open answers show up on the presenter's screen as they arrive, with no way to hide one. Add a hide button for the owner before using them in big rooms.
- Pick several has no "at least N" setting. Add one if presenters ask for it.

How each type is built, so a new one follows the same pattern: kind check and settings columns in `db/schema.sql` (idempotent, at the end); kinds and answer schemas in `lib/validation.ts`; charts in `lib/charts.ts`; labels in `lib/kinds.ts`; save, results, exports, reset and edit counts in `lib/queries.ts`; maths in `lib/answers.ts`; the voter card in `components/vote/`; the results view in `components/results/`; tests in `test/question-types.test.ts` and `test/answers-view.test.ts`. Write the tests first.
