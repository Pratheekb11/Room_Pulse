"use client";

import { useEffect, useRef } from "react";
import { KIND_INFO } from "@/lib/kinds";
import { PRESETS } from "@/lib/presets";
import { topicColor } from "@/lib/colors";
import type { QuestionKind } from "@/lib/types";
import { KindIcon } from "./KindIcon";

export type TypeChoice = { kind: QuestionKind } | { preset: string };

/**
 * Pick the kind of question first: a two-column grid of square tiles, a coloured icon and a name each, so the
 * choice reads at a glance. The longer line about each kind is its tooltip and is read out by screen readers.
 */
export function TypePicker({
  title = "What kind of question?",
  current,
  onPick,
  onCancel,
}: {
  title?: string;
  /** The question's type now (when changing it). */
  current?: QuestionKind;
  onPick: (choice: TypeChoice) => void;
  onCancel?: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, []);
  const tile =
    "group flex min-h-[7.5rem] w-full flex-col items-center justify-center gap-2.5 rounded-xl border px-2 py-4 text-center transition-[border-color,background-color,transform] duration-150 hover:border-ink active:scale-[0.98] focus-visible:border-ink";

  return (
    <section aria-labelledby="type-picker-h" className="enter" onKeyDown={(e) => e.key === "Escape" && onCancel?.()}>
      <div className="flex items-center gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="-ml-2 shrink-0 rounded-lg px-2 py-1 font-semibold whitespace-nowrap hover:bg-canvas">
            ← Back
          </button>
        )}
        <h3 id="type-picker-h" className="font-display text-2xl">
          {title}
        </h3>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {KIND_INFO.map((k, i) => {
          const on = current === k.id;
          return (
            <li key={k.id}>
              <button
                ref={i === 0 ? first : undefined}
                type="button"
                title={k.hint}
                aria-describedby={`kind-hint-${k.id}`}
                aria-pressed={current ? on : undefined}
                onClick={() => onPick({ kind: k.id })}
                className={`${tile} ${on ? "border-ink bg-canvas" : "border-line-strong bg-white"}`}
              >
                <span style={{ color: topicColor(i) }}>
                  <KindIcon kind={k.id} className="h-8 w-8" />
                </span>
                <span className="font-semibold leading-tight">{k.label}</span>
                <span id={`kind-hint-${k.id}`} className="sr-only">
                  {k.hint}
                </span>
                {on && <span className="text-xs font-semibold text-ink-soft">Now</span>}
              </button>
            </li>
          );
        })}
        {PRESETS.map((p) => (
          <li key={p.id}>
            <button type="button" title={`A ready-made Pick one: ${p.options.join(", ")}.`} onClick={() => onPick({ preset: p.id })} className={`${tile} border-dashed border-line-strong bg-white`}>
              <span style={{ color: topicColor(KIND_INFO.length) }}>
                <KindIcon kind="yes-no" className="h-8 w-8" />
              </span>
              <span className="font-semibold leading-tight">{p.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
