"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { topicColor } from "@/lib/colors";
import { cellKey } from "@/lib/stats";
import { groupByFocus } from "@/lib/focus";
import { getVoterId, readJSON, writeJSON } from "@/lib/storage";
import type { SessionPayload, TopicItem } from "@/lib/types";
import { VoteQueue, type SaveStatus } from "@/lib/vote-queue";
import { Confetti } from "./Confetti";
import { Logo } from "./Logo";
import { CenteredMessage, LoadingScreen } from "./StatusScreens";
import { TopicCard } from "./TopicCard";
import { PollCard } from "./PollCard";
import { WordsCard } from "./WordsCard";
import { useSession } from "./useSession";

export function VoteApp({ code }: { code: string }) {
  // Set when the status poll sees the presenter changed the questions; reloads them.
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const state = useSession(code, revision);
  if (state.kind === "loading") return <LoadingScreen label="Loading questions" />;
  if (state.kind === "not_found")
    return <CenteredMessage title="We can't find that code" body={`There's no presentation with the code “${code}”. Check the code on the screen and try again.`} />;
  if (state.kind === "error")
    return <CenteredMessage title="No connection" body="Check your internet. We'll keep trying on our own." link={false} />;
  // A new revision remounts the ballot: answers live in storage, so they carry over to the new questions.
  return <Ballot key={state.data.session.revision} code={code} data={state.data} onRevision={setRevision} />;
}

const STATUS_POLL_MS = 10_000;

type Answer = string | string[]; // poll: chosen option id; word cloud: list of words

type Step =
  | { kind: "rating"; gi: number; item: TopicItem; index: number }
  | { kind: "poll" | "words"; gi: number };

