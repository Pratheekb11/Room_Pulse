"use client";

import { useState } from "react";
import { boardInfo, MAX_AUTHOR, type BoardId } from "@/lib/boards";
import { tinted } from "@/lib/colors";
import { MAX_TEXT_ANSWER } from "@/lib/validation";
import type { SaveStatus } from "@/lib/vote-queue";
import { haptic } from "../Burst";
import { CardShell, saveText } from "./CardShell";

interface Props {
  question: string;
  color: string;
  value: string | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  /** Board questions (team activities): the answer becomes a leaf, note or star, and may be signed. */
  board?: BoardId | null;
  /** The name this person signed with last time (one name for the whole presentation). */
  author?: string;
  /** Live results on phones: where to watch the board fill up. */
  seeHref?: string;
  onSend: (text: string, author: string) => void;
}

const PAPER: Record<BoardId, string> = { tree: "#e3f2cf", wall: "#fff4b8", sky: "#e6e9fb" };
const WHERE: Record<BoardId, string> = { tree: "the tree", wall: "the wall", sky: "the sky" };
const tidy = (s: string) => s.trim().replace(/\s+/g, " ");

/** Open answer: one short answer in the voter's own words. They can change it later. */
export function TextCard({ question, color, value, status, disabled, board = null, author = "", seeHref, onSend }: Props) {
  const [draft, setDraft] = useState(value ?? "");
  const [name, setName] = useState(author);
  const clean = tidy(draft);
  const cleanName = tidy(name);
  const unchanged = value !== undefined && clean === value && (!board || cleanName === tidy(author));
  const left = MAX_TEXT_ANSWER - draft.length;
  const piece = board ? boardInfo(board).piece : null;

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!clean || unchanged) return;
    haptic();
    onSend(clean, board ? cleanName : "");
  }

  const how = board === "wall" ? "Write your sticky note" : piece ? `Write your ${piece}` : "Write your answer";
  const hint = board
    ? `Your ${piece} goes on ${WHERE[board]} for everyone to see.${cleanName ? "" : " Unsigned, nobody will know it's yours."}`
    : "Your answer is anonymous.";

  return (
    <CardShell id="text-q" color={color} how={how} question={question}>
      <form onSubmit={send} className="flex flex-col gap-3 p-5">
        <label htmlFor="text-answer" className="sr-only">
          {board ? `Your ${piece}` : "Your answer"}
        </label>
        <textarea
          id="text-answer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_TEXT_ANSWER}
          rows={4}
          disabled={disabled}
          placeholder="Type here…"
          className={`w-full resize-none border border-line-strong px-4 py-3 text-lg leading-snug ${board === "tree" ? "rounded-[2.2rem_0.5rem]" : "rounded-xl"}`}
          style={board ? { background: tinted(PAPER[board]), color: "#26251e" } : undefined}
        />
        {board && (
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
        )}
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs font-semibold tabular-nums ${left < 20 ? "text-error" : "text-ink-soft"}`}>{left} left</span>
          <button type="submit" disabled={disabled || !clean || unchanged} className="key rounded-xl bg-primary px-6 py-3 font-bold text-white">
            {value === undefined ? (board ? `Add my ${piece}` : "Send") : "Update"}
          </button>
        </div>
        <p aria-live="polite" className="min-h-4 text-right text-xs font-semibold text-ink-soft">
          {saveText(status) || (value !== undefined ? "Sent. You can change it until voting closes." : hint)}
        </p>
        {board && value !== undefined && seeHref && (
          <a href={seeHref} className="self-center rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-bold hover:bg-canvas">
            See {WHERE[board]} →
          </a>
        )}
      </form>
    </CardShell>
  );
}
