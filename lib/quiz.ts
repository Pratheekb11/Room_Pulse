import type { LiveQuiz } from "./types";

/** Server time minus phone time, in ms, from a status read the phone received at `receivedAt`. */
export const clockOffset = (serverNow: string, receivedAt: number): number => Date.parse(serverNow) - receivedAt;

/** Milliseconds left to answer, in server time; 0 once time is up. */
export const quizTimeLeft = (live: LiveQuiz, phoneNow: number, offset: number): number =>
  Math.max(0, Date.parse(live.endsAt) - (phoneNow + offset));

/** A tap on Start that the presenter's screen shows before the server confirms it. */
export type PendingStart = { focusId: string; at: number };

/** The server's running round is the one this tap started (allowing 5 s of clock and network slack). */
export const quizStartConfirmed = (pending: PendingStart, live: LiveQuiz | null, offset: number): boolean =>
  live !== null && live.focusId === pending.focusId && Date.parse(live.startedAt) >= pending.at + offset - 5000;

export type QuizOwnerAction = "end" | "next" | "again" | "start";

/** The main button on the presenter's quiz screen. */
export function quizOwnerAction(s: { running: boolean; ended: boolean; total: number; hasNext: boolean }): QuizOwnerAction {
  if (s.running) return "end";
  if (s.ended && s.hasNext) return "next";
  return s.total > 0 ? "again" : "start";
}