function Ballot({ code, data, onRevision }: { code: string; data: SessionPayload; onRevision: (revision: number) => void }) {
  const { session, topics, criteria } = data;
  const ratingsKey = `liverate:ratings:${code}`;
  const pendingKey = `liverate:pending:${code}`;
  const answersKey = `liverate:answers:${code}`;
  const answersPendingKey = `liverate:answers-pending:${code}`;

  const groups = useMemo(() => groupByFocus(data.focusTopics ?? [], topics), [data.focusTopics, topics]);

  // Only valid keys for this session, so stale storage can't inflate progress or send junk.
  const validKeys = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) if (g.kind === "rating") for (const t of g.topics) for (const c of criteria) s.add(cellKey(t.item.id, c.id));
    return s;
  }, [groups, criteria]);
  const validAnswer = useMemo(() => {
    const byFocus = new Map(groups.filter((g) => g.kind !== "rating").map((g) => [g.focus.id, g]));
    return (focusId: string, v: unknown): v is Answer => {
      const g = byFocus.get(focusId);
      if (!g) return false;
      if (g.kind === "poll") return typeof v === "string" && g.topics.some((t) => t.item.id === v);
      return Array.isArray(v) && v.length <= 3 && v.every((w) => typeof w === "string");
    };
  }, [groups]);

  const [ratings, setRatings] = useState<Record<string, number>>(() => {
    const stored = readJSON<Record<string, number>>(ratingsKey, {});
    return Object.fromEntries(
      Object.entries(stored).filter(([k, v]) => validKeys.has(k) && Number.isInteger(v) && v >= 1 && v <= session.scaleMax),
    );
  });
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(Object.entries(readJSON<Record<string, unknown>>(answersKey, {})).filter(([k, v]) => validAnswer(k, v))) as Record<
      string,
      Answer
    >,
  );
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  // Word clouds count as done at 3 answers, or when the voter says "that's all".
  const finishedKey = `liverate:finished:${code}`;
  const [finished, setFinished] = useState<string[]>(() => readJSON<string[]>(finishedKey, []));
  const [isOpen, setIsOpen] = useState(session.isOpen);

  const onStatus = useCallback(
    (key: string, status: SaveStatus) => setStatuses((s) => (s[key] === status ? s : { ...s, [key]: status })),
    [],
  );

  const [voterId] = useState(() => getVoterId(code));
  const [queue] = useState(
    () =>
      new VoteQueue({
        code,
        voterId,
        initialPending: Object.fromEntries(
          Object.entries(readJSON<Record<string, number>>(pendingKey, {})).filter(([k]) => validKeys.has(k)),
        ),
        onStatus,
        onClosed: () => setIsOpen(false),
        persistPending: (pending) => writeJSON(pendingKey, pending),
      }),
  );
  const [answerQueue] = useState(
    () =>
      new VoteQueue<Answer>({
        code,
        voterId,
        endpoint: "/api/answer",
        toBody: (focusId, v) =>
          typeof v === "string" ? { kind: "poll", focusId, topicId: v } : { kind: "words", focusId, words: v },
        initialPending: Object.fromEntries(
          Object.entries(readJSON<Record<string, unknown>>(answersPendingKey, {})).filter(([k, v]) => validAnswer(k, v)),
        ) as Record<string, Answer>,
        onStatus,
        onClosed: () => setIsOpen(false),
        persistPending: (pending) => writeJSON(answersPendingKey, pending),
      }),
  );

  useEffect(() => {
    for (const q of [queue, answerQueue] as const) {
      q.setOpen(session.isOpen);
      q.start();
    }
    return () => {
      queue.stop();
      answerQueue.stop();
    };
  }, [queue, answerQueue, session.isOpen]);

  useEffect(() => {
    queue.setOpen(isOpen);
    answerQueue.setOpen(isOpen);
  }, [queue, answerQueue, isOpen]);

  // Poll open/closed state while the tab is visible (served from the CDN cache).
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const check = async () => {
      try {
        const res = await fetch(`/api/session/${encodeURIComponent(code)}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { isOpen: boolean; revision?: number };
        setIsOpen(body.isOpen);
        if (typeof body.revision === "number" && body.revision !== session.revision) onRevision(body.revision);
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
  }, [code, session.revision, onRevision]);

  // ---- steps: one screen per rated topic, one per poll, one per word cloud
  const steps: Step[] = useMemo(
    () =>
      groups.flatMap((g, gi): Step[] =>
        g.kind === "rating" ? g.topics.map((t) => ({ kind: "rating", gi, item: t.item, index: t.index })) : [{ kind: g.kind, gi }],
      ),
    [groups],
  );

  const stepDone = useCallback(
    (step: Step, r: Record<string, number>, a: Record<string, Answer>) => {
      if (step.kind === "rating") return criteria.every((c) => r[cellKey(step.item.id, c.id)] !== undefined);
      const v = a[groups[step.gi].focus.id];
      if (step.kind === "poll") return typeof v === "string";
      return Array.isArray(v) && (v.length >= 3 || (v.length > 0 && finished.includes(groups[step.gi].focus.id)));
    },
    [criteria, groups, finished],
  );

  const unitsTotal = validKeys.size + steps.filter((s) => s.kind !== "rating").length;
  const unitsDone =
    Object.keys(ratings).length + steps.filter((s) => s.kind !== "rating" && stepDone(s, ratings, answers)).length;
  const complete = unitsTotal > 0 && unitsDone === unitsTotal;
  const points = unitsDone * 10;

  const [current, setCurrent] = useState(() => {
    const i = steps.findIndex((s) => !stepDone(s, ratings, answers));
    return i === -1 ? 0 : i;
  });
  const [direction, setDirection] = useState<1 | -1>(1);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAdvance = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };
  useEffect(() => cancelAdvance, []);

  const goTo = useCallback(
    (i: number) => {
      cancelAdvance();
      setCurrent((c) => {
        setDirection(i >= c ? 1 : -1);
        return Math.max(0, Math.min(steps.length - 1, i));
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [steps.length],
  );

  /** After a step is finished: celebrate a finished focus topic, then move to the next open step. */
  const afterChange = useCallback(
    (stepIndex: number, r: Record<string, number>, a: Record<string, Answer>, wasDone: boolean, autoAdvance: boolean) => {
      const step = steps[stepIndex];
      if (wasDone || !stepDone(step, r, a)) return;
      const gi = step.gi;
      if (groups.length > 1 && steps.every((s) => s.gi !== gi || stepDone(s, r, a))) {
        setLevelUp(groups[gi].focus.name);
        setTimeout(() => setLevelUp(null), 1800);
      }
      if (!autoAdvance) return;
      const next = steps.findIndex((s, i) => i > stepIndex && !stepDone(s, r, a));
      const target = next !== -1 ? next : steps.findIndex((s) => !stepDone(s, r, a));
      if (target !== -1) {
        cancelAdvance();
        advanceTimer.current = setTimeout(() => goTo(target), 700);
      }
    },
    [steps, stepDone, groups, goTo],
  );

  // Reward loop: "+10" floats up on every answer; quick answers build a combo.
  const lastAnswerAt = useRef(0);
  const [combo, setCombo] = useState(0);
  const [plus, setPlus] = useState(0);
  const reward = useCallback(() => {
    const now = Date.now();
    setCombo((c) => (now - lastAnswerAt.current < 4000 ? c + 1 : 1));
    lastAnswerAt.current = now;
    setPlus((n) => n + 1);
  }, []);

  const onRate = useCallback(
    (topicId: string, criterionId: string, score: number) => {
      if (ratings[cellKey(topicId, criterionId)] === undefined) reward();
      const key = cellKey(topicId, criterionId);
      const next = { ...ratings, [key]: score };
      const i = steps.findIndex((s) => s.kind === "rating" && s.item.id === topicId);
      const wasDone = stepDone(steps[i], ratings, answers);
      setRatings(next);
      writeJSON(ratingsKey, next);
      queue.set(key, score);
      afterChange(i, next, answers, wasDone, true);
    },
    [ratings, answers, steps, stepDone, ratingsKey, queue, afterChange, reward],
  );

  const onAnswer = useCallback(
    (gi: number, value: Answer) => {
      const focusId = groups[gi].focus.id;
      if (answers[focusId] === undefined) reward();
      const next = { ...answers, [focusId]: value };
      const i = steps.findIndex((s) => s.kind !== "rating" && s.gi === gi);
      const wasDone = stepDone(steps[i], ratings, answers);
      setAnswers(next);
      writeJSON(answersKey, next);
      answerQueue.set(focusId, value);
      // Polls move on by themselves; word clouds wait so people can add more answers.
      afterChange(i, ratings, next, wasDone, steps[i].kind === "poll");
    },
    [answers, ratings, groups, steps, stepDone, answersKey, answerQueue, afterChange, reward],
  );

  const onFinishWords = useCallback(
    (gi: number) => {
      const focusId = groups[gi].focus.id;
      const i = steps.findIndex((s) => s.kind === "words" && s.gi === gi);
      const wasDone = stepDone(steps[i], ratings, answers);
      const next = [...new Set([...finished, focusId])];
      setFinished(next);
      writeJSON(finishedKey, next);
      // stepDone reads `finished`, so evaluate the next step with the updated list.
      const v = answers[focusId];
      if (!wasDone && Array.isArray(v) && v.length > 0) {
        const target = steps.findIndex((s, j) => j !== i && !stepDone(s, ratings, answers) && !(s.kind === "words" && next.includes(groups[s.gi].focus.id)));
        if (target !== -1) {
          cancelAdvance();
          advanceTimer.current = setTimeout(() => goTo(target), 450);
        }
      }
    },
    [groups, steps, stepDone, ratings, answers, finished, finishedKey, goTo],
  );

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

  const pct = unitsTotal ? Math.round((unitsDone / unitsTotal) * 100) : 0;
  const here = steps[current];
  const group = here ? groups[here.gi] : null;

  if (complete) return <ThankYou title={session.title} statuses={statuses} celebrate={celebrate} />;

  return (
    <div className="min-h-dvh pb-16">
      {(celebrate || levelUp) && <Confetti />}
      {levelUp && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="slab animate-pop rounded-xl bg-sun px-5 py-3 text-center">
            <p className="font-display text-xl font-semibold">Level complete!</p>
            <p className="text-sm font-semibold">{levelUp} is done</p>
          </div>
        </div>
      )}

      <header className="mx-auto max-w-xl px-4 pt-5">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="relative flex items-center gap-2">
            {combo >= 3 && (
              <span key={`combo-${combo}`} className="animate-pop rounded-full bg-lavender px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-ink uppercase">
                Combo ×{combo}
              </span>
            )}
            <span
              key={points}
              className="font-mono animate-pop rounded-full border border-line bg-white px-3 py-1 text-sm tabular-nums"
              aria-label={`${points} points`}
            >
              <span className="text-primary">★</span> {points}
            </span>
            {plus > 0 && (
              <span key={`plus-${plus}`} aria-hidden className="float-up font-mono absolute -top-1 right-1 text-sm font-medium text-primary">
                +10
              </span>
            )}
          </span>
        </div>
        <h1 className="font-display mt-4 text-[clamp(1.7rem,7vw,2.4rem)] font-semibold leading-[1.02] tracking-tight break-words">
          {session.title}
        </h1>
        <p className="mt-1.5 text-[0.95rem] text-ink-soft">
          Tap an answer. It saves straight away. Your answers are anonymous.
        </p>
      </header>

      <div className="sticky top-0 z-20 mt-4 border-b border-line-strong bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
        <div className="mx-auto max-w-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="h-4 flex-1 overflow-hidden rounded-full border border-line-strong bg-white"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={unitsTotal}
              aria-valuenow={unitsDone}
              aria-label="Answers completed"
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),#ff8a4c)] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-display shrink-0 text-base font-bold tabular-nums">
              {unitsDone} / {unitsTotal} done
            </span>
          </div>
          {groups.length > 1 && (
            <nav aria-label="Questions" className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {groups.map((g, gi) => {
                const own = steps.filter((s) => s.gi === gi);
                const doneHere = own.filter((s) => stepDone(s, ratings, answers)).length;
                const finished = doneHere === own.length;
                const active = here?.gi === gi;
                return (
                  <button
                    key={g.focus.id || "loose"}
                    type="button"
                    onClick={() => goTo(steps.findIndex((s) => s.gi === gi))}
                    aria-current={active ? "step" : undefined}
                    className={`shrink-0 rounded-full border border-line-strong px-3 py-1 text-xs font-bold whitespace-nowrap ${
                      active ? "bg-ink text-white" : finished ? "bg-mint" : "bg-white"
                    }`}
                  >
                    {finished ? "✓ " : ""}
                    {g.focus.name}
                    {!finished && own.length > 1 && <span className="opacity-70"> {doneHere}/{own.length}</span>}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-5">
        {!isOpen && (
          <div role="status" className="slab rounded-xl bg-sun px-5 py-4">
            <p className="font-display text-xl font-semibold">Voting is closed</p>
            <p className="text-sm font-medium">Your saved answers are kept. The presenter can reopen voting.</p>
          </div>
        )}

        {complete && (
          <div role="status" className="slab rounded-xl bg-mint px-5 py-4 text-ink">
            <p className="font-display text-xl font-semibold">All done — thank you! 🏆</p>
            <p className="text-sm font-medium">You can change any answer until voting closes.</p>
          </div>
        )}

        {!here || !group ? (
          <p className="text-ink-soft">There are no questions yet. Wait for the presenter to add some.</p>
        ) : (
          <>
            {groups.length > 1 && (
              <p className="text-sm font-bold text-ink-soft">
                Level {here.gi + 1} of {groups.length}
                {here.kind === "rating" ? `: ${group.focus.name}` : ""}
              </p>
            )}
            <div
              key={here.kind === "rating" ? here.item.id : group.focus.id}
              className={direction === 1 ? "animate-[slide-in-right_260ms_ease-out]" : "animate-[slide-in-left_260ms_ease-out]"}
            >
              {here.kind === "rating" ? (
                <TopicCard
                  topic={here.item}
                  index={group.topics.findIndex((t) => t.item.id === here.item.id)}
                  total={group.topics.length}
                  color={topicColor(here.index)}
                  criteria={criteria}
                  session={session}
                  ratings={ratings}
                  statuses={statuses}
                  disabled={!isOpen}
                  onRate={onRate}
                />
              ) : here.kind === "poll" ? (
                <PollCard
                  question={group.focus.name}
                  options={group.topics.map((t) => t.item)}
                  color={topicColor(here.gi)}
                  value={typeof answers[group.focus.id] === "string" ? (answers[group.focus.id] as string) : undefined}
                  status={statuses[group.focus.id]}
                  disabled={!isOpen}
                  onPick={(id) => onAnswer(here.gi, id)}
                />
              ) : (
                <WordsCard
                  question={group.focus.name}
                  color={topicColor(here.gi)}
                  value={Array.isArray(answers[group.focus.id]) ? (answers[group.focus.id] as string[]) : undefined}
                  status={statuses[group.focus.id]}
                  disabled={!isOpen}
                  finished={finished.includes(group.focus.id)}
                  onSend={(words) => onAnswer(here.gi, words)}
                  onFinish={() => onFinishWords(here.gi)}
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={current === 0}
                className="key shrink-0 rounded-lg bg-white px-3.5 py-2.5 font-bold whitespace-nowrap"
              >
                ← Back
              </button>
              {steps.length > 12 ? (
                <span className="font-display text-base font-bold tabular-nums text-ink-soft">
                  {current + 1} / {steps.length}
                </span>
              ) : (
              <div className="flex min-w-0 flex-wrap justify-center gap-1.5" aria-label="Steps">
                {steps.map((s, i) => {
                  const d = stepDone(s, ratings, answers);
                  const name = s.kind === "rating" ? s.item.name : groups[s.gi].focus.name;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Go to ${name}${d ? " (done)" : ""}`}
                      aria-current={i === current ? "step" : undefined}
                      className={`h-2.5 rounded-full border border-ink transition-all ${
                        i === current ? "w-6 bg-ink" : d ? "w-2.5 bg-mint" : "w-2.5 bg-white"
                      }`}
                    />
                  );
                })}
              </div>
              )}
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                disabled={current === steps.length - 1}
                className="key shrink-0 rounded-lg bg-primary px-3.5 py-2.5 font-bold whitespace-nowrap text-white"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** Shown once every question is answered: the ballot closes; saving status stays honest. */
