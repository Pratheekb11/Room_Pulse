"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { qaVoterView, type QaLocal } from "@/lib/answers";
import { readJSON, writeJSON } from "@/lib/storage";
import type { PublicQaItem } from "@/lib/types";
import { MAX_QA_PER_VOTER, MAX_TEXT_ANSWER } from "@/lib/validation";
import { haptic } from "../Burst";
import { CardShell } from "./CardShell";

interface Props {
  code: string;
  voterId: string;
  focusId: string;
  question: string;
  color: string;
  disabled: boolean;
  /** The voter asked, upvoted or skipped: this step counts as done. */
  done: boolean;
  /** Asked or upvoted. */
  onTookPart: () => void;
  /** "Nothing to ask": done without taking part. */
  onSkip: () => void;
}

const POLL_MS = 5_000;
const EMPTY: QaLocal = { asked: [], voted: [], adjust: {} };

/** Audience Q&A: send in a question, and upvote the ones you want answered. The list updates live. */
export function QaCard({ code, voterId, focusId, question, color, disabled, done, onTookPart, onSkip }: Props) {
  const storeKey = `liverate:qa:${code}:${focusId}`;
  const [local, setLocal] = useState<QaLocal>(() => ({ ...EMPTY, ...readJSON<Partial<QaLocal>>(storeKey, {}) }));
  const [server, setServer] = useState<PublicQaItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const save = useCallback(
    (next: QaLocal) => {
      setLocal(next);
      writeJSON(storeKey, next);
    },
    [storeKey],
  );

  // Live list, while the page is visible (served from the CDN cache).
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/qa/${encodeURIComponent(code)}`, { cache: "no-store" });
        if (res.ok && !stop) {
          setServer(((await res.json()) as { questions: PublicQaItem[] }).questions);
          setNow(Date.now());
        }
      } catch {
        /* offline: try again next tick */
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [code]);

  const items = useMemo(() => qaVoterView(server ?? [], focusId, local, now), [server, focusId, local, now]);
  const left = MAX_QA_PER_VOTER - local.asked.length;
  const clean = draft.trim().replace(/\s+/g, " ");

  async function post(body: Record<string, unknown>) {
    const res = await fetch(`/api/qa/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ focusId, voterId, ...body }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
    return { ok: res.ok, ...data };
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!clean || sending || left <= 0) return;
    setSending(true);
    setNote(null);
    try {
      const r = await post({ action: "ask", text: clean });
      if (r.ok && r.id) {
        haptic();
        save({ ...local, asked: [...local.asked, { id: r.id, text: clean, at: new Date().toISOString() }] });
        setNow(Date.now());
        setDraft("");
        setNote({ text: "Sent. It's on the list below." });
        onTookPart();
      } else {
        setNote({
          bad: true,
          text:
            r.error === "closed" ? "Voting is closed, so questions can't be sent."
            : r.error === "limit" ? `You've sent ${MAX_QA_PER_VOTER} questions, the most allowed.`
            : "Not sent. Try again.",
        });
      }
    } catch {
      setNote({ bad: true, text: "Not sent. Check your internet and try again." });
    } finally {
      setSending(false);
    }
  }

  async function toggleVote(q: PublicQaItem & { voted: boolean }) {
    const up = !q.voted;
    const raw = server?.find((s) => s.id === q.id)?.votes ?? 0;
    const prev = local;
    const old = local.adjust[q.id];
    const delta = (old && old.base === raw ? old.delta : 0) + (up ? 1 : -1);
    const adjust = { ...local.adjust };
    if (delta === 0) delete adjust[q.id];
    else adjust[q.id] = { base: raw, delta };
    if (up) haptic();
    save({ ...local, voted: up ? [...local.voted, q.id] : local.voted.filter((id) => id !== q.id), adjust });
    try {
      const r = await post({ action: "vote", questionId: q.id, up });
      if (!r.ok) throw new Error(r.error);
      onTookPart();
    } catch {
      save(prev);
      setNote({ bad: true, text: "Your vote didn't save. Try again." });
    }
  }

  return (
    <CardShell id="qa-q" color={color} how="Ask a question, or vote for the ones you want answered" question={question}>
      <form onSubmit={ask} className="flex flex-col gap-3 p-5 pb-4">
        <label htmlFor="qa-ask" className="text-sm font-semibold">
          Your question
        </label>
        <textarea
          id="qa-ask"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TEXT_ANSWER}
          rows={3}
          disabled={disabled || left <= 0}
          placeholder={left > 0 ? "Type your question…" : "You've sent the most questions allowed."}
          className="w-full resize-none rounded-xl border border-line-strong px-4 py-3 text-lg leading-snug"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-ink-soft">
            {left > 0 ? `You can send ${left} more. Nobody sees your name.` : "Nobody sees your name."}
          </span>
          <button type="submit" disabled={disabled || !clean || sending || left <= 0} className="key shrink-0 rounded-xl bg-primary px-5 py-3 font-bold text-white">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        <p aria-live="polite" className={`min-h-4 text-xs font-semibold ${note?.bad ? "text-error" : "text-ink-soft"}`}>
          {note?.text ?? ""}
        </p>
      </form>

      <div className="border-t border-line px-5 pt-4 pb-5">
        <h3 className="flex items-baseline justify-between text-sm font-bold">
          Questions from the room
          <span className="font-semibold text-ink-soft tabular-nums">{server === null ? "Loading…" : items.length}</span>
        </h3>
        {server !== null && items.length === 0 && <p className="mt-3 text-sm text-ink-soft">No questions yet. Be the first to ask.</p>}
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((q) => (
            <li key={q.id} className={`flex items-start gap-3 rounded-xl border border-line-strong p-3 ${q.answered ? "bg-canvas opacity-75" : "bg-white"}`}>
              <button
                type="button"
                onClick={() => toggleVote(q)}
                disabled={disabled || q.mine || q.answered}
                aria-pressed={q.voted}
                aria-label={q.mine ? `${q.votes} votes for your question` : `${q.voted ? "Take back your vote for" : "Vote for"} “${q.text}”, ${q.votes} votes`}
                className={`flex w-12 shrink-0 flex-col items-center rounded-lg border py-1.5 font-bold tabular-nums transition-colors ${
                  q.voted ? "border-primary bg-primary text-white" : "border-line-strong bg-white text-ink"
                } disabled:cursor-default`}
              >
                <span aria-hidden className="text-xs leading-none">▲</span>
                <span className="text-base leading-tight">{q.votes}</span>
              </button>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[15px] leading-snug font-semibold break-words">{q.text}</p>
                {(q.mine || q.answered) && (
                  <p className="mt-1 flex gap-1.5 text-[11px] font-bold">
                    {q.mine && <span className="rounded-full bg-lavender px-2 py-0.5">You asked this</span>}
                    {q.answered && <span className="rounded-full bg-mint px-2 py-0.5">Answered</span>}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!done && !disabled && (
          <p className="mt-4 text-center text-sm text-ink-soft">
            Nothing to ask?{" "}
            <button type="button" onClick={onSkip} className="font-bold text-ink underline underline-offset-2">
              Skip this one
            </button>
          </p>
        )}
      </div>
    </CardShell>
  );
}
