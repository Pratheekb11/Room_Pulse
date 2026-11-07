// Shapes returned by the public API. Safe to import from client components.

export interface SessionInfo {
  code: string;
  title: string;
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  isOpen: boolean;
  /** Bumped whenever the presenter edits the questions. */
  revision: number;
}

export interface NamedItem {
  id: string;
  name: string;
}

export type QuestionKind = "rating" | "poll" | "words" | "multi" | "text" | "rank" | "number" | "qa";

export interface FocusItem extends NamedItem {
  kind: QuestionKind;
  /** Chart the dashboard opens on (see CHARTS in lib/charts.ts). */
  chart: string;
  /** Pick several: most options one person may pick (null = any number). */
  maxPicks?: number | null;
  /** Number questions: allowed range and an optional unit like "%" or "users". */
  min?: number | null;
  max?: number | null;
  unit?: string | null;
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

/** How many people put an option in a place (1 = first) of a ranking question. */
export interface RankCount {
  focusId: string;
  topicId: string;
  rank: number;
  n: number;
}

/** How many people answered a number question with this exact value. */
export interface NumberCount {
  focusId: string;
  value: number;
  n: number;
}

/** An audience question as voters see it: no voter id, never hidden ones. */
export interface PublicQaItem {
  id: string;
  focusId: string;
  text: string;
  votes: number;
  answered: boolean;
  /** ISO time it was asked. */
  at: string;
}

/** An audience question on the presenter's screen, hidden ones included (flagged). */
export interface QaItem extends PublicQaItem {
  hidden: boolean;
}

export interface TextAnswer {
  focusId: string;
  text: string;
  /** ISO time of the latest change. */
  at: string;
}

/** People who answered a question (pick several, open answer, ranking, number). */
export interface RespondentCount {
  focusId: string;
  n: number;
}

export interface ResultsPayload {
  isOpen: boolean;
  voterCount: number;
  cells: ResultCell[];
  dist: ScoreBucket[];
  /** Poll and pick-several choices. */
  polls: PollCount[];
  words: WordCount[];
  ranks: RankCount[];
  numbers: NumberCount[];
  /** Newest first, up to 200 per question. */
  texts: TextAnswer[];
  respondents: RespondentCount[];
  /** Audience Q&A questions, newest first, up to 200 per question. */
  questions: QaItem[];
  /** Bumped whenever the presenter edits the questions. */
  revision: number;
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
  /** Secret for the presenter's results link (#k=…). */
  dashboardKey: string;
}
