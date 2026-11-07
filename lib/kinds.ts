import type { QuestionKind } from "./types";

/** Plain-language names for each question type, in the order the builder offers them. */
export const KIND_INFO: { id: QuestionKind; label: string; hint: string }[] = [
  { id: "rating", label: "Score items", hint: "People give each item a score, like 1 to 5." },
  { id: "poll", label: "Pick one", hint: "People pick one option." },
  { id: "multi", label: "Pick several", hint: "People pick as many options as you allow." },
  { id: "rank", label: "Put in order", hint: "People put the options in order, best first." },
  { id: "number", label: "Number", hint: "People answer with a number, like a guess or an estimate." },
  { id: "text", label: "Open answer", hint: "People write a short answer in their own words." },
  { id: "qa", label: "Audience Q&A", hint: "People send in questions and vote for the ones they want answered." },
  { id: "words", label: "Word cloud", hint: "People type up to 3 words. Popular words show bigger." },
];

export const kindLabel = (kind: QuestionKind) => KIND_INFO.find((k) => k.id === kind)?.label ?? kind;
