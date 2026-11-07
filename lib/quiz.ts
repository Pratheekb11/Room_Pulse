import type { LiveQuiz } from "./types";

/** Server time minus phone time, in ms, from a status read the phone received at `receivedAt`. */
export const clockOffset = (serverNow: string, receivedAt: number): number => Date.parse(serverNow) - receivedAt;

/** Milliseconds left to answer, in server time; 0 once time is up. */
export const quizTimeLeft = (live: LiveQuiz, phoneNow: number, offset: number): number =>
  Math.max(0, Date.parse(live.endsAt) - (phoneNow + offset));
