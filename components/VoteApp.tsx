"use client";

import { Credit } from "./Credit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { topicColor } from "@/lib/colors";
import { cellKey } from "@/lib/stats";
import { groupByFocus } from "@/lib/focus";
import { getVoterId, readJSON, writeJSON } from "@/lib/storage";
import type { LiveQuiz, QuestionKind, SessionPayload, TopicItem } from "@/lib/types";
import { ScorePill, StepIntro, StepNav, VoterHeader, VoterProgress } from "./VoterChrome";
import { VoteQueue, type SaveStatus } from "@/lib/vote-queue";
import { Confetti } from "./Confetti";
import { CenteredMessage, LoadingScreen } from "./StatusScreens";
import { TopicCard } from "./TopicCard";
import { PollCard } from "./PollCard";
import { WordsCard } from "./WordsCard";
import { MultiCard } from "./vote/MultiCard";
import { NumberCard } from "./vote/NumberCard";
import { RankCard } from "./vote/RankCard";
import { TextCard } from "./vote/TextCard";
import { QaCard } from "./vote/QaCard";
import { QuizCard } from "./vote/QuizCard";
import { clockOffset } from "@/lib/quiz";
import { useSession } from "./useSession";
import { useClientValue } from "./useClientValue";
import { useDocumentTheme } from "./useDocumentTheme";
import { Doodle } from "./Doodle";
import { RaisePoint } from "./vote/RaisePoint";
import { charactersFor, type Character } from "@/lib/decor";
import { MAX_AUTHOR } from "@/lib/boards";

/** The stored name to sign board answers with, or null for none. */
const signedName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, MAX_AUTHOR) : null);

export function VoteApp({ code, initial = null }: { code: string; initial?: SessionPayload | null }) {
  // Set when the status poll sees the presenter changed the questions; reloads them.
  const [revision, setRevision] = useState<number | undefined>(undefined);
  const state = useSession(code, revision, initial);
  // The ballot reads saved answers from this phone's storage, so it renders only in the browser.
  const inBrowser = useClientValue(() => true);
  useDocumentTheme(state.kind === "ready" ? state.data.session.theme : undefined);
  if (state.kind === "loading" || !inBrowser) return <LoadingScreen label="Loading questions" />;
  if (state.kind === "not_found")
    return <CenteredMessage title="We can't find that code" body={`There's no presentation with the code “${code}”. Check the code on the screen and try again.`} />;
  if (state.kind === "error")
    return <CenteredMessage title="No connection" body="Check your internet. We'll keep trying on our own." link={false} />;
  // A new revision remounts the ballot: answers live in storage, so they carry over to the new questions.
  return <Ballot key={state.data.session.revision} code={code} data={state.data} onRevision={setRevision} />;
}

const STATUS_POLL_MS = 10_000;
/** With quiz questions, phones check more often so a started question reaches them within ~2 seconds. */
const QUIZ_POLL_MS = 1_500;

/**
 * poll: chosen option id · words: list of words · multi: picked option ids ·
 * rank: option ids, first place first · number: the number · text: the answer
 */
type Answer = string | string[] | number;

type Step =
  | { kind: "rating"; gi: number; item: TopicItem; index: number }
  | { kind: Exclude<QuestionKind, "rating">; gi: number };

