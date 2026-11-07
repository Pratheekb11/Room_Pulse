import type { QuestionKind } from "./types";

/** One-tap starting points in the builder: a question type with its options filled in. */
export interface Preset {
  id: string;
  label: string;
  kind: QuestionKind;
  options: string[];
}

export const PRESETS: Preset[] = [{ id: "yes-no", label: "Yes / No / Not sure", kind: "poll", options: ["Yes", "No", "Not sure"] }];

/** The preset a question still matches exactly (blank rows ignored), or null once it's been changed. */
export function matchingPreset(kind: QuestionKind, options: string[]): Preset | null {
  const filled = options.map((o) => o.trim()).filter(Boolean);
  return (
    PRESETS.find((p) => p.kind === kind && p.options.length === filled.length && p.options.every((o, i) => o === filled[i])) ?? null
  );
}
