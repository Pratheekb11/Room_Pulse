"use client";

import { useEffect, useState } from "react";
import { readableOn, topicColor } from "@/lib/colors";
import { quizTimeLeft } from "@/lib/quiz";
import { readJSON, writeJSON } from "@/lib/storage";
import type { LiveQuiz, QuizMe, TopicItem } from "@/lib/types";
import { Burst, haptic } from "../Burst";
import { CardShell } from "./CardShell";

const LETTERS = "ABCDEFGHIJ";

interface Props {
  code: string;
  voterId: string;
  focusId: string;
  question: string;
  options: TopicItem[];
  color: string;
  /** The quiz question running now (any question), and server minus phone time in ms. */
  live: LiveQuiz | null;
  offset: number;
  /** The option this voter locked in, if any. */
  value: string | undefined;
  disabled: boolean;
  onAnswer: (topicId: string) => void;
  /** Time is up for this question (answered or not). */
  onOver: () => void;
}

/** A quiz question: wait for the presenter to start it, answer before the timer runs out, then see if you were right. */
export function QuizCard({ code, voterId, focusId, question, options, color, live, offset, value, disabled, onAnswer, onOver }: Props) {
  const nickKey = `liverate:nick:${code}`;
  const [nick, setNick] = useState<string>(() => readJSON<string>(nickKey, ""));
  const [nickDraft, setNickDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<QuizMe | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [burst, setBurst] = useState<string | null>(null);

  const here = live?.focusId === focusId ? live : null;
  const left = here ? quizTimeLeft(here, now, offset) : 0;
  const running = here !== null && left > 0;
  const revealed = here?.correctTopicId ?? null;
  const over = here !== null && left === 0;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [running]);

  // Tell the ballot this step is done, and fetch this player's score once the answer is out.
  useEffect(() => {
    if (over) onOver();
  }, [over, onOver]);
  useEffect(() => {
    if (!revealed) return;
    let stop = false;
    fetch(`/api/quiz/${encodeURIComponent(code)}/me?voter=${voterId}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<QuizMe>) : null))
      .then((m) => {
        if (!stop && m) setMe(m);
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [revealed, code, voterId]);

  async function post(body: object) {
    const res = await fetch(`/api/quiz/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voterId, ...body }),
    });
    return { ok: res.ok, error: ((await res.json().catch(() => ({}))) as { error?: string }).error };
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const name = nickDraft.trim().replace(/\s+/g, " ");
    if (!name) return;
    setSending(true);
    try {
      const r = await post({ action: "join", nickname: name });
      if (!r.ok) throw new Error();
      writeJSON(nickKey, name);
      setNick(name);
      setNote(null);
    } catch {
      setNote("That nickname didn't save. Try again.");
    } finally {
      setSending(false);
    }
  }

  async function pick(id: string) {
    if (value || !running || sending || disabled) return;
    haptic();
    setBurst(id);
    setSending(true);
    try {
      const r = await post({ action: "answer", focusId, topicId: id });
      if (r.ok) onAnswer(id);
      else setNote(r.error === "closed" ? "Voting is closed." : r.error === "not_live" ? "Too late. Time was up." : "Not saved. Try again.");
    } catch {
      setNote("Not saved. Check your internet and tap again.");
    } finally {
      setSending(false);
    }
  }

  const mine = me?.answers.find((a) => a.focusId === focusId);
  const how = running ? `Quiz · ${Math.ceil(left / 1000)} seconds left` : "Quiz";

  return (
    <CardShell id="quiz-q" color={color} how={how} question={question}>
      {running && (
        <div className="h-2 bg-canvas" aria-hidden>
          <div className="h-full bg-primary transition-[width] duration-200 ease-linear" style={{ width: `${(left / (here!.seconds * 1000)) * 100}%` }} />
        </div>
      )}
      <div className="flex flex-col gap-3 p-5">
        {!nick ? (
          <form onSubmit={join} className="flex flex-col gap-2">
            <label htmlFor="quiz-nick" className="font-semibold">
              Pick a nickname for the leaderboard
            </label>
            <div className="flex gap-2">
              <input
                id="quiz-nick"
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
                maxLength={20}
                autoComplete="nickname"
                placeholder="e.g. Quiz Whiz"
                className="min-w-0 flex-1 rounded-xl border border-line-strong px-4 py-3 text-lg"
              />
              <button type="submit" disabled={!nickDraft.trim() || sending} className="key shrink-0 rounded-xl bg-primary px-5 py-3 font-bold text-white">
                Join
              </button>
            </div>
            <p className="text-xs text-ink-soft">Everyone in the room sees it on the big screen, so keep it friendly.</p>
          </form>
        ) : !here && !value ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="h-3 w-3 animate-pulse rounded-full bg-primary" aria-hidden />
            <p className="font-display text-xl font-semibold">Get ready, {nick}</p>
            <p className="text-sm text-ink-soft">This question starts when the presenter says go. Keep this page open.</p>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-labelledby="quiz-q" className="grid grid-cols-1 gap-2.5">
              {options.map((o, i) => {
                const c = topicColor(i);
                const picked = value === o.id;
                const right = revealed === o.id;
                const wrongPick = revealed && picked && !right;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={picked}
                    disabled={disabled || !running || !!value}
                    onClick={() => pick(o.id)}
                    // not .key: its disabled fade and 1px border would hide which option was picked and which is right
                    className={`relative flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-lg font-bold transition-[transform,opacity,border-color] duration-150 enabled:hover:border-ink enabled:active:scale-[0.97] disabled:cursor-default ${
                      right ? "border-success bg-mint" : wrongPick ? "border-error bg-white" : picked ? "border-ink bg-white" : "border-line-strong bg-white"
                    } ${revealed && !right && !picked ? "opacity-50" : ""} ${value && !picked && !revealed ? "opacity-50" : ""}`}
                  >
                    {burst === o.id && <Burst key={o.id} color={c} />}
                    <span
                      className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong"
                      style={{ backgroundColor: c, color: readableOn(c) }}
                    >
                      {LETTERS[i]}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{o.name}</span>
                    {right && <span aria-label="right answer">✓</span>}
                    {wrongPick && <span aria-label="your answer">✗</span>}
                  </button>
                );
              })}
            </div>
            <div aria-live="polite" className="min-h-6 text-center">
              {revealed ? (
                value ? (
                  value === revealed ? (
                    <p className="font-display animate-pop text-2xl font-semibold text-success">
                      Right! {mine ? `+${mine.points} points` : ""}
                    </p>
                  ) : (
                    <p className="font-display text-xl font-semibold">Not this time.</p>
                  )
                ) : (
                  <p className="font-display text-xl font-semibold">Time&apos;s up.</p>
                )
              ) : over ? (
                <p className="font-semibold text-ink-soft">Time&apos;s up. The answer is coming…</p>
              ) : value ? (
                <p className="font-semibold">Locked in. Wait for the answer…</p>
              ) : (
                <p className="text-sm font-semibold text-ink-soft">{note ?? "Fast right answers score more points."}</p>
              )}
              {revealed && me && me.rank !== null && (
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {me.points.toLocaleString("en-US")} points · {ordinal(me.rank)} of {me.players}
                </p>
              )}
              {value && note && !revealed && <p className="text-sm text-error">{note}</p>}
            </div>
          </>
        )}
      </div>
    </CardShell>
  );
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}
