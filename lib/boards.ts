// Boards: an open answer question shown as a picture that fills up as people answer
// (leaves on a tree, sticky notes on a wall, stars in a sky) instead of a list.
// Used by the team activities (lib/activities.ts).

export const BOARD_IDS = ["tree", "wall", "sky"] as const;
export type BoardId = (typeof BOARD_IDS)[number];

export interface BoardInfo {
  id: BoardId;
  label: string;
  /** What one answer becomes, for the phone ("Write your leaf"). */
  piece: string;
  /** Short line in the builder. */
  blurb: string;
}

export const BOARDS: BoardInfo[] = [
  { id: "tree", label: "Tree", piece: "leaf", blurb: "Each answer grows a leaf on a tree" },
  { id: "wall", label: "Sticky notes", piece: "note", blurb: "Each answer is a sticky note on a wall" },
  { id: "sky", label: "Night sky", piece: "star", blurb: "Each answer lights up a star" },
];

export const isBoard = (v: unknown): v is BoardId => typeof v === "string" && (BOARD_IDS as readonly string[]).includes(v);
export const boardInfo = (id: BoardId) => BOARDS.find((b) => b.id === id)!;

/** Longest name someone may sign their answer with. */
export const MAX_AUTHOR = 30;

/** Leaves per layer of the tree; more than this start a second layer between the first. */
const CAP = 60;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
// R2 low-discrepancy sequence: evenly spread points that never move as more arrive.
const G = 1.324717957244746;
const A1 = 1 / G;
const A2 = 1 / (G * G);
const frac = (n: number) => n - Math.floor(n);

/**
 * Where the answer that arrived `index`-th (0 = first) sits, as 0..1 across and down the board's
 * fill area. Depends only on the index, so earlier answers never move when new ones come in.
 */
export function boardSpot(board: BoardId, index: number): { x: number; y: number } {
  if (board === "tree") {
    // Sunflower spiral: a full, round canopy filling from the middle out.
    const layer = Math.floor(index / CAP);
    const j = index % CAP;
    const r = Math.sqrt((j + 0.5) / CAP);
    const a = j * GOLDEN + layer * (GOLDEN / 2);
    return { x: 0.5 + 0.5 * r * Math.cos(a), y: 0.5 + 0.5 * r * Math.sin(a) };
  }
  const m = 0.04;
  return { x: m + (1 - 2 * m) * frac(0.5 + A1 * (index + 1)), y: m + (1 - 2 * m) * frac(0.5 + A2 * (index + 1)) };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A small tilt in degrees (−12…12), the same for an answer every time. */
export function leafTilt(id: string): number {
  return (hash(id) % 25) - 12;
}

/** Which of `n` colours an answer gets, the same every time. */
export function pieceShade(id: string, n: number): number {
  return hash(`${id}:shade`) % n;
}

/** Answers in the order they arrived (first first), so each keeps its spot. */
export function arrivalOrder<T extends { at: string; id: string; created?: string }>(texts: T[]): T[] {
  const when = (t: T) => t.created ?? t.at;
  return [...texts].sort((a, b) => (when(a) === when(b) ? a.id.localeCompare(b.id) : when(a) < when(b) ? -1 : 1));
}
