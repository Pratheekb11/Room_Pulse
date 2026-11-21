/**
 * Finishing is final (owner's call, 2026-11-21): answers changing after people finish made the big screen shift
 * while the presenter talked it through. While answering, people can change or clear any answer ("Clear answer").
 * Tapping Finish locks every question answered so far, and from then on those have no controls. Questions added
 * later can still be answered (and need Finish again). Q&A stays open (asking and upvoting new questions is the
 * point of it) and a quiz answer is already one-shot on the server, so neither locks.
 *
 * Kept on the phone (`liverate:ended:<code>`: the ids locked, a Score items item's id or the question's id).
 * The server still takes changes until voting closes.
 */
import type { QuestionKind } from "./types";

export const endedKey = (code: string) => `liverate:ended:${code}`;

export const lockable = (kind: QuestionKind): boolean => kind !== "qa" && kind !== "quiz";

export function lockedStep(kind: QuestionKind, id: string, lockedIds: readonly string[]): boolean {
  return lockable(kind) && lockedIds.includes(id);
}

/** The stored list, whatever is in storage. */
export function readLocked(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
