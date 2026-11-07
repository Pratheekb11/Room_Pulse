import type { QuestionKind } from "./types";
import { kindLabel } from "./kinds";

// Scripts for the "Show me how" walkthrough: a pretend cursor makes one question in a mock builder,
// a phone answers it, and the results appear. Each step is a full snapshot, so any step can be shown on its own.

export type DemoScreen = "builder" | "phone" | "results";
/** What the pretend cursor points at (and clicks) in this step. */
export type DemoTarget = "kind" | "question" | "items" | "scale" | "correct" | "create" | "answer" | "start" | null;

export interface DemoState {
  screen: DemoScreen;
  kind: QuestionKind;
  question: string;
  items: string[];
  /** Score items: highest score (1 to 5 or 1 to 10). */
  scale: 5 | 10;
  /** Quiz: the right answer. */
  correct: string | null;
  /** Quiz: the presenter has started the question. */
  started: boolean;
  /** What the phone tapped or typed. */
  picked: string | null;
  /** Results: one number per item (average score, votes, or word count). */
  results: number[];
}

export interface DemoStep {
  caption: string;
  target: DemoTarget;
  state: DemoState;
}

export interface DemoScenario {
  kind: QuestionKind;
  label: string;
  steps: DemoStep[];
}

type Patch = { caption: string; target: DemoTarget } & Partial<DemoState>;

function script(kind: QuestionKind, patches: Patch[]): DemoScenario {
  let state: DemoState = { screen: "builder", kind, question: "", items: [], scale: 5, correct: null, started: false, picked: null, results: [] };
  const steps = patches.map(({ caption, target, ...patch }) => {
    state = { ...state, ...patch };
    return { caption, target, state };
  });
  return { kind, label: kindLabel(kind), steps };
}

export const DEMOS: DemoScenario[] = [
  script("rating", [
    { caption: "Pick “Score items” as the question type.", target: "kind" },
    { caption: "Type your question.", target: "question", question: "Which idea should we build next?" },
    { caption: "Add the items people will score.", target: "items", items: ["Dark mode", "Offline mode", "Faster search"] },
    { caption: "Want scores from 1 to 10 instead of 1 to 5? Tap it here.", target: "scale", scale: 10 },
    { caption: "Create it. You get a QR code to show the room.", target: "create" },
    { caption: "People scan the code and tap a score on their phone.", target: "answer", screen: "phone", picked: "Dark mode" },
    { caption: "Scores show up on your screen straight away.", target: null, screen: "results", results: [8.4, 6.1, 7.2] },
  ]),
  script("poll", [
    { caption: "Pick “Pick one” as the question type.", target: "kind" },
    { caption: "Type your question.", target: "question", question: "Where should we have lunch?" },
    { caption: "Add the options people choose from.", target: "items", items: ["Pizza", "Sushi", "Tacos"] },
    { caption: "Create it. You get a QR code to show the room.", target: "create" },
    { caption: "People tap one option on their phone.", target: "answer", screen: "phone", picked: "Sushi" },
    { caption: "Votes fill the chart as they come in.", target: null, screen: "results", results: [9, 14, 6] },
  ]),
  script("words", [
    { caption: "Pick “Word cloud” as the question type.", target: "kind" },
    { caption: "Type your question.", target: "question", question: "One word for this week?" },
    { caption: "Create it. You get a QR code to show the room.", target: "create" },
    { caption: "People type up to 3 words on their phone.", target: "answer", screen: "phone", picked: "Busy" },
    {
      caption: "Popular words show up bigger.",
      target: null,
      screen: "results",
      items: ["Busy", "Fun", "Productive", "Tired", "Calm"],
      results: [12, 8, 6, 4, 3],
    },
  ]),
  script("quiz", [
    { caption: "Pick “Quiz” as the question type.", target: "kind" },
    { caption: "Type your question.", target: "question", question: "What is the capital of Australia?" },
    { caption: "Add the answers to choose from.", target: "items", items: ["Sydney", "Canberra", "Melbourne"] },
    { caption: "Tap the right answer.", target: "correct", correct: "Canberra" },
    { caption: "Create it. You get a QR code to show the room.", target: "create" },
    { caption: "On your results screen, start the question when you're ready.", target: "start", screen: "results", started: true },
    { caption: "Everyone's phone jumps to it. Fast right answers score more.", target: "answer", screen: "phone", picked: "Canberra" },
    { caption: "When time is up, the right answer and top players show.", target: null, screen: "results", results: [4, 17, 3] },
  ]),
];
