"use client";

import { useState } from "react";
import { readableOn, topicColor } from "@/lib/colors";
import type { TopicItem } from "@/lib/types";
import type { SaveStatus } from "@/lib/vote-queue";
import { haptic } from "../Burst";
import { CardShell, saveText } from "./CardShell";

interface Props {
  question: string;
  options: TopicItem[];
  color: string;
  /** Saved order (every option, first place first). */
  value: string[] | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  onRank: (order: string[]) => void;
}

/**
 * Put in order: tap options in the order you prefer them. Placed options can be moved
 * up or down or taken back out. The order is saved once every option has a place.
 */
export function RankCard({ question, options, color, value, status, disabled, onRank }: Props) {
  const [order, setOrder] = useState<string[]>(value ?? []);
  const byId = new Map(options.map((o, i) => [o.id, { o, i }]));
  const placed = order.filter((id) => byId.has(id));
  const left = options.filter((o) => !placed.includes(o.id));
  const complete = left.length === 0;

  function change(next: string[]) {
    setOrder(next);
    if (next.length === options.length) onRank(next);
  }
  const place = (id: string) => {
    haptic();
    change([...placed, id]);
  };
  const move = (from: number, to: number) => {
    const next = [...placed];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    change(next);
  };

  return (
    <CardShell id="rank-q" color={color} how="Put these in order, best first" question={question}>
      <div className="flex flex-col gap-4 p-5">
        {placed.length > 0 && (
          <ol aria-label="Your order" className="flex flex-col gap-2">
            {placed.map((id, pos) => {
              const { o, i } = byId.get(id)!;
              const c = topicColor(i);
              return (
                <li
                  key={id}
                  className="animate-pop flex min-h-14 items-center gap-2 rounded-xl border border-line-strong py-1.5 pl-2 pr-1.5"
                  style={{ backgroundColor: c, color: readableOn(c) }}
                >
                  <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-semibold text-ink">
                    {pos + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-lg font-bold break-words">{o.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={disabled || pos === 0}
                      onClick={() => move(pos, pos - 1)}
                      aria-label={`Move ${o.name} up`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70 text-lg font-bold text-ink disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={disabled || pos === placed.length - 1}
                      onClick={() => move(pos, pos + 1)}
                      aria-label={`Move ${o.name} down`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70 text-lg font-bold text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setOrder(placed.filter((x) => x !== id))}
                      aria-label={`Take ${o.name} out`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/70 text-lg font-bold text-ink"
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {left.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold text-ink-soft">
              {placed.length === 0 ? "Tap your favourite first" : `Tap your number ${placed.length + 1}`}
            </p>
            <div className="flex flex-col gap-2">
              {left.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => place(o.id)}
                  className="key flex min-h-14 items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-lg font-bold"
                >
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-line-strong text-ink-soft">
                    +
                  </span>
                  <span className="min-w-0 flex-1 break-words">{o.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex min-h-4 items-center justify-between gap-3 text-xs font-semibold text-ink-soft" aria-live="polite">
          {placed.length > 0 ? (
            <button type="button" disabled={disabled} onClick={() => setOrder([])} className="rounded-md px-1 py-1 underline underline-offset-4">
              Start over
            </button>
          ) : (
            <span />
          )}
          <span>{complete ? saveText(status) : value ? "Place every option to save the new order." : `${placed.length} of ${options.length} placed`}</span>
        </div>
      </div>
    </CardShell>
  );
}
