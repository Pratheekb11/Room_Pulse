/** Pure helpers behind the one-input-per-row list editor (options, topics, criteria). */

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

export function setAt(list: string[], index: number, value: string): string[] {
  return list.map((v, i) => (i === index ? value : v));
}

/** Adds an empty row after `index`; unchanged when the list is full. */
export function insertAfter(list: string[], index: number, max: number): string[] {
  if (list.length >= max) return list;
  return [...list.slice(0, index + 1), "", ...list.slice(index + 1)];
}

/** Removes a row; the editor always keeps one (empty) row to type into. */
export function removeAt(list: string[], index: number): string[] {
  const next = list.filter((_, i) => i !== index);
  return next.length ? next : [""];
}

export function moveItem(list: string[], index: number, by: -1 | 1): string[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * A paste with several lines (e.g. copied from a doc or spreadsheet) becomes one row per line,
 * starting at the row being edited. Returns null for a single line so the input pastes normally.
 */
export function pasteInto(
  list: string[],
  index: number,
  text: string,
  max: number,
): { items: string[]; focus: number; dropped: number } | null {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  if (lines.length < 2) return null;
  const before = list.slice(0, index);
  const after = list.slice(index + 1);
  const room = Math.max(0, max - before.length - after.length);
  const fit = lines.slice(0, room);
  return { items: [...before, ...fit, ...after], focus: index + fit.length - 1, dropped: lines.length - fit.length };
}

/** The rows that will actually be saved. */
export function filledItems(list: string[]): string[] {
  return list.map(clean).filter(Boolean);
}

/** Rows that repeat an earlier row (case and spacing ignored); the server would drop them. */
export function duplicateIndexes(list: string[]): Set<number> {
  const seen = new Set<string>();
  const dupes = new Set<number>();
  list.forEach((raw, i) => {
    const key = clean(raw).toLowerCase();
    if (!key) return;
    if (seen.has(key)) dupes.add(i);
    else seen.add(key);
  });
  return dupes;
}

/** Rows from a saved draft; older drafts stored one item per line in a single string. */
export function toItems(value: string[] | string | undefined): string[] {
  const items = typeof value === "string" ? filledItems(value.split(/\r?\n/)) : (value ?? []);
  return items.length ? items : [""];
}
