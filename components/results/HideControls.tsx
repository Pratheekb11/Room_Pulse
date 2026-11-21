"use client";

import { useState } from "react";
import { wordWeights } from "@/lib/answers";
import type { LeaderRow, WordCount } from "@/lib/types";
import { WordCloud, WordList } from "../WordCloud";
import { Leaderboard } from "./QuizResults";

const pill = "rounded-full border border-line-strong bg-white px-3 py-1 text-[clamp(0.8rem,0.9vw,1rem)] font-bold hover:bg-canvas";

/** Owner change sent to the server; shown at once, undone if it doesn't save. */
function useOptimistic(send: (key: string, hidden: boolean) => Promise<Response>) {
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  async function set(key: string, hidden: boolean) {
    setChanges((m) => ({ ...m, [key]: hidden }));
    setError(null);
    try {
      const res = await send(key, hidden);
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setChanges((m) => {
        const next = { ...m };
        delete next[key];
        return next;
      });
      setError("That change didn't save. Try again.");
    }
  }
  return { changes, error, set };
}

const patch = (url: string, method: "PATCH" | "POST", body: object) =>
  fetch(url, { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="mb-3 text-sm font-semibold text-error">
      {text}
    </p>
  ) : null;
}

/**
 * A word cloud (or ranked list) on the presenter's screen. The owner can hide a word: it leaves the
 * big screen and phones, and stays in the "Hidden" list to bring back (exports mark it hidden).
 */
export function WordsResults({ code, words, focusId, view, owner }: { code: string; words: WordCount[]; focusId: string; view: "cloud" | "list"; owner: boolean }) {
  const { changes, error, set } = useOptimistic((word, hidden) =>
    patch(`/api/admin/sessions/${encodeURIComponent(code)}/words`, "PATCH", { focusId, word, hidden }),
  );
  const [open, setOpen] = useState(false);
  const merged = words.map((w) => (w.focusId === focusId && w.word in changes ? { ...w, hidden: changes[w.word] } : w));
  const shown = wordWeights(merged, focusId);
  const hidden = merged.filter((w) => w.focusId === focusId && w.hidden);

  return (
    <div>
      <ErrorLine text={error} />
      {view === "list" ? <WordList words={shown} /> : <WordCloud words={shown} />}
      {owner && (shown.length > 0 || hidden.length > 0) && (
        <div className="mt-5 border-t border-line pt-4">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-bold text-ink-soft underline underline-offset-2">
            {open ? "Close" : "Hide a word"}
            {hidden.length > 0 ? ` (${hidden.length} hidden)` : ""}
          </button>
          {open && (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Words on the screen">
              {shown.map((w) => (
                <li key={w.word}>
                  <button type="button" className={pill} onClick={() => void set(w.word, true)} aria-label={`Hide the word ${w.word}`}>
                    {w.word} · Hide
                  </button>
                </li>
              ))}
              {hidden.map((w) => (
                <li key={w.word}>
                  <button
                    type="button"
                    className={`${pill} border-dashed text-ink-soft`}
                    onClick={() => void set(w.word, false)}
                    aria-label={`Show the word ${w.word} again`}
                  >
                    {w.word} · Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** The quiz leaderboard. The owner can hide a player (say, a rude nickname) and bring them back. */
export function LeaderboardResults({
  code,
  rows,
  hiddenPlayers,
  owner,
}: {
  code: string;
  rows: LeaderRow[];
  hiddenPlayers: { id: string; nickname: string }[];
  owner: boolean;
}) {
  const { changes, error, set } = useOptimistic((id, hidden) =>
    patch(`/api/admin/sessions/${encodeURIComponent(code)}/quiz`, "POST", { action: hidden ? "hide_player" : "show_player", id }),
  );
  const [open, setOpen] = useState(false);
  const shown = rows.filter((p) => !(p.id && changes[p.id] === true));
  const hidden = [
    ...hiddenPlayers.filter((p) => changes[p.id] !== false),
    ...rows.filter((p): p is LeaderRow & { id: string } => Boolean(p.id && changes[p.id] === true)),
  ];

  return (
    <div>
      <ErrorLine text={error} />
      <Leaderboard rows={shown} allHidden={hidden.length > 0} onHide={owner ? (id) => void set(id, true) : undefined} />
      {owner && hidden.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-bold text-ink-soft underline underline-offset-2">
            {open ? "Close" : "Show"} hidden players ({hidden.length})
          </button>
          {open && (
            <ul className="mt-3 flex flex-col gap-2">
              {hidden.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-line-strong p-3 text-ink-soft">
                  <span className="min-w-0 break-words">{p.nickname}</span>
                  <button type="button" className={pill} onClick={() => void set(p.id, false)}>
                    Show again
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
