"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { apiFetch } from "../admin/api";
import type { Agg } from "@/lib/stats";
import type { FocusGroup } from "@/lib/focus";
import { resultSignals, type Signal } from "@/lib/signals";
import { isOverdue, MAX_POINT_ASSIGNEE, MAX_POINT_NOTE, MAX_POINT_TEXT, pointCounts, POINT_STATUSES, sortPoints, SOURCE_LABELS } from "@/lib/points";
import { readJSON, writeJSON } from "@/lib/storage";
import type { NamedItem, OpenPoint, PointStatus, ResultsPayload } from "@/lib/types";

// The presenter's open point list ("OPL"): things to follow up after the poll, each given to someone
// and tracked until it's closed. Points come from people's phones, from the presenter, from results
// that call for action (lib/signals.ts) and from AI suggestions.

export interface PointsState {
  /** null until the first load. */
  points: OpenPoint[] | null;
  /** Results that call for a follow-up and aren't on the list or dismissed yet. */
  signals: Signal[];
  reload: () => Promise<void>;
  /** Adds a point; false when it couldn't be added (already there, or the request failed). */
  add: (body: Record<string, unknown>) => Promise<boolean>;
  dismiss: (key: string) => void;
}

/** Owner only: loads the list (again every 10 seconds) and works out which results still call for a point. */
export function useOpenPoints(
  code: string,
  isOwner: boolean,
  input: { groups: FocusGroup[]; criteria: NamedItem[]; cells: Map<string, Agg>; histograms: Map<string, number[]>; results: ResultsPayload; scaleMax: number },
): PointsState {
  const [points, setPoints] = useState<OpenPoint[] | null>(null);
  const dismissedKey = `liverate:signals:${code}`;
  const [dismissed, setDismissed] = useState<string[]>(() => readJSON<string[]>(dismissedKey, []));
  const base = `/api/admin/sessions/${encodeURIComponent(code)}/points`;

  const reload = useCallback(async () => {
    try {
      const res = await fetch(base, { cache: "no-store", credentials: "same-origin" });
      if (res.ok) setPoints(((await res.json()) as { points: OpenPoint[] }).points);
    } catch {
      /* offline: keep what's shown */
    }
  }, [base]);

  useEffect(() => {
    if (!isOwner) return;
    const first = setTimeout(() => void reload(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [isOwner, reload]);

  const add = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        await apiFetch(base, { method: "POST", body: JSON.stringify(body) });
        await reload();
        return true;
      } catch {
        await reload();
        return false;
      }
    },
    [base, reload],
  );

  const dismiss = useCallback(
    (key: string) =>
      setDismissed((list) => {
        const next = [...new Set([...list, key])].slice(-200);
        writeJSON(dismissedKey, next);
        return next;
      }),
    [dismissedKey],
  );

  const { groups, criteria, cells, histograms, results, scaleMax } = input;
  const signals = useMemo(() => {
    if (!isOwner || points === null) return [];
    const taken = new Set([...points.map((p) => p.originKey), ...dismissed]);
    return resultSignals(groups, criteria, cells, histograms, results, scaleMax).filter((s) => !taken.has(s.key));
  }, [isOwner, points, dismissed, groups, criteria, cells, histograms, results, scaleMax]);

  return { points: isOwner ? points : null, signals, reload, add, dismiss };
}

const field = "rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-base";
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the presenter's time zone
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Filter = "todo" | "all" | "closed";

