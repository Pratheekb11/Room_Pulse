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

export interface SessionPayload {
  session: SessionInfo;
  topics: NamedItem[];
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

export interface ResultsPayload {
  isOpen: boolean;
  voterCount: number;
  cells: ResultCell[];
  dist: ScoreBucket[];
}

export interface AdminSessionRow {
  code: string;
  title: string;
  isOpen: boolean;
  createdAt: string;
  topicCount: number;
  criterionCount: number;
  voterCount: number;
  totalVotes: number;
}
