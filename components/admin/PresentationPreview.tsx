"use client";

import { useEffect, useRef, useState } from "react";
import { topicColor } from "@/lib/colors";
import { cellKey } from "@/lib/stats";
import { kindLabel } from "@/lib/kinds";
import { getTheme, themeStyle, type ThemeId } from "@/lib/themes";
import { sampleCounts, sampleWords, type PreviewQuestion } from "@/lib/preview";
import type { PollTally } from "@/lib/answers";
import type { NamedItem, SessionInfo } from "@/lib/types";
import { PollBars } from "../PollResults";
import { WordCloud } from "../WordCloud";
import { PollCard } from "../PollCard";
import { TopicCard } from "../TopicCard";
import { WordsCard } from "../WordsCard";
import { MultiCard } from "../vote/MultiCard";
import { NumberCard } from "../vote/NumberCard";
import { RankCard } from "../vote/RankCard";
import { TextCard } from "../vote/TextCard";
import { ThemePicker } from "./ThemePicker";
import { LiveBadge } from "../LiveBadge";
import { useClientValue } from "../useClientValue";
import { voterUrl } from "@/lib/site";
import { QrPanel } from "../QrPanel";
import { QuestionDescription, QuestionTabs, ResultCard, ScreenHeader, VotingPills } from "../ScreenChrome";
import { ScorePill, StepIntro, StepNav, VoterHeader, VoterProgress } from "../VoterChrome";

type Device = "screen" | "phone";

const SAMPLE_TEXT = ["More time for questions", "The demos were great", "Shorter meetings, please", "Clearer goals for next month", "Loved the energy today"];
const SAMPLE_QA = ["What's the plan for next quarter?", "Can we get the slides afterwards?", "How do we join the beta?"];

function tally(q: PreviewQuestion): PollTally {
  const counts = sampleCounts(q.options.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const rows = q.options.map((o, index) => ({ id: o.id, name: o.name, n: counts[index], pct: Math.round((counts[index] / total) * 100), index }));
  return { total, rows, leader: rows.length ? { id: rows[0].id, name: rows[0].name, n: rows[0].n } : null };
}

/** Sample results for a question, as its chart on the big screen. */
function SampleChart({ q }: { q: PreviewQuestion }) {
  if (q.kind === "words") return <WordCloud words={sampleWords(q.name)} />;
  if (q.kind === "number")
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-sm font-semibold text-ink-soft">Average answer</p>
        <p className="font-display text-[clamp(3rem,8vw,6rem)] leading-none text-primary">
          {Math.round(((q.min ?? 0) + (q.max ?? 100)) / 2)}
          {q.unit ? <span className="ml-2 text-[0.4em] text-ink">{q.unit}</span> : null}
        </p>
      </div>
    );
  if (q.kind === "text" || q.kind === "qa")
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {(q.kind === "qa" ? SAMPLE_QA : SAMPLE_TEXT).map((t, i) => (
          <li key={t} className="slab flex items-start justify-between gap-2 rounded-xl bg-white px-4 py-3 text-base font-semibold" style={{ boxShadow: `inset 4px 0 0 ${topicColor(i)}` }}>
            <span>{t}</span>
            {q.kind === "qa" && <span className="shrink-0 rounded-full bg-canvas px-2 text-sm">▲ {sampleCounts(3)[i]}</span>}
          </li>
        ))}
      </ul>
    );
  return <PollBars tally={tally(q)} noun={q.kind === "rating" ? ["score", "scores"] : ["vote", "votes"]} />;
}

const SCREEN_W = 1280;
// a common laptop screen (16:10), like most presenters' results screen
const SCREEN_H = 800;
const Pill = ({ children, on = false }: { children: React.ReactNode; on?: boolean }) => (
  <span className={`rounded-full border border-line-strong px-3 py-1 ${on ? "bg-sun" : "bg-white"}`}>{children}</span>
);

