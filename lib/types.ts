// Shapes returned by the public API. Safe to import from client components.

export interface SessionInfo {
  code: string;
  title: string;
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  isOpen: boolean;
}

export interface NamedItem {
  id: string;
  name: string;
}

export type QuestionKind = "rating" | "poll" | "words";

export interface FocusItem extends NamedItem {
  kind: QuestionKind;
  /** Chart the dashboard opens on (see CHARTS in lib/charts.ts). */
  chart: string;
}

export interface TopicItem extends NamedItem {
  /** null only for sessions created before focus topics existed */
  focusId: string | null;
}

export interface SessionPayload {
  session: SessionInfo;
  focusTopics: FocusItem[];
  topics: TopicItem[];
  criteria: NamedItem[];
}

export interface ResultCell {
  topicId: string;
  criterionId: string;
  n: number;
  sum: number;
}

/** How many ratings of each score a topic × criterion received. */
export interface ScoreBucket {
  topicId: string;
  criterionId: string;
  score: number;
  n: number;
}

export interface PollCount {
  focusId: string;
  topicId: string;
  n: number;
}

export interface WordCount {
  focusId: string;
  word: string;
  n: number;
}

export interface ResultsPayload {
  isOpen: boolean;
  voterCount: number;
  cells: ResultCell[];
  dist: ScoreBucket[];
  polls: PollCount[];
  words: WordCount[];
}

export interface AdminSessionRow {
  code: string;
  title: string;
  isOpen: boolean;
  createdAt: string;
  /** Guest presentations are deleted at this time; null = kept. */
  expiresAt: string | null;
  focusCount: number;
  topicCount: number;
  criterionCount: number;
  voterCount: number;
  totalVotes: number;
}
