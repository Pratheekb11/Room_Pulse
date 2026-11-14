// Open points (an open point list): things to follow up after the poll. Safe to import from client components.
import type { OpenPoint, PointStatus } from "./types";

/** Open points one person may raise from their phone in a presentation. */
export const MAX_POINTS_PER_VOTER = 5;
export const MAX_POINT_TEXT = 200;
export const MAX_POINT_NAME = 40;
export const MAX_POINT_ASSIGNEE = 60;
export const MAX_POINT_NOTE = 500;

export const POINT_STATUSES: { id: PointStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "doing", label: "In progress" },
  { id: "closed", label: "Closed" },
];
export const statusLabel = (s: PointStatus) => POINT_STATUSES.find((x) => x.id === s)?.label ?? s;

/** Where a point came from, as the list and the export say it. */
export const SOURCE_LABELS: Record<OpenPoint["source"], string> = {
  audience: "Audience",
  presenter: "Presenter",
  result: "Results",
  ai: "AI suggestion",
};

/** How many points are in each state; `active` = not closed yet. */
export function pointCounts(points: { status: PointStatus }[]): { open: number; doing: number; closed: number; active: number } {
  const n = { open: 0, doing: 0, closed: 0 };
  for (const p of points) n[p.status] += 1;
  return { ...n, active: n.open + n.doing };
}

/** Points still to do first (by number), closed ones after them. */
export function sortPoints<T extends { number: number; status: PointStatus }>(points: T[]): T[] {
  return [...points].sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed") || a.number - b.number);
}

/** Key that marks a point as made from an AI suggestion, so the same suggestion is offered once. */
export const aiOriginKey = (text: string) => `ai:${text.trim().replace(/\s+/g, " ").toLowerCase()}`.slice(0, 120);

/** True when the due date (YYYY-MM-DD) has passed and the point isn't closed. */
export function isOverdue(p: { due: string | null; status: PointStatus }, today: string): boolean {
  return p.status !== "closed" && p.due !== null && p.due < today;
}