/** The real results screen (same header, tabs, card and QR panel), drawn at 1280×800 and scaled to fit. */
function ScreenSlide({ title, questions, index, onPick, session }: { title: string; questions: PreviewQuestion[]; index: number; onPick: (i: number) => void; session: SessionInfo }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [now] = useState(() => Date.now());
  const joinUrl = useClientValue(() => voterUrl("abc123")) ?? "";
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / SCREEN_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const q = questions[index];
  const voters = sampleCounts(q.options.length || 4).reduce((a, b) => a + b, 0);
  return (
    <div ref={box} className="slab mx-auto w-full max-w-[calc((100dvh-17rem)*1.6)] min-w-0 overflow-hidden rounded-xl" style={{ height: SCREEN_H * scale }}>
      <div className="theme-pattern origin-top-left bg-canvas" style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}>
        <div className="flex h-full flex-col gap-5 px-8 py-6">
          <ScreenHeader
            title={title || "Your presentation"}
            theme={session.theme}
            decor={session.decor}
            status={
              <>
                <LiveBadge lastOkAt={now} />
                <VotingPills voters={voters} isOpen />
              </>
            }
            controls={
              <>
                <Pill on>Hide QR</Pill>
                <Pill>Full screen</Pill>
                <Pill>Edit questions</Pill>
              </>
            }
          />
          <div className="flex min-h-0 flex-1 flex-row gap-6">
            <main className="min-w-0 flex-1">
              {questions.length > 1 && <QuestionTabs names={questions.map((x, i) => ({ key: String(i), name: x.name }))} active={index} onPick={(i) => onPick(i ?? 0)} />}
              <QuestionDescription text={q.description} />
              <ResultCard title={q.name}>
                <SampleChart q={q} />
              </ResultCard>
            </main>
            <div className="w-[18rem] shrink-0">
              <QrPanel url={joinUrl} code="abc123" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The real phone page (same header, progress, chips and buttons) with the real answer card, tappable. */
function PhoneSlide({
  title,
  questions,
  index,
  onPick,
  session,
  criteria,
}: {
  title: string;
  questions: PreviewQuestion[];
  index: number;
  onPick: (i: number) => void;
  session: SessionInfo;
  criteria: NamedItem[];
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const q = questions[index];
  const id = `q${index}`;
  const value = answers[id];
  const set = (v: unknown) => setAnswers((a) => ({ ...a, [id]: v }));
  const color = topicColor(index);
  const common = { question: q.name, color, status: undefined, disabled: false };
  const done = (i: number) => (questions[i].kind === "rating" ? Object.keys(ratings).some((k) => k.startsWith(`${questions[i].options[0]?.id}:`)) : answers[`q${i}`] !== undefined);
  return (
    <div className="pb-10">
      <VoterHeader title={title || "Your presentation"} theme={session.theme} decor={session.decor} score={<ScorePill points={0} />} />
      <VoterProgress
        done={questions.filter((_, i) => done(i)).length}
        total={questions.length}
        chips={questions.map((x, i) => ({ key: String(i), label: x.name, active: i === index, finished: done(i) }))}
        onChip={onPick}
      />
      <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-5">
        <div>
          <StepIntro level={index + 1} levels={questions.length} name={q.kind === "rating" ? q.name : undefined} description={q.description} />
        {q.kind === "rating" ? (
          <TopicCard
            topic={q.options[0]}
            index={0}
            total={q.options.length}
            color={color}
            criteria={criteria}
            session={session}
            ratings={ratings}
            statuses={{}}
            disabled={false}
            onRate={(t, c, s) => setRatings((r) => ({ ...r, [cellKey(t, c)]: s }))}
          />
        ) : q.kind === "poll" || q.kind === "quiz" ? (
          <PollCard {...common} options={q.options} value={value as string | undefined} onPick={set} />
        ) : q.kind === "multi" ? (
          <MultiCard {...common} options={q.options} maxPicks={q.maxPicks ?? null} value={value as string[] | undefined} finished={false} onChange={set} onFinish={() => {}} />
        ) : q.kind === "rank" ? (
          <RankCard {...common} options={q.options} value={value as string[] | undefined} onRank={set} />
        ) : q.kind === "number" ? (
          <NumberCard {...common} min={q.min ?? 0} max={q.max ?? 100} unit={q.unit ?? null} value={value as number | undefined} onSend={set} />
        ) : q.kind === "words" ? (
          <WordsCard {...common} value={value as string[] | undefined} finished={false} onSend={set} onFinish={() => {}} />
        ) : (
          <TextCard {...common} value={value as string | undefined} onSend={set} />
        )}
        </div>
        {(q.kind === "quiz" || q.kind === "qa") && (
          <p className="text-xs text-ink-soft">
            {q.kind === "quiz" ? "In the real quiz a timer runs and you start each question from the results screen." : "In the real Q&A people also vote for each other's questions."}
          </p>
        )}
        <StepNav current={index} steps={questions.map((x, i) => ({ label: x.name, done: done(i) }))} onGo={(i) => onPick(Math.max(0, Math.min(questions.length - 1, i)))} />
      </main>
    </div>
  );
}

/** Full-screen preview of a presentation being built: big screen or phone, in any slide design. */
export function PresentationPreview({
  title,
  questions,
  theme,
  onTheme,
  decor,
  onDecor,
  recommended,
  criteria,
  scaleMax,
  lowLabel,
  highLabel,
  onClose,
}: {
  title: string;
  questions: PreviewQuestion[];
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  decor: boolean;
  onDecor: (on: boolean) => void;
  recommended: { id: ThemeId; reason: string };
  criteria: string[];
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<Device>("screen");
  const [at, setAt] = useState(0);
  const i = Math.min(at, questions.length - 1);
  const q = questions[i];
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") setAt((n) => Math.min(questions.length - 1, n + 1));
      if (e.key === "ArrowLeft") setAt((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [questions.length]);

  const session: SessionInfo = { code: "preview", title, scaleMax, lowLabel: lowLabel || "Low", highLabel: highLabel || "High", isOpen: true, revision: 0, theme, decor };
  const crit = (criteria.length ? criteria : ["Impact"]).map((name, n) => ({ id: `c${n}`, name }));
  const t = getTheme(theme);

  return (
    <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-3 py-2 sm:px-5">
        <h2 className="font-display mr-auto text-xl font-semibold">Preview</h2>
        <div role="tablist" aria-label="Show on" className="flex rounded-full border border-line-strong bg-white p-0.5 text-sm font-semibold">
          {(["screen", "phone"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={device === d}
              onClick={() => setDevice(d)}
              className={`rounded-full px-3 py-1 ${device === d ? "bg-ink text-white" : "hover:bg-canvas"}`}
            >
              {d === "screen" ? "Big screen" : "Phone"}
            </button>
          ))}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} className="key rounded-lg bg-white px-3 py-1.5 text-sm font-bold">
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Question {i + 1} of {questions.length} <span className="font-normal text-ink-soft">· {kindLabel(q.kind)}</span>
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={i === 0} onClick={() => setAt(i - 1)} className="key rounded-lg bg-white px-3 py-1.5 text-sm font-bold" aria-label="Previous question">
                ← Back
              </button>
              <button
                type="button"
                disabled={i === questions.length - 1}
                onClick={() => setAt(i + 1)}
                className="key rounded-lg bg-white px-3 py-1.5 text-sm font-bold"
                aria-label="Next question"
              >
                Next →
              </button>
            </div>
          </div>

          {/* The real screens, in the chosen design */}
          <div style={themeStyle(theme)} className="text-ink">
            {device === "screen" ? (
              <ScreenSlide title={title} questions={questions} index={i} onPick={setAt} session={session} />
            ) : (
              <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[6px] border-[#26251e] bg-canvas">
                <div className="theme-pattern h-[min(720px,max(28rem,calc(100dvh-19rem)))] overflow-y-auto">
                  <PhoneSlide key={theme} title={title} questions={questions} index={i} onPick={setAt} session={session} criteria={crit} />
                </div>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-ink-soft">
            {device === "screen" ? "Sample results. Real answers replace them." : "Try it: taps here aren't saved."} Use ← and → to move between questions.
          </p>

          <section aria-label="Slide design" className="mt-1">
            <p className="text-sm font-semibold">
              Design: {t.label} <span className="font-normal text-ink-soft">· {t.blurb}</span>
            </p>
            <div className="mt-2">
              <ThemePicker value={theme} onChange={onTheme} recommended={recommended} title={title} compact />
            </div>
            <label className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={decor} onChange={(e) => onDecor(e.target.checked)} className="h-5 w-5 accent-ink" />
              Fun illustrations
            </label>
          </section>
        </div>
      </div>
    </div>
  );
}
