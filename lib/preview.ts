import { hasOptions } from "./validation";
import type { QuestionKind, TopicItem } from "./types";

// Sample data for the builder's preview, so a presentation can be seen before anyone answers.

/** Votes per option: varied, never all equal, the same on every render. */
export function sampleCounts(n: number): number[] {
  const pattern = [12, 7, 9, 4, 6, 3, 5, 2, 8, 1];
  return Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
}

const FALLBACK_WORDS = ["focused", "curious", "tired", "excited", "calm", "busy", "happy", "hopeful"];

/** Sample word-cloud words: a few from the question itself, padded with everyday ones. */
export function sampleWords(question: string): { word: string; n: number; weight: number }[] {
  const own = question
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3)
    .slice(0, 2);
  const words = [...new Set([...own, ...FALLBACK_WORDS])].slice(0, 8);
  const counts = sampleCounts(words.length).sort((a, b) => b - a);
  const max = counts[0];
  const min = counts[counts.length - 1];
  return words.map((word, i) => ({ word, n: counts[i], weight: max === min ? 1 : (counts[i] - min) / (max - min) }));
}

export interface PreviewQuestion {
  kind: QuestionKind;
  name: string;
  options: TopicItem[];
  min?: number;
  max?: number;
  unit?: string | null;
  maxPicks?: number | null;
  description?: string | null;
}

/** Builder drafts as preview slides: blank names and option lists get placeholders. */
export function previewQuestions(
  drafts: { kind: QuestionKind; name: string; options: string[]; min?: number; max?: number; unit?: string | null; maxPicks?: number | null; description?: string | null }[],
): PreviewQuestion[] {
  return drafts.map((d, i) => {
    const focusId = `preview-${i}`;
    let names = hasOptions(d.kind) ? d.options.map((o) => o.trim()).filter(Boolean) : [];
    if (hasOptions(d.kind) && names.length < (d.kind === "rating" ? 1 : 2)) names = ["Option A", "Option B"];
    return {
      ...d,
      name: d.name.trim() || `Question ${i + 1}`,
      options: names.map((name, j) => ({ id: `${focusId}-${j}`, name, focusId })),
    };
  });
}