function Ballot({ code, data, onRevision }: { code: string; data: SessionPayload; onRevision: (revision: number) => void }) {
  const { session, topics, criteria } = data;
  const ratingsKey = `liverate:ratings:${code}`;
  const pendingKey = `liverate:pending:${code}`;
  const answersKey = `liverate:answers:${code}`;
  const answersPendingKey = `liverate:answers-pending:${code}`;
  // Team activities: the name this person signs their leaves, notes and stars with (one for the presentation).
  const authorKey = `liverate:author:${code}`;

  const groups = useMemo(() => groupByFocus(data.focusTopics ?? [], topics), [data.focusTopics, topics]);

  // Only valid keys for this session, so stale storage can't inflate progress or send junk.
  const validKeys = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) if (g.kind === "rating") for (const t of g.topics) for (const c of criteria) s.add(cellKey(t.item.id, c.id));
    return s;
  }, [groups, criteria]);
  const byFocus = useMemo(() => new Map(groups.filter((g) => g.kind !== "rating").map((g) => [g.focus.id, g])), [groups]);
  const validAnswer = useMemo(() => {
    return (focusId: string, v: unknown): v is Answer => {
      const g = byFocus.get(focusId);
      if (!g) return false;
      const isOption = (id: unknown) => g.topics.some((t) => t.item.id === id);
      switch (g.kind) {
        case "poll":
          return typeof v === "string" && isOption(v);
        case "multi":
          return Array.isArray(v) && v.length <= (g.maxPicks ?? g.topics.length) && v.every(isOption);
        case "rank":
          return Array.isArray(v) && v.length === g.topics.length && new Set(v).size === v.length && v.every(isOption);
        case "number":
          return typeof v === "number" && v >= (g.min ?? 0) && v <= (g.max ?? 100);
        case "text":
          return typeof v === "string" && v.length > 0;
        case "qa":
          return false; // Q&A keeps its own state (QaCard)
        case "quiz":
          return typeof v === "string" && isOption(v);
        default:
          return Array.isArray(v) && v.length <= 3 && v.every((w) => typeof w === "string");
      }
    };
  }, [byFocus]);

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
  const [author, setAuthor] = useState(() => {
    const v = readJSON<unknown>(authorKey, "");
    return signedName(v) ?? "";
  });
  // Word clouds count as done at 3 answers, or when the voter says "that's all".
  const finishedKey = `liverate:finished:${code}`;
  const [finished, setFinished] = useState<string[]>(() => readJSON<string[]>(finishedKey, []));
  // Still on the ballot although everything is done: following the live Q&A.
  const [reviewing, setReviewing] = useState(false);
  const [isOpen, setIsOpen] = useState(session.isOpen);
  // The presenter lets people see live results on their phones.
  const [showResults, setShowResults] = useState(false);
  // The presenter lets people raise open points (things to follow up); learned from the status poll.
  const [canRaise, setCanRaise] = useState(false);
  const resultsHref = showResults ? `/s/${encodeURIComponent(code)}/results` : undefined;

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
        toBody: (focusId, v) => {
          const kind = byFocus.get(focusId)?.kind;
          if (kind === "poll") return { kind, focusId, topicId: v };
          if (kind === "multi" || kind === "rank") return { kind, focusId, topicIds: v };
          if (kind === "number") return { kind, focusId, value: v };
          if (kind === "text") return { kind, focusId, text: v, ...(byFocus.get(focusId)?.board ? { author: signedName(readJSON<unknown>(authorKey, "")) } : {}) };
          return { kind: "words", focusId, words: v };
        },
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

  // Quiz: the question running now, and server minus phone time.
  const hasQuiz = groups.some((g) => g.kind === "quiz");
  const [liveQuiz, setLiveQuiz] = useState<LiveQuiz | null>(null);
  const [quizOffset, setQuizOffset] = useState(0);

  // Poll open/closed state while the tab is visible (served from the CDN cache).
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const check = async () => {
      try {
        const res = await fetch(`/api/session/${encodeURIComponent(code)}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { isOpen: boolean; revision?: number; showResults?: boolean; openPoints?: boolean; quiz?: LiveQuiz | null };
        setIsOpen(body.isOpen);
        setShowResults(body.showResults === true);
        setCanRaise(body.openPoints === true);
        if (body.quiz !== undefined) {
          setLiveQuiz((prev) => (JSON.stringify(prev) === JSON.stringify(body.quiz) ? prev : (body.quiz ?? null)));
          if (body.quiz) setQuizOffset(clockOffset(body.quiz.now, Date.now()));
        }
        if (typeof body.revision === "number" && body.revision !== session.revision) onRevision(body.revision);
      } catch {
        /* offline: try again next tick */
      }
    };
    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(check, hasQuiz ? QUIZ_POLL_MS : STATUS_POLL_MS);
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
    if (document.visibilityState === "visible") {
      void check();
      startPolling();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code, session.revision, onRevision, hasQuiz]);

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
      const g = groups[step.gi];
      const v = a[g.focus.id];
      switch (step.kind) {
        case "poll":
        case "text":
          return typeof v === "string";
        case "number":
          return typeof v === "number";
        case "rank":
          return Array.isArray(v) && v.length === g.topics.length;
        case "multi":
          // done once the limit is reached, or when the voter says they're done
          return Array.isArray(v) && v.length > 0 && (v.length >= (g.maxPicks ?? g.topics.length) || finished.includes(g.focus.id));
        case "qa":
          // done once they ask, upvote or skip
          return finished.includes(g.focus.id);
        case "quiz":
          // done once answered, or once its time is up
          return typeof v === "string" || finished.includes(g.focus.id);
        default:
          return Array.isArray(v) && (v.length >= 3 || (v.length > 0 && finished.includes(g.focus.id)));
      }
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
      // Most questions move on once answered; word clouds wait so people can add more answers.
      afterChange(i, ratings, next, wasDone, steps[i].kind !== "words");
    },
    [answers, ratings, groups, steps, stepDone, answersKey, answerQueue, afterChange, reward],
  );

  /** "That's all from me" on a word cloud, or "Done" on a pick-several question. */
  const onFinish = useCallback(
    (gi: number) => {
      const focusId = groups[gi].focus.id;
      const i = steps.findIndex((s) => s.kind !== "rating" && s.gi === gi);
      const wasDone = stepDone(steps[i], ratings, answers);
      const next = [...new Set([...finished, focusId])];
      setFinished(next);
      writeJSON(finishedKey, next);
      // stepDone reads `finished`, so evaluate the next step with the updated list.
      const v = answers[focusId];
      if (!wasDone && Array.isArray(v) && v.length > 0) {
        const target = steps.findIndex((s, j) => j !== i && !stepDone(s, ratings, answers) && !((s.kind === "words" || s.kind === "multi") && next.includes(groups[s.gi].focus.id)));
        if (target !== -1) {
          cancelAdvance();
          advanceTimer.current = setTimeout(() => goTo(target), 450);
        }
      }
    },
    [groups, steps, stepDone, ratings, answers, finished, finishedKey, goTo],
  );

  /**
   * Q&A: the voter asked, upvoted (stay = true: keep showing the live list even if that was the
   * last step) or skipped (stay = false: on to the thank-you screen if everything is done).
   */
  const onTookPart = useCallback(
    (gi: number, stay: boolean) => {
      const focusId = groups[gi].focus.id;
      if (stay) setReviewing(true);
      if (finished.includes(focusId)) return;
      reward();
      const next = [...finished, focusId];
      setFinished(next);
      writeJSON(finishedKey, next);
    },
    [groups, finished, finishedKey, reward],
  );

  const qaStep = steps.findIndex((s) => s.kind === "qa");

  /** Quiz: answer locked in on the server (no queue: a quiz answer is one-shot and timed). */
  const onQuizAnswer = useCallback(
    (gi: number, topicId: string) => {
      const focusId = groups[gi].focus.id;
      reward();
      const next = { ...answers, [focusId]: topicId };
      setAnswers(next);
      writeJSON(answersKey, next);
    },
    [groups, answers, answersKey, reward],
  );
  /** Quiz: time is up for this question. */
  const onQuizOver = useCallback(
    (focusId: string) => {
      setFinished((f) => {
        if (f.includes(focusId)) return f;
        const next = [...f, focusId];
        writeJSON(finishedKey, next);
        return next;
      });
    },
    [finishedKey],
  );

  // When the presenter starts a quiz question, every phone jumps to it (even from the thank-you screen).
  const liveStart = liveQuiz ? `${liveQuiz.focusId}@${liveQuiz.startedAt}` : null;
  const lastStart = useRef<string | null>(null);
  useEffect(() => {
    if (!liveQuiz || liveStart === lastStart.current) return;
    const first = lastStart.current === null;
    lastStart.current = liveStart;
    const i = steps.findIndex((s) => s.kind === "quiz" && groups[s.gi].focus.id === liveQuiz.focusId);
    // on page load, only jump if the question is still running
    if (i === -1 || (first && liveQuiz.correctTopicId !== null)) return;
    setReviewing(true);
    goTo(i);
  }, [liveQuiz, liveStart, steps, groups, goTo]);

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

  const here = steps[current];
  const group = here ? groups[here.gi] : null;

  if (complete && !reviewing)
    return (
      <ThankYou
        title={session.title}
        doodle={session.decor ? charactersFor(session.theme).screen : undefined}
        statuses={statuses}
        celebrate={celebrate}
        resultsHref={resultsHref}
        raise={canRaise && isOpen ? <RaisePoint code={code} voterId={voterId} className="animate-rise mt-4 w-full max-w-sm [animation-delay:500ms]" /> : null}
        onSeeQuestions={
          qaStep === -1
            ? undefined
            : () => {
                setReviewing(true);
                goTo(qaStep);
              }
        }
      />
    );

  return (
    <div className="min-h-dvh overflow-x-clip pb-16">
      {(celebrate || levelUp) && <Confetti />}
      {levelUp && (
        <div role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="slab animate-pop rounded-xl bg-sun px-5 py-3 text-center">
            <p className="font-display text-xl font-semibold">Level complete!</p>
            <p className="text-sm font-semibold">{levelUp} is done</p>
          </div>
        </div>
      )}

      <VoterHeader
        title={session.title}
        theme={session.theme}
        decor={session.decor}
        score={
          <>
            {combo >= 3 && (
              <span key={`combo-${combo}`} className="animate-pop rounded-full bg-lavender px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-ink uppercase">
                Combo ×{combo}
              </span>
            )}
            <ScorePill points={points} />
            {plus > 0 && (
              <span key={`plus-${plus}`} aria-hidden className="float-up font-mono absolute -top-1 right-1 text-sm font-medium text-primary">
                +10
              </span>
            )}
          </>
        }
      >
        {resultsHref && (
          <a href={resultsHref} className="mt-2 inline-block text-[0.95rem] font-bold underline decoration-primary decoration-2 underline-offset-4">
            See live results
          </a>
        )}
      </VoterHeader>

      <VoterProgress
        done={unitsDone}
        total={unitsTotal}
        chips={groups.map((g, gi) => {
          const own = steps.filter((s) => s.gi === gi);
          const doneHere = own.filter((s) => stepDone(s, ratings, answers)).length;
          return {
            key: g.focus.id || "loose",
            label: g.focus.name,
            active: here?.gi === gi,
            finished: doneHere === own.length,
            progress: own.length > 1 ? `${doneHere}/${own.length}` : undefined,
          };
        })}
        onChip={(gi) => goTo(steps.findIndex((s) => s.gi === gi))}
      />

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
            <StepIntro
              level={here.gi + 1}
              levels={groups.length}
              name={here.kind === "rating" ? group.focus.name : undefined}
              description={group.focus.description}
              image={group.focus.imageId}
              question={group.focus.name}
            />
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
              ) : here.kind === "multi" ? (
                <MultiCard
                  question={group.focus.name}
                  options={group.topics.map((t) => t.item)}
                  color={topicColor(here.gi)}
                  maxPicks={group.maxPicks}
                  value={Array.isArray(answers[group.focus.id]) ? (answers[group.focus.id] as string[]) : undefined}
                  status={statuses[group.focus.id]}
                  disabled={!isOpen}
                  finished={finished.includes(group.focus.id)}
                  onChange={(ids) => onAnswer(here.gi, ids)}
                  onFinish={() => onFinish(here.gi)}
                />
              ) : here.kind === "rank" ? (
                <RankCard
                  question={group.focus.name}
                  options={group.topics.map((t) => t.item)}
                  color={topicColor(here.gi)}
                  value={Array.isArray(answers[group.focus.id]) ? (answers[group.focus.id] as string[]) : undefined}
                  status={statuses[group.focus.id]}
                  disabled={!isOpen}
                  onRank={(order) => onAnswer(here.gi, order)}
                />
              ) : here.kind === "number" ? (
                <NumberCard
                  question={group.focus.name}
                  color={topicColor(here.gi)}
                  min={group.min ?? 0}
                  max={group.max ?? 100}
                  unit={group.unit}
                  value={typeof answers[group.focus.id] === "number" ? (answers[group.focus.id] as number) : undefined}
                  status={statuses[group.focus.id]}
                  disabled={!isOpen}
                  onSend={(n) => onAnswer(here.gi, n)}
                />
              ) : here.kind === "text" ? (
                <TextCard
                  question={group.focus.name}
                  color={topicColor(here.gi)}
                  value={typeof answers[group.focus.id] === "string" ? (answers[group.focus.id] as string) : undefined}
                  status={statuses[group.focus.id]}
                  disabled={!isOpen}
                  board={group.board ?? null}
                  author={author}
                  seeHref={resultsHref}
                  onSend={(text, name) => {
                    if (group.board) {
                      setAuthor(name);
                      writeJSON(authorKey, name);
                    }
                    onAnswer(here.gi, text);
                  }}
                />
              ) : here.kind === "quiz" ? (
                <QuizCard
                  code={code}
                  voterId={voterId}
                  focusId={group.focus.id}
                  question={group.focus.name}
                  options={group.topics.map((t) => t.item)}
                  color={topicColor(here.gi)}
                  live={liveQuiz}
                  offset={quizOffset}
                  value={typeof answers[group.focus.id] === "string" ? (answers[group.focus.id] as string) : undefined}
                  disabled={!isOpen}
                  onAnswer={(id) => onQuizAnswer(here.gi, id)}
                  onOver={() => onQuizOver(group.focus.id)}
                />
              ) : here.kind === "qa" ? (
                <QaCard
                  code={code}
                  voterId={voterId}
                  focusId={group.focus.id}
                  question={group.focus.name}
                  color={topicColor(here.gi)}
                  disabled={!isOpen}
                  done={finished.includes(group.focus.id)}
                  onTookPart={() => onTookPart(here.gi, true)}
                  onSkip={() => onTookPart(here.gi, false)}
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
                  onFinish={() => onFinish(here.gi)}
                />
              )}
            </div>

            <StepNav
              current={current}
              steps={steps.map((st) => ({ label: st.kind === "rating" ? st.item.name : groups[st.gi].focus.name, done: stepDone(st, ratings, answers) }))}
              onGo={goTo}
            />
          </>
        )}
        {canRaise && isOpen && <RaisePoint code={code} voterId={voterId} className="w-full" />}
      </main>
    </div>
  );
}

/** Shown once every question is answered: the ballot closes; saving status stays honest. */
function ThankYou({
  title,
  doodle,
  statuses,
  celebrate,
  resultsHref,
  raise,
  onSeeQuestions,
}: {
  title: string;
  /** Fun illustration shown above the tick. */
  doodle?: Character;
  statuses: Record<string, SaveStatus>;
  celebrate: boolean;
  /** Set when the presenter shows results on phones. */
  resultsHref?: string;
  /** The "Raise an open point" button, when the presenter allows it. */
  raise?: React.ReactNode;
  /** Set when the presentation has a Q&A: people come back to vote on new questions. */
  onSeeQuestions?: () => void;
}) {
  const values = Object.values(statuses);
  const saving = values.some((s) => s === "saving" || s === "retrying");
  const closed = values.some((s) => s === "closed");
  return (
    <main className="flex min-h-dvh flex-col">
      {celebrate && <Confetti />}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
      {doodle && <Doodle character={doodle} className="mb-6 h-36 w-36" />}
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
        Your answers to <span className="text-ink">{title}</span> are in.{" "}
        {onSeeQuestions ? "New questions keep coming in, so check back to vote on them." : "You can close this page."}
      </p>
      {onSeeQuestions && (
        <button
          type="button"
          onClick={onSeeQuestions}
          className="key animate-rise mt-6 rounded-xl bg-primary px-6 py-3 font-bold text-white [animation-delay:420ms]"
        >
          See the room&apos;s questions
        </button>
      )}
      {resultsHref && (
        <a
          href={resultsHref}
          className={`key animate-rise mt-4 rounded-xl px-6 py-3 font-bold [animation-delay:460ms] ${onSeeQuestions ? "bg-white" : "bg-primary text-white"}`}
        >
          See live results
        </a>
      )}
      {raise}
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
      </div>
      <Credit subtle />
    </main>
  );
}