export function OpenPoints({ code, state, groups, onClose }: { code: string; state: PointsState; groups: FocusGroup[]; onClose: () => void }) {
  const id = useId();
  const base = `/api/admin/sessions/${encodeURIComponent(code)}`;
  const { points, signals, reload, add, dismiss } = state;
  const [filter, setFilter] = useState<Filter>("todo");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  // Whether phones may raise points: read once, then changed here.
  const [raise, setRaise] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/session/${encodeURIComponent(code)}/status`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { openPoints?: boolean } | null) => {
        if (!cancelled && body) setRaise(body.openPoints === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function call(run: () => Promise<unknown>) {
    setError(null);
    try {
      await run();
    } catch (err) {
      setError((err as Error).message);
    }
    await reload();
  }
  const change = (pointId: string, body: Record<string, unknown>) =>
    call(() => apiFetch(`${base}/points`, { method: "PATCH", body: JSON.stringify({ id: pointId, ...body }) }));
  const remove = (pointId: string) => call(() => apiFetch(`${base}/points`, { method: "DELETE", body: JSON.stringify({ id: pointId }) }));

  async function toggleRaise() {
    const next = !raise;
    setRaise(next);
    try {
      await apiFetch(base, { method: "PATCH", body: JSON.stringify({ openPoints: next }) });
    } catch (err) {
      setRaise(!next);
      setError((err as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    const ok = await add({ title, assignee: assignee.trim() || null, due: due || null });
    setBusy(false);
    if (!ok) return setError("That open point couldn't be added. Try again.");
    setTitle("");
    setAssignee("");
    setDue("");
  }

  const all = points ?? [];
  const counts = pointCounts(all);
  const shown = sortPoints(all).filter((p) => (filter === "all" ? true : filter === "closed" ? p.status === "closed" : p.status !== "closed"));
  const people = [...new Set(all.map((p) => p.assignee).filter((a): a is string => Boolean(a)))].sort();
  const questionName = (focusId: string | null) => (focusId ? (groups.find((g) => g.focus.id === focusId)?.focus.name ?? null) : null);
  const FILTERS: { id: Filter; label: string }[] = [
    { id: "todo", label: `To do (${counts.active})` },
    { id: "closed", label: `Closed (${counts.closed})` },
    { id: "all", label: `All (${all.length})` },
  ];

  return (
    <section aria-labelledby={`${id}-h`} className="slab @container rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="font-display text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-tight">
            Open points
          </h2>
          <p className="max-w-[60ch] text-[clamp(0.9rem,1.1vw,1.2rem)] text-ink-soft">
            What needs following up after this session. Give each one to someone and close it when it&rsquo;s done.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <a href={`${base}/export?type=points`} className="rounded-full border border-line-strong bg-white px-3 py-1 hover:bg-canvas">
            Download the list
          </a>
          <button type="button" onClick={onClose} className="rounded-full border border-line-strong bg-white px-3 py-1 hover:bg-canvas">
            Back to results
          </button>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-canvas p-3">
        <input type="checkbox" checked={raise === true} disabled={raise === null} onChange={() => void toggleRaise()} className="mt-1 size-5 shrink-0 accent-primary" />
        <span>
          <span className="block font-semibold">Let people raise open points from their phones</span>
          <span className="block text-sm text-ink-soft">
            They get a &ldquo;Raise an open point&rdquo; button, can add their name if they like, and see when theirs is closed.
          </span>
        </span>
      </label>

      <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-2 @2xl:grid-cols-[minmax(0,1fr)_11rem_10.5rem_auto] @2xl:items-end">
        <label className="block text-sm font-semibold">
          Add an open point
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MAX_POINT_TEXT} placeholder="e.g. Order a second test server" className={`${field} mt-1 w-full`} />
        </label>
        <label className="block text-sm font-semibold">
          Assigned to
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} maxLength={MAX_POINT_ASSIGNEE} list={`${id}-people`} placeholder="Name" className={`${field} mt-1 w-full`} />
        </label>
        <label className="block text-sm font-semibold">
          Due
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} mt-1 w-full`} />
        </label>
        <button type="submit" disabled={busy || !title.trim()} className="rounded-lg bg-ink px-4 py-2 font-bold text-white disabled:opacity-50">
          {busy ? "Adding…" : "Add"}
        </button>
      </form>
      <datalist id={`${id}-people`}>
        {people.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-error">
          {error}
        </p>
      )}

      {signals.length > 0 && (
        <section aria-labelledby={`${id}-signals`} className="mt-5 rounded-xl border border-dashed border-line-strong bg-sun/40 p-3">
          <h3 id={`${id}-signals`} className="font-display text-[clamp(1.1rem,1.4vw,1.6rem)] font-semibold">
            The results suggest {signals.length === 1 ? "a follow-up" : `${signals.length} follow-ups`}
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {signals.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-white p-3">
                <div className="min-w-0 flex-[1_1_16rem]">
                  <p className="font-bold break-words">{s.title}</p>
                  <p className="text-sm text-ink-soft break-words">{s.reason}</p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => void add({ title: s.title, source: "result", originKey: s.key, focusId: s.focusId })}
                    className="rounded-lg bg-ink px-3 py-1.5 text-white"
                  >
                    Add to open points
                  </button>
                  <button type="button" onClick={() => dismiss(s.key)} className="rounded-lg border border-line-strong bg-white px-3 py-1.5" aria-label={`Dismiss: ${s.title}`}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Show open points" className="flex max-w-full flex-wrap gap-0.5 rounded-[1.1rem] border border-line-strong bg-white p-0.5 text-sm font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              type="button"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 whitespace-nowrap tabular-nums ${filter === f.id ? "bg-ink text-white" : "hover:bg-canvas"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-ink-soft tabular-nums">
          {counts.open} open · {counts.doing} in progress · {counts.closed} closed
        </p>
      </div>

      {points === null ? (
        <p className="mt-4 text-ink-soft">Loading the list…</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-[clamp(1rem,1.2vw,1.3rem)] text-ink-soft">
          {all.length === 0
            ? "Nothing here yet. Add the first open point above, or let people raise them from their phones."
            : filter === "closed"
              ? "Nothing is closed yet."
              : "Everything is closed. Nice work."}
        </p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2.5" aria-label="Open points">
          {shown.map((p) => (
            <PointRow key={p.id} p={p} people={`${id}-people`} question={questionName(p.focusId)} onChange={(body) => change(p.id, body)} onDelete={() => remove(p.id)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function PointRow({
  p,
  people,
  question,
  onChange,
  onDelete,
}: {
  p: OpenPoint;
  /** id of the datalist of people already assigned something. */
  people: string;
  question: string | null;
  onChange: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const overdue = isOverdue(p, today());
  const from = p.source === "audience" ? (p.raisedBy ? `Raised by ${p.raisedBy}` : "Raised from a phone") : p.source === "presenter" ? "Added by you" : `From: ${SOURCE_LABELS[p.source]}`;
  const closed = p.status === "closed";
  /** Saves a text field when it's left, if it changed. */
  const saveOnBlur = (key: "assignee" | "note" | "title", was: string | null) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const now = e.target.value.trim();
    if (now === (was ?? "")) return;
    if (key === "title" && !now) return;
    void onChange({ [key]: now || null });
  };

  return (
    <li className={`rounded-xl border border-line-strong p-3 ${closed ? "bg-canvas" : "bg-white"}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="font-display flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-white px-1.5 font-semibold tabular-nums" aria-label={`Open point ${p.number}`}>
          {p.number}
        </span>
        <div className="min-w-0 flex-[1_1_18rem]">
          {editing ? (
            <input
              autoFocus
              defaultValue={p.title}
              maxLength={MAX_POINT_TEXT}
              aria-label={`Wording of open point ${p.number}`}
              onBlur={(e) => {
                saveOnBlur("title", p.title)(e);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className={`${field} w-full font-bold`}
            />
          ) : (
            <p className={`text-[clamp(1rem,1.25vw,1.4rem)] font-bold leading-snug break-words ${closed ? "text-ink-soft line-through" : ""}`}>{p.title}</p>
          )}
          <p className="mt-0.5 text-sm text-ink-soft break-words">
            {from}
            {question ? ` · ${question}` : ""} · {shortDate(p.createdAt)}
            {p.closedAt ? ` · closed ${shortDate(p.closedAt)}` : ""}
            {overdue && <span className="ml-2 rounded-full bg-error px-2 py-0.5 text-xs font-bold text-white">Overdue</span>}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 @2xl:flex @2xl:w-auto @2xl:items-end">
          <label className="col-span-2 block text-xs font-semibold text-ink-soft">
            Assigned to
            <input
              key={p.assignee ?? ""}
              defaultValue={p.assignee ?? ""}
              maxLength={MAX_POINT_ASSIGNEE}
              list={people}
              placeholder="Nobody yet"
              onBlur={saveOnBlur("assignee", p.assignee)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className={`${field} mt-0.5 block w-full text-ink @2xl:w-[11rem]`}
            />
          </label>
          <label className="block text-xs font-semibold text-ink-soft">
            Due
            <input
              type="date"
              value={p.due ?? ""}
              onChange={(e) => void onChange({ due: e.target.value || null })}
              className={`${field} mt-0.5 block w-full text-ink @2xl:w-[10.5rem] ${overdue ? "border-error" : ""}`}
            />
          </label>
          <label className="block text-xs font-semibold text-ink-soft">
            Status
            <select
              value={p.status}
              onChange={(e) => void onChange({ status: e.target.value as PointStatus })}
              className={`${field} mt-0.5 block w-full font-semibold text-ink @2xl:w-[9.5rem] ${closed ? "bg-mint" : p.status === "doing" ? "bg-sun" : ""}`}
            >
              {POINT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        <label htmlFor={`${id}-note`} className="min-w-0 flex-[1_1_16rem] text-xs font-semibold text-ink-soft">
          Note {p.source === "audience" && <span className="font-normal">(the person who raised it can read this)</span>}
          <textarea
            id={`${id}-note`}
            key={p.note ?? ""}
            defaultValue={p.note ?? ""}
            maxLength={MAX_POINT_NOTE}
            rows={1}
            placeholder={closed ? "How it was closed" : "Progress, or what was decided"}
            onBlur={saveOnBlur("note", p.note)}
            className={`${field} mt-0.5 block w-full text-sm text-ink`}
          />
        </label>
        <div className="flex gap-2 text-sm font-semibold">
          {confirming ? (
            <>
              <button type="button" onClick={() => void onDelete()} className="rounded-lg bg-error px-3 py-1.5 font-bold text-white">
                Delete for good
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-line-strong bg-white px-3 py-1.5">
                Keep
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-line-strong bg-white px-3 py-1.5" aria-label={`Reword open point ${p.number}`}>
                Reword
              </button>
              <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-line-strong bg-white px-3 py-1.5" aria-label={`Delete open point ${p.number}`}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
