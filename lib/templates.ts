import type { QuestionKind } from "./types";

/** One question of a ready-made (or AI-drafted) presentation. */
export interface QuestionPlan {
  kind: QuestionKind;
  name: string;
  /** Options, for the types that have them. */
  options?: string[];
  /** Number questions. */
  min?: number;
  max?: number;
  unit?: string;
}

export interface PresentationPlan {
  title: string;
  questions: QuestionPlan[];
}

export interface Template {
  id: string;
  label: string;
  /** Who it's for, shown under the label. */
  blurb: string;
  plan: PresentationPlan;
}

export const TEMPLATES: Template[] = [
  {
    id: "retro",
    label: "Sprint retro",
    blurb: "Mood, what went well, what didn't, what to try",
    plan: {
      title: "Sprint retro",
      questions: [
        { kind: "poll", name: "How did this sprint feel?", options: ["Great", "Good", "Okay", "Rough"] },
        { kind: "text", name: "What went well?" },
        { kind: "text", name: "What didn't go well?" },
        { kind: "text", name: "What should we try next sprint?" },
      ],
    },
  },
  {
    id: "standup",
    label: "Standup check-in",
    blurb: "How everyone feels and what's blocking them",
    plan: {
      title: "Standup check-in",
      questions: [
        { kind: "words", name: "One word for how you're feeling today?" },
        { kind: "poll", name: "How's your work going?", options: ["On track", "A bit behind", "Blocked"] },
        { kind: "text", name: "Anything blocking you?" },
      ],
    },
  },
  {
    id: "icebreaker",
    label: "Meetup icebreaker",
    blurb: "Who's here, and questions for the speakers",
    plan: {
      title: "Welcome to the meetup",
      questions: [
        { kind: "words", name: "Where are you joining from?" },
        { kind: "poll", name: "How many of our meetups have you been to?", options: ["This is my first", "2 to 5", "More than 5"] },
        { kind: "multi", name: "What would you like more of?", options: ["Talks", "Workshops", "Networking", "Demos"] },
        { kind: "qa", name: "What would you like to ask the speakers?" },
      ],
    },
  },
  {
    id: "feedback",
    label: "Event feedback",
    blurb: "Score, best part and what to change",
    plan: {
      title: "How was it?",
      questions: [
        { kind: "number", name: "How likely are you to recommend this to a friend?", min: 0, max: 10 },
        { kind: "text", name: "What was the best part?" },
        { kind: "text", name: "What should we do differently next time?" },
      ],
    },
  },
];

const WITH_OPTIONS: QuestionKind[] = ["rating", "poll", "multi", "rank", "quiz"];

/** The create-presentation request body for a plan (rating questions get Impact / Effort to score on). */
export function planToBody(plan: PresentationPlan) {
  const hasRating = plan.questions.some((q) => q.kind === "rating");
  return {
    title: plan.title,
    focusTopics: plan.questions.map((q) => ({
      name: q.name,
      kind: q.kind,
      topics: WITH_OPTIONS.includes(q.kind) ? (q.options ?? []) : [],
      ...(q.kind === "number" ? { min: q.min ?? 0, max: q.max ?? 100, unit: q.unit ?? null } : {}),
      ...(q.kind === "quiz" ? { correct: q.options?.[0] ?? null } : {}),
    })),
    criteria: hasRating ? ["Impact", "Effort"] : [],
  };
}
