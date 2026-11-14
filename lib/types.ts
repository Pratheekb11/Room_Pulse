import type { BoardId } from "./boards";
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
  /** Slide design id (lib/themes.ts). */
  theme: string;
  /** Fun illustrations are on. */
  decor: boolean;
}

export interface NamedItem {
  id: string;
  name: string;
}

export type QuestionKind = "rating" | "poll" | "words" | "multi" | "text" | "rank" | "number" | "qa" | "quiz";

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
  /** Quiz: seconds to answer. */
  seconds?: number | null;
  /** Optional extra words under the question. */
  description?: string | null;
  /** Picture shown with the question (lib/images.ts). */
  imageId?: string | null;
  /** Quiz: index of the right option. Only in the owner's copy, never sent to voters. */
  correct?: number | null;
  /** Open answers: shown as a board (lib/boards.ts); null = a plain list. */
  board?: BoardId | null;
}

export interface TopicItem extends NamedItem {
  /** Optional words under the item on phones. */
  description?: string | null;
  /** Picture of the option or item. */
  imageId?: string | null;
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

/** The quiz question running now, as every phone sees it. */
export interface LiveQuiz {
  focusId: string;
  startedAt: string;
  endsAt: string;
  seconds: number;
  /** Server time when this was read, so phones can correct for a wrong clock. */
  now: string;
  /** The right option, only once time is up. */
  correctTopicId: string | null;
}

export interface SessionStatus {
  isOpen: boolean;
  revision: number;
  /** The owner lets voters see live results on their phones. */
  showResults: boolean;
  /** The owner lets people raise open points from their phones. */
  openPoints: boolean;
  quiz: LiveQuiz | null;
}

export type PointStatus = "open" | "doing" | "closed";

/** An open point on the presenter's list. Never carries a voter id. */
export interface OpenPoint {
  id: string;
  /** #1, #2, … within the presentation; never reused. */
  number: number;
  title: string;
  /** audience = raised from a phone, presenter = typed by the owner, result / ai = made from a suggestion. */
  source: "audience" | "presenter" | "result" | "ai";
  originKey: string | null;
  /** The question it belongs to, if any. */
  focusId: string | null;
  /** The name the person gave when raising it (optional). */
  raisedBy: string | null;
  status: PointStatus;
  assignee: string | null;
  /** YYYY-MM-DD */
  due: string | null;
  /** Progress or closing note; the person who raised the point can read it. */
  note: string | null;
  createdAt: string;
  closedAt: string | null;
  /** Name of the question it belongs to (from the server's list). */
  question?: string | null;
}

/** An open point as the person who raised it sees it on their phone. */
export interface MyOpenPoint {
  id: string;
  number: number;
  text: string;
  status: PointStatus;
  note: string | null;
  at: string;
}

export interface QuizCount {
  focusId: string;
  topicId: string;
  n: number;
}

export interface LeaderRow {
  nickname: string;
  points: number;
  /** Right answers. */
  correct: number;
}

/** One player's own quiz score; answers only for questions whose time is up. */
export interface QuizMe {
  nickname: string | null;
  points: number;
  rank: number | null;
  players: number;
  answers: { focusId: string; topicId: string; correct: boolean; points: number }[];
}

export interface TextAnswer {
  /** Names the answer for hiding; never the voter. */
  id: string;
  focusId: string;
  /** Hidden by the owner: kept in results and exports, never on the big screen. */
  hidden: boolean;
  text: string;
  /** Board questions: the name the answer is signed with; null = unsigned. */
  author?: string | null;
  /** ISO time of the latest change. */
  at: string;
  /** ISO time it was first sent: a board keeps each answer in its spot by this. */
  created?: string;
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
  /** Quiz: how many picked each option. */
  quizCounts: QuizCount[];
  /** Quiz: right answers of questions already played (none while a question runs). */
  quizRevealed: { focusId: string; topicId: string }[];
  /** Quiz: top 10 players. */
  leaderboard: LeaderRow[];
  /** Quiz: the question running now. */
  quiz: LiveQuiz | null;
  /** Bumped whenever the presenter edits the questions. */
  revision: number;
  /** Open points not closed yet (0 on voters' phones). */
  openPoints?: number;
}

/** The AI's summary of a whole presentation (saved; the latest one is kept). */
export interface AiReport {
  headline: string;
  summary: string;
  /** One insight per question the AI had something to say about. */
  questions: { focusId: string; insight: string }[];
  /** Suggested next steps. */
  actions: string[];
  /** People who had answered when it was written. */
  people: number;
  /** ISO time it was written. */
  at: string;
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
  /** Voters can see live results on their phones. */
  showResults: boolean;
  /** AI insights are on (accounts only). */
  aiEnabled: boolean;
  /** People may raise open points from their phones. */
  openPoints: boolean;
}
