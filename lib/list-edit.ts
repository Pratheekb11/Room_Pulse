import { PRESETS } from "./presets";

/**
 * Pure helpers behind the one-field-per-row list editor (poll options, things to rate, rating scales).
 * They work on plain strings or on rows that remember which saved item they are (`id`), so editing
 * a presentation keeps the answers of items that were renamed or moved.
 */

/** `description`: optional words under the item; undefined = no description box open. */
export type Row = { id?: string; name: string; description?: string };
type Item = string | Row;

const clean = (s: string) => s.trim().replace(/\s+/g, " ");
const nameOf = (x: Item) => (typeof x === "string" ? x : x.name);
function withName<T extends Item>(x: T, name: string): T {
  return (typeof x === "string" ? name : { ...(x as Row), name }) as T;
}
/** A new, empty row of the same shape as the list's rows. */
function blankLike<T extends Item>(list: T[], name = ""): T {
  return (typeof list[0] === "object" ? { name } : name) as T;
}

export function setAt<T extends Item>(list: T[], index: number, value: string): T[] {
  return list.map((v, i) => (i === index ? withName(v, value) : v));
}

/** Adds an empty row after `index`; unchanged when the list is full. */
export function insertAfter<T extends Item>(list: T[], index: number, max: number): T[] {
  if (list.length >= max) return list;
  return [...list.slice(0, index + 1), blankLike(list), ...list.slice(index + 1)];
}

/** Removes a row; the editor always keeps one (empty) row to type into. */
export function removeAt<T extends Item>(list: T[], index: number): T[] {
  const next = list.filter((_, i) => i !== index);
  return next.length ? next : [blankLike(list)];
}

export function moveItem<T extends Item>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/**
 * A paste with several lines (e.g. copied from a doc or spreadsheet) becomes one row per line,
 * starting at the row being edited (which keeps its id). Returns null for a single line so the
 * input pastes normally.
 */
export function pasteInto<T extends Item>(
  list: T[],
  index: number,
  text: string,
  max: number,
): { items: T[]; focus: number; dropped: number } | null {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  if (lines.length < 2) return null;
  const before = list.slice(0, index);
  const after = list.slice(index + 1);
  const room = Math.max(0, max - before.length - after.length);
  const fit = lines.slice(0, room).map((line, i) => (i === 0 && list[index] !== undefined ? withName(list[index], line) : blankLike(list, line)));
  return { items: [...before, ...fit, ...after], focus: index + fit.length - 1, dropped: lines.length - fit.length };
}

/** The names that will actually be saved. */
export function filledItems(list: Item[]): string[] {
  return list.map((x) => clean(nameOf(x))).filter(Boolean);
}

/** The rows that will actually be saved, with cleaned names and their ids. */
export function filledRows(list: Row[]): Row[] {
  return list.map((r) => ({ ...r, name: clean(r.name) })).filter((r) => r.name);
}

/** Rows that repeat an earlier row (case and spacing ignored). */
export function duplicateIndexes(list: Item[]): Set<number> {
  const seen = new Set<string>();
  const dupes = new Set<number>();
  list.forEach((raw, i) => {
    const key = clean(nameOf(raw)).toLowerCase();
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

/** Editable rows from saved items (or from a draft's plain strings); always at least one row. */
export function rowsFrom(items: (Row | { id?: string; name: string; description?: string | null } | string)[] | string | undefined): Row[] {
  const list = typeof items === "string" ? toItems(items) : (items ?? []);
  const rows = list.map((x): Row => {
    if (typeof x === "string") return { name: x };
    const row: Row = x.id ? { id: x.id, name: x.name } : { name: x.name };
    if (x.description) row.description = x.description;
    return row;
  });
  const kept = rows.filter((r) => r.id || r.name);
  return kept.length ? kept : [{ name: "" }];
}

/** Filled descriptions by item name, for saving (`itemDescriptions`). */
export function descriptionsOf(rows: Row[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const name = clean(r.name);
    const d = r.description?.trim();
    if (name && d) out[name] = d;
  }
  return out;
}

/**
 * Rows to keep when a question switches to `kind`: a shortcut's ready-made answers (e.g. Yes / No / Not sure)
 * don't make sense as items to score, so Score items starts empty again; anything typed is kept.
 * Always at least `minRows` rows.
 */
export function rowsForKind(rows: Row[], kind: string, minRows: number): Row[] {
  const names = filledItems(rows).map((n) => n.toLowerCase());
  const fromShortcut = PRESETS.some((p) => p.options.length === names.length && p.options.every((o, i) => o.toLowerCase() === names[i]));
  const kept = kind === "rating" && fromShortcut ? [] : rows;
  return kept.length >= minRows ? kept : [...kept, ...Array.from({ length: minRows - kept.length }, () => ({ name: "" }))];
}
