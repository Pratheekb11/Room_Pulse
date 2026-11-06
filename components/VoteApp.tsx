"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { topicColor } from "@/lib/colors";
import { cellKey } from "@/lib/stats";
import { getVoterId, readJSON, writeJSON } from "@/lib/storage";
import type { SessionPayload } from "@/lib/types";
import { VoteQueue, type SaveStatus } from "@/lib/vote-queue";
import { Confetti } from "./Confetti";
import { Logo } from "./Logo";
import { CenteredMessage, LoadingScreen } from "./StatusScreens";
import { TopicCard } from "./TopicCard";
import { useSession } from "./useSession";

export function VoteApp({ code }: { code: string }) {
  const state = useSession(code);
  if (state.kind === "loading") return <LoadingScreen label="Loading session" />;
  if (state.kind === "not_found")
    return <CenteredMessage title="Session not found" body={`There's no session with the code “${code}”. Check the code on the screen and try again.`} />;
  if (state.kind === "error")
    return <CenteredMessage title="Can't reach the session" body="Check your connection. Trying again automatically…" link={false} />;
  return <Ballot code={code} data={state.data} />;
}

const STATUS_POLL_MS = 10_000;

function Ballot({ code, data }: { code: string; data: SessionPayload }) {
  const { session, topics, criteria } = data;
  const ratingsKey = `liverate:ratings:${code}`;
  const pendingKey = `liverate:pending:${code}`;

  // Only valid cells for this session, so stale storage can't inflate progress.
  const validKeys = useMemo(() => {
    const s = new Set<string>();
    for (const t of topics) for (const c of criteria) s.add(cellKey(t.id, c.id));
    return s;
  }, [topics, criteria]);

  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const stored = readJSON<Record<string, number>>(ratingsKey, {});
    return Object.fromEntries(
      Object.entries(stored).filter(([k, v]) => validKeys.has(k) && Number.isInteger(v) && v >= 1 && v <= session.scaleMax),
    );
  });
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [isOpen, setIsOpen] = useState(session.isOpen);

  const [queue] = useState(
    () =>
      new VoteQueue({
        code,
        voterId: getVoterId(code),
        initialPending: Object.fromEntries(
          Object.entries(readJSON<Record<string, number>>(pendingKey, {})).filter(([k]) => validKeys.has(k)),
        ),
        onStatus: (key, status) => setStatuses((s) => (s[key] === status ? s : { ...s, [key]: status })),
        onClosed: () => setIsOpen(false),
        persistPending: (pending) => writeJSON(pendingKey, pending),
      }),
  );

  useEffect(() => {
    queue.setOpen(session.isOpen);
    queue.start();
    return () => queue.stop();
  }, [queue, session.isOpen]);

  useEffect(() => {
    queue.setOpen(isOpen);
  }, [queue, isOpen]);

  // Poll open/closed state while the tab is visible (served from the CDN cache).
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const check = async () => {
      try {
        const res = await fetch(`/api/session/${encodeURIComponent(code)}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { isOpen: boolean };
        setIsOpen(body.isOpen);
      } catch {
        /* offline: try again next tick */
      }
    };
    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(check, STATUS_POLL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void check();
        startPolling();
      } else if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code]);

  const onRate = useCallback(
    (topicId: string, criterionId: string, score: number) => {
      const key = cellKey(topicId, criterionId);
      setRatings((r) => {
        const next = { ...r, [key]: score };
        writeJSON(ratingsKey, next);
        return next;
      });
      queue.set(key, score);
    },
    [queue, ratingsKey],
  );

  const total = validKeys.size;
  const done = Object.keys(ratings).length;
  const complete = total > 0 && done === total;

  // Confetti only when the voter finishes during this visit, not on reload.
  const wasComplete = useRef(complete);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2400);
      wasComplete.current = true;
      return () => clearTimeout(t);
    }
    wasComplete.current = complete;
  }, [complete]);

  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-dvh pb-16">
      {celebrate && <Confetti />}

      <header className="mx-auto max-w-xl px-4 pt-5">
        <Logo />
        <h1 className="font-display mt-5 text-[clamp(1.9rem,8vw,2.6rem)] font-extrabold leading-[1.02] tracking-tight break-words">
          {session.title}
        </h1>
        <p className="mt-2 text-[0.95rem] text-ink-soft">
          Tap a number to rate. It saves instantly. Anonymous — no names collected.
        </p>
      </header>

      <div className="sticky top-0 z-20 mt-4 border-b-2 border-ink bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <div
            className="h-4 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
            aria-label="Ratings completed"
          >
            <div className="h-full rounded-full bg-violet transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-display shrink-0 text-base font-bold tabular-nums">
            {done} / {total} rated
          </span>
        </div>
      </div>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-5">
        {!isOpen && (
          <div role="status" className="slab rounded-2xl bg-sun px-5 py-4">
            <p className="font-display text-xl font-extrabold">Voting is closed</p>
            <p className="text-sm font-medium">Your saved ratings are kept. The presenter can reopen voting.</p>
          </div>
        )}

        {complete && (
          <div role="status" className="slab rounded-2xl bg-mint px-5 py-4 text-ink">
            <p className="font-display text-xl font-extrabold">All done — thank you!</p>
            <p className="text-sm font-medium">You can change any rating until voting closes.</p>
          </div>
        )}

        {topics.length === 0 || criteria.length === 0 ? (
          <p className="text-ink-soft">This session has nothing to rate yet.</p>
        ) : (
          topics.map((t, i) => (
            <TopicCard
              key={t.id}
              topic={t}
              index={i}
              total={topics.length}
              color={topicColor(i)}
              criteria={criteria}
              session={session}
              ratings={ratings}
              statuses={statuses}
              disabled={!isOpen}
              onRate={onRate}
            />
          ))
        )}
      </main>
    </div>
  );
}
