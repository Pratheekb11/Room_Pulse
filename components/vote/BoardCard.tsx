"use client";

import { useState } from "react";
import { boardInfo, MAX_AUTHOR, MAX_LEAVES, type BoardId } from "@/lib/boards";
import { tinted } from "@/lib/colors";
import { MAX_TEXT_ANSWER } from "@/lib/validation";
import { haptic } from "../Burst";
import type { SaveStatus } from "@/lib/vote-queue";
import { CardShell, saveText } from "./CardShell";

interface Props {
  question: string;
  color: string;
  board: BoardId;
  /** This person's leaves by slot; "" = an empty slot (never written, or taken back). */
  leaves: string[];
  /** Save state of their leaves. */
  status?: SaveStatus;
  disabled: boolean;
  /** The name this person signed with last time (one name for the whole presentation). */
  author?: string;
  /** Live results on phones: where to watch the board fill up. */
  seeHref?: string;
  onSave: (slot: number, text: string, author: string) => void;
  onRemove: (slot: number) => void;
}

const PAPER: Record<BoardId, string> = { tree: "#e3f2cf", wall: "#fff4b8", sky: "#e6e9fb" };
const WHERE: Record<BoardId, string> = { tree: "the tree", wall: "the wall", sky: "the sky" };
const ON: Record<BoardId, string> = { tree: "on the tree", wall: "on the wall", sky: "in the sky" };
const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
const plural = (piece: string) => (piece === "leaf" ? "leaves" : `${piece}s`);

/**
 * A team activity's board on the phone: each person can add several leaves (notes, stars),
 * change one, or take one back, and may sign them with a name.
 */
export function BoardCard({ question, color, board, leaves, status, disabled, author = "", seeHref, onSave, onRemove }: Props) {
  const piece = boardInfo(board).piece;
  const pieces = plural(piece);
  const mine = leaves.map((text, slot) => ({ text, slot })).filter((l) => l.text);
  const freeSlot = Array.from({ length: MAX_LEAVES }, (_, i) => i).find((i) => !leaves[i]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState(author);
  const clean = tidy(draft);
  const target = editing ?? freeSlot;
  const full = editing === null && freeSlot === undefined;
  const left = MAX_TEXT_ANSWER - draft.length;
  const label = board === "wall" ? "sticky note" : piece;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!clean || target === undefined || disabled) return;
    haptic();
    onSave(target, clean, tidy(name));
    setDraft("");
    setEditing(null);
  }

  return (
    <CardShell id="text-q" color={color} how={`Write your ${label}`} question={question}>
      <div className="flex flex-col gap-4 p-5">
        {mine.length > 0 && (
          <section aria-labelledby="mine-h">
            <h3 id="mine-h" className="text-sm font-bold text-ink-soft">
              Your {pieces} ({mine.length} of {MAX_LEAVES})
            </h3>
            <ul className="mt-2 flex flex-col gap-2">
              {mine.map((l) => (
                <li
                  key={l.slot}
                  className={`flex items-start justify-between gap-2 border border-line-strong px-3 py-2 ${board === "tree" ? "rounded-[1.4rem_0.4rem]" : "rounded-lg"} ${editing === l.slot ? "ring-2 ring-primary" : ""}`}
                  style={{ background: tinted(PAPER[board]), color: "#26251e" }}
                >
                  <span className="min-w-0 py-1 font-semibold [overflow-wrap:anywhere]">{l.text}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setEditing(l.slot);
                        setDraft(l.text);
                        requestAnimationFrame(() => document.getElementById("text-answer")?.focus());
                      }}
                      aria-label={`Change ${piece}: ${l.text}`}
                      className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-xs font-bold"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        if (editing === l.slot) {
                          setEditing(null);
                          setDraft("");
                        }
                        onRemove(l.slot);
                      }}
                      aria-label={`Take back ${piece}: ${l.text}`}
                      className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-xs font-bold"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {full ? (
          <p className="rounded-lg bg-canvas px-3 py-2 text-sm">
            That&rsquo;s {MAX_LEAVES} {pieces}, the most each person can add. Change or remove one to add something else.
          </p>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-3">
            <label htmlFor="text-answer" className="sr-only">
              {editing === null ? `Your ${mine.length ? "next " : ""}${piece}` : `Change your ${piece}`}
            </label>
            <textarea
              id="text-answer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_TEXT_ANSWER}
              rows={3}
              disabled={disabled}
              placeholder={mine.length ? `Another ${piece}…` : "Type here…"}
              className={`w-full resize-none border border-line-strong px-4 py-3 text-lg leading-snug ${board === "tree" ? "rounded-[2.2rem_0.5rem]" : "rounded-xl"}`}
              style={{ background: tinted(PAPER[board]), color: "#26251e" }}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="text-author" className="text-sm font-bold text-ink-soft">
                Sign it (optional)
              </label>
              <input
                id="text-author"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_AUTHOR}
                disabled={disabled}
                autoComplete="given-name"
                placeholder="Your name"
                className="w-full rounded-xl border border-line-strong px-4 py-2.5 text-base"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={`text-xs font-semibold tabular-nums ${left < 20 ? "text-error" : "text-ink-soft"}`}>{left} left</span>
              <span className="flex gap-2">
                {editing !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setDraft("");
                    }}
                    className="rounded-xl border border-line-strong bg-white px-4 py-3 font-bold"
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={disabled || !clean} className="key rounded-xl bg-primary px-6 py-3 font-bold text-white">
                  {editing !== null ? "Save" : mine.length ? `Add another ${piece}` : `Add my ${piece}`}
                </button>
              </span>
            </div>
            <p className="text-right text-xs font-semibold text-ink-soft">
              {`Your ${piece} goes ${ON[board]} for everyone to see.`}
              {tidy(name) ? "" : " Unsigned, nobody will know it's yours."}
              {mine.length === 0 ? ` You can add up to ${MAX_LEAVES} ${pieces}.` : ""}
            </p>
          </form>
        )}

        {saveText(status) && (
          <p aria-live="polite" className="text-right text-xs font-semibold text-ink-soft">
            {saveText(status)}
          </p>
        )}
        {mine.length > 0 && seeHref && (
          <a href={seeHref} className="self-center rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-bold hover:bg-canvas">
            See {WHERE[board]} →
          </a>
        )}
      </div>
    </CardShell>
  );
}
