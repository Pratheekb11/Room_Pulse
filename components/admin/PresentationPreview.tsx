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
import { Doodle } from "../Doodle";
import { charactersFor, type Character } from "@/lib/decor";

type Device = "screen" | "phone";

const SAMPLE_TEXT = ["More time for questions", "The demos were great", "Shorter meetings, please", "Clearer goals for next month", "Loved the energy today"];
const SAMPLE_QA = ["What's the plan for next quarter?", "Can we get the slides afterwards?", "How do we join the beta?"];

function tally(q: PreviewQuestion): PollTally {
  const counts = sampleCounts(q.options.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const rows = q.options.map((o, index) => ({ id: o.id, name: o.name, n: counts[index], pct: Math.round((counts[index] / total) * 100), index }));
  return { total, rows, leader: rows.length ? { id: rows[0].id, name: rows[0].name, n: rows[0].n } : null };
}

/** The question as it shows on the big screen, with sample results. */
function ScreenSlide({ title, q, voters, doodle }: { title: string; q: PreviewQuestion; voters: number; doodle?: Character }) {
  return (
    <div className="flex h-full flex-col gap-4 p-[4%]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-soft">{title || "Your presentation"}</p>
          <h3 className="font-display mt-1 text-[clamp(1.4rem,3vw,2.6rem)] leading-[1.05] break-words">{q.name}</h3>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full border border-line-strong bg-white px-3 py-1 text-sm font-bold">{voters} people voted</span>
          {doodle && <Doodle character={doodle} className="h-[clamp(4.5rem,9vw,8.5rem)] w-auto" />}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {q.kind === "words" ? (
          <WordCloud words={sampleWords(q.name)} />
        ) : q.kind === "number" ? (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-sm font-semibold text-ink-soft">Average answer</p>
            <p className="font-display text-[clamp(3rem,8vw,6rem)] leading-none text-primary">
              {Math.round(((q.min ?? 0) + (q.max ?? 100)) / 2)}
              {q.unit ? <span className="ml-2 text-[0.4em] text-ink">{q.unit}</span> : null}
            </p>
          </div>
        ) : q.kind === "text" || q.kind === "qa" ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {(q.kind === "qa" ? SAMPLE_QA : SAMPLE_TEXT).map((t, i) => (
              <li key={t} className="slab flex items-start justify-between gap-2 rounded-xl bg-white px-4 py-3 text-base font-semibold" style={{ boxShadow: `inset 4px 0 0 ${topicColor(i)}` }}>
                <span>{t}</span>
                {q.kind === "qa" && <span className="shrink-0 rounded-full bg-canvas px-2 text-sm">▲ {sampleCounts(3)[i]}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <PollBars tally={tally(q)} noun={q.kind === "rating" ? ["score", "scores"] : ["vote", "votes"]} />
        )}
      </div>
    </div>
  );
}

/** The question as it shows on a voter's phone: the real answer card, tappable. */
function PhoneSlide({
  title,
  q,
  index,
  total,
  session,
  criteria,
  doodle,
}: {
  doodle?: Character;
  title: string;
  q: PreviewQuestion;
  index: number;
  total: number;
  session: SessionInfo;
  criteria: NamedItem[];
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const id = `q${index}`;
  const value = answers[id];
  const set = (v: unknown) => setAnswers((a) => ({ ...a, [id]: v }));
  const color = topicColor(index);
  const common = { question: q.name, color, status: undefined, disabled: false };
  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      <div>
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-display min-w-0 text-[1.7rem] leading-[1.05] font-semibold break-words">{title || "Your presentation"}</h3>
          {doodle && <Doodle character={doodle} className="h-20 w-20 shrink-0" />}
        </div>
        <p className="mt-1 text-sm text-ink-soft">Tap an answer. It saves straight away. Your answers are anonymous.</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-full border border-line-strong bg-white">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((index / total) * 100)}%` }} />
        </div>
        <span className="text-sm font-bold tabular-nums">
          {index} / {total} done
        </span>
      </div>
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
      {(q.kind === "quiz" || q.kind === "qa") && (
        <p className="text-xs text-ink-soft">
          {q.kind === "quiz" ? "In the real quiz a timer runs and you start each question from the results screen." : "In the real Q&A people also vote for each other's questions."}
        </p>
      )}
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
  const chars = charactersFor(theme);
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

          {/* The slide, in the chosen design */}
          <div style={themeStyle(theme)} className="text-ink">
            {device === "screen" ? (
              <div className="slab theme-pattern mx-auto aspect-video w-full max-w-[calc((100dvh-17rem)*16/9)] min-w-0 overflow-hidden rounded-xl bg-canvas max-sm:aspect-auto max-sm:max-w-none max-sm:min-h-[22rem]">
                <ScreenSlide title={title} q={q} doodle={decor ? chars.screen : undefined} voters={sampleCounts(q.options.length || 4).reduce((a, b) => a + b, 0)} />
              </div>
            ) : (
              <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-[2rem] border-[6px] border-[#26251e] bg-canvas">
                <div className="theme-pattern h-[min(720px,max(28rem,calc(100dvh-19rem)))] overflow-y-auto">
                  <PhoneSlide key={`${i}-${theme}`} title={title} q={q} index={i} total={questions.length} session={session} criteria={crit} doodle={decor ? chars.phone : undefined} />
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
