/**
 * Finishing is final: once a phone has reached the finish screen, the questions it answered are locked, so the big
 * screen doesn't shift while the presenter talks through it (owner's call, 2026-11-21). Questions added later can
 * still be answered. Q&A stays open (asking and upvoting new questions is the point of it) and a quiz answer is
 * already one-shot on the server. Kept on the phone only: the server still accepts changes until voting closes.
 */
import type { QuestionKind } from "./types";

export const endedKey = (code: string) => `liverate:ended:${code}`;

export function lockedStep(kind: QuestionKind, done: boolean, ended: boolean): boolean {
  return ended && done && kind !== "qa" && kind !== "quiz";
}
