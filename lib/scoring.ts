import type { QuestionKind } from "./types";

/**
 * Scores (1 to N, what 1 and N mean, what to score on) are shared by every Score items question.
 * The builder shows those settings inside the first Score items question; this returns its key.
 */
export function scoringHost(questions: { key: number; kind: QuestionKind }[]): number | null {
  return questions.find((q) => q.kind === "rating")?.key ?? null;
}
