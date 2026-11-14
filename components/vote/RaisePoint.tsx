"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ToBody } from "../Portal";
import { MAX_POINT_NAME, MAX_POINT_TEXT, MAX_POINTS_PER_VOTER, statusLabel } from "@/lib/points";
import type { MyOpenPoint, PointStatus } from "@/lib/types";

const ERRORS: Record<string, string> = {
  limit: `You've raised ${MAX_POINTS_PER_VOTER} open points, the most one person can.`,
  closed: "Voting is closed, so new open points can't be sent.",
  points_off: "The presenter has turned open points off.",
};

const CHIP: Record<PointStatus, string> = {
  open: "bg-sun text-ink",
  doing: "border border-line-strong bg-white text-ink",
  closed: "bg-mint text-ink",
};

/**
 * "Raise an open point": something the presenter should follow up after the session.
 * Opens a full-screen sheet to write it (name optional) and shows the person's own points with their status.
 */
export function RaisePoint({ code, voterId, className = "" }: { code: string; voterId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-xl border border-dashed border-line-strong bg-white px-4 py-3 text-left text-[0.95rem] font-bold ${className}`}
      >
        Raise an open point
        <span className="block text-sm font-normal text-ink-soft">Something to follow up after this session? Tell the presenter.</span>
      </button>
      {open && <Sheet code={code} voterId={voterId} onClose={() => setOpen(false)} />}
    </>
  );
}

function Sheet({ code, voterId, onClose }: { code: string; voterId: string; onClose: () => void }) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [points, setPoints] = useState<MyOpenPoint[] | null>(null);
  const base = `/api/points/${encodeURIComponent(code)}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${base}/me?voter=${encodeURIComponent(voterId)}`, { cache: "no-store" });
      if (res.ok) setPoints(((await res.json()) as { points: MyOpenPoint[] }).points);
    } catch {
      /* offline: keep what's shown */
    }
  }, [base, voterId]);

  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    box.current?.focus();
    const first = setTimeout(() => void load(), 0);
    // the presenter may close a point while this is open
    const timer = setInterval(() => void load(), 15_000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close.current();
    };
    window.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId, text, name: name.trim() || null }),
      });
      const body = (await res.json().catch(() => ({}))) as { number?: number; error?: string };
      if (!res.ok) {
        setError(ERRORS[body.error ?? ""] ?? "That didn't send. Check your connection and try again.");
        return;
      }
      setSent(body.number ?? null);
      setText("");
      void load();
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const full = (points?.length ?? 0) >= MAX_POINTS_PER_VOTER;

  return (
    <ToBody>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="fixed inset-0 z-50 flex flex-col bg-canvas text-ink">
        <div className="flex items-center justify-between gap-3 border-b border-line-strong px-4 py-3">
          <h2 id={`${id}-title`} className="font-display text-xl font-semibold">
            Raise an open point
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-sm font-bold">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-5">
            <form onSubmit={send} className="slab rounded-xl bg-white p-4">
              <label htmlFor={`${id}-text`} className="block font-semibold">
                What needs following up?
              </label>
              <p id={`${id}-hint`} className="text-sm text-ink-soft">
                The presenter gets it on their list, gives it to someone and tracks it until it&rsquo;s closed.
              </p>
              <textarea
                ref={box}
                id={`${id}-text`}
                aria-describedby={`${id}-hint`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={MAX_POINT_TEXT}
                rows={3}
                disabled={full}
                placeholder="e.g. The test server is down most mornings"
                className="mt-2 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-base"
              />
              <p className="text-right text-xs tabular-nums text-ink-soft">
                {text.length}/{MAX_POINT_TEXT}
              </p>
              <label htmlFor={`${id}-name`} className="mt-1 block text-sm font-semibold">
                Your name <span className="font-normal text-ink-soft">(optional: leave it empty to stay anonymous)</span>
              </label>
              <input
                id={`${id}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_POINT_NAME}
                disabled={full}
                autoComplete="name"
                className="mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-base"
              />
              <button type="submit" disabled={busy || full || !text.trim()} className="key mt-3 w-full rounded-lg bg-ink py-3 font-bold text-white disabled:opacity-50">
                {busy ? "Sending…" : "Send to the presenter"}
              </button>
              <div aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold">
                {error ? (
                  <p className="text-error">{error}</p>
                ) : sent !== null ? (
                  <p className="text-success">Sent. It&rsquo;s number {sent} on the presenter&rsquo;s list.</p>
                ) : full ? (
                  <p className="text-ink-soft">{ERRORS.limit}</p>
                ) : null}
              </div>
            </form>

            {points && points.length > 0 && (
              <section aria-labelledby={`${id}-mine`}>
                <h3 id={`${id}-mine`} className="font-display text-lg font-semibold">
                  Your open points
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {points.map((p) => (
                    <li key={p.id} className="rounded-xl border border-line-strong bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-semibold break-words">
                          <span className="text-ink-soft tabular-nums">#{p.number}</span> {p.text}
                        </p>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${CHIP[p.status]}`}>
                          {p.status === "closed" ? "✓ " : ""}
                          {statusLabel(p.status)}
                        </span>
                      </div>
                      {p.note && <p className="mt-1.5 rounded-lg bg-canvas px-3 py-2 text-sm break-words">{p.note}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </ToBody>
  );
}
