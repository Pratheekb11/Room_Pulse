"use client";

import { useState } from "react";
import { readableOn, topicColor } from "@/lib/colors";
import type { TopicItem } from "@/lib/types";
import type { SaveStatus } from "@/lib/vote-queue";
import { Burst, haptic } from "../Burst";
import { CardShell, saveText } from "./CardShell";

interface Props {
  question: string;
  options: TopicItem[];
  color: string;
  /** null = any number */
  maxPicks: number | null;
  value: string[] | undefined;
  status: SaveStatus | undefined;
  disabled: boolean;
  finished: boolean;
  onChange: (ids: string[]) => void;
  onFinish: () => void;
}

/** Pick several: tap tiles to tick them, up to the limit. */
export function MultiCard({ question, options, color, maxPicks, value, status, disabled, finished, onChange, onFinish }: Props) {
  const picked = value ?? [];
  const limit = maxPicks ?? options.length;
  const full = picked.length >= limit;
  const [burst, setBurst] = useState<{ id: string; key: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function toggle(id: string) {
    if (picked.includes(id)) {
      setNote(null);
      // keep the presenter's option order, whatever order they were tapped in
      onChange(picked.filter((x) => x !== id));
      return;
    }
    if (full) {
      setNote(`You can pick ${limit}. Tap one of your picks to swap it.`);
      return;
    }
    haptic();
    setNote(null);
    setBurst({ id, key: (burst?.key ?? 0) + 1 });
    onChange(options.map((o) => o.id).filter((x) => x === id || picked.includes(x)));
  }

  const how = maxPicks && maxPicks < options.length ? `Pick up to ${maxPicks}` : "Pick as many as you like";

  return (
    <CardShell id="multi-q" color={color} how={how} question={question}>
      <div role="group" aria-labelledby="multi-q" className="flex flex-col gap-3 p-5">
        {options.map((o, i) => {
          const selected = picked.includes(o.id);
          const c = topicColor(i);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => toggle(o.id)}
              className={`key relative flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-lg font-bold ${
                selected ? "animate-pop" : "bg-white"
              } ${full && !selected ? "opacity-50" : ""}`}
              style={selected ? { backgroundColor: c, color: readableOn(c) } : undefined}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-ink text-base"
                style={{ backgroundColor: selected ? "white" : "transparent" }}
              >
                {selected ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1 break-words">{o.name}</span>
              {burst?.id === o.id && <Burst key={burst.key} color={c} />}
            </button>
          );
        })}

        {picked.length > 0 && !finished && !full && (
          <button type="button" onClick={onFinish} disabled={disabled} className="key mt-1 w-full rounded-lg bg-ink py-3 font-bold text-white">
            Done
          </button>
        )}
        <p aria-live="polite" className="flex min-h-4 justify-between gap-3 text-xs font-semibold text-ink-soft">
          <span>{note ?? `${picked.length} picked${maxPicks && maxPicks < options.length ? ` of ${maxPicks}` : ""}`}</span>
          <span>{saveText(status)}</span>
        </p>
      </div>
    </CardShell>
  );
}