function ThankYou({ title, statuses, celebrate }: { title: string; statuses: Record<string, SaveStatus>; celebrate: boolean }) {
  const values = Object.values(statuses);
  const saving = values.some((s) => s === "saving" || s === "retrying");
  const closed = values.some((s) => s === "closed");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {celebrate && <Confetti />}
      <svg viewBox="0 0 64 64" className="h-20 w-20" aria-hidden>
        <circle cx="32" cy="32" r="29" fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          className="origin-center -rotate-90 animate-[draw_700ms_var(--ease-out-soft)_both]"
        />
        <path d="M20 33l8 8 16-17" fill="none" stroke="var(--color-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray="100" className="animate-[draw_500ms_300ms_var(--ease-out-soft)_both]" />
      </svg>
      <h1 className="font-display animate-rise mt-8 text-[clamp(2.5rem,12vw,4rem)] leading-none text-ink [animation-delay:200ms]">Thank you.</h1>
      <p className="animate-rise mt-4 max-w-xs text-[17px] leading-relaxed text-ink-soft [animation-delay:320ms]">
        Your answers to <span className="text-ink">{title}</span> are in. You can close this page.
      </p>
      <p role="status" aria-live="polite" className="font-mono animate-fade mt-8 text-xs text-muted [animation-delay:600ms]">
        {closed ? (
          <span className="text-error">Voting closed before your last answer was saved.</span>
        ) : saving ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> Saving your last answers…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> All saved
          </span>
        )}
      </p>
    </main>
  );
}
