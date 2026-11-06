"use client";

import { useEffect, useId, useRef, useState } from "react";
import { duplicateIndexes, filledItems, insertAfter, moveItem, pasteInto, removeAt, setAt } from "@/lib/list-edit";

interface Props {
  label: string;
  /** Singular noun for buttons and messages, e.g. "option". */
  noun: string;
  items: string[];
  onChange: (items: string[]) => void;
  max: number;
  maxLength: number;
  placeholders?: string[];
  hint?: string;
}

/** One input per row. Enter adds a row, Backspace on an empty row removes it, a multi-line paste fills several rows. */
export function ListEditor({ label, noun, items, onChange, max, maxLength, placeholders = [], hint }: Props) {
  const id = useId();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  }, [items]);

  const dupes = duplicateIndexes(items);
  const count = filledItems(items).length;
  const full = items.length >= max;
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  const plural = noun === "criterion" ? "criteria" : `${noun}s`;

  function change(next: string[], focus?: number) {
    if (focus !== undefined) focusNext.current = focus;
    setNote(null);
    onChange(next);
  }

  function add(after: number) {
    if (full) return setNote(`That's the most: ${max} ${plural}.`);
    change(insertAfter(items, after, max), after + 1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      // an empty row already waiting below: go there instead of adding another
      if (items[i + 1] === "") inputs.current[i + 1]?.focus();
      else add(i);
    } else if (e.key === "Backspace" && items[i] === "" && items.length > 1) {
      e.preventDefault();
      change(removeAt(items, i), Math.max(0, i - 1));
    } else if (e.key === "ArrowDown" && i < items.length - 1) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
    } else if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>, i: number) {
    const result = pasteInto(items, i, e.clipboardData.getData("text"), max);
    if (!result) return;
    e.preventDefault();
    change(result.items, result.focus);
    if (result.dropped) setNote(`${result.dropped} pasted ${result.dropped === 1 ? "line" : "lines"} didn't fit (max ${max}).`);
  }

  const iconButton =
    "grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-25";

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="mt-3">
      <div className="flex items-baseline justify-between text-sm">
        <span id={`${id}-label`} className="font-semibold">
          {label}
        </span>
        <span className="tabular-nums text-ink-soft">
          {count}/{max}
        </span>
      </div>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}

      <ol className="mt-1.5 flex flex-col gap-1.5">
        {items.map((value, i) => {
          const dupe = dupes.has(i);
          return (
            <li key={i} className="animate-fade group flex flex-wrap items-center gap-x-1 sm:flex-nowrap">
              <label htmlFor={`${id}-${i}`} className="w-full text-xs font-medium text-ink-soft sm:w-[5.75rem] sm:shrink-0 sm:text-sm">
                {Noun} {i + 1}
              </label>
              <input
                id={`${id}-${i}`}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={value}
                onChange={(e) => change(setAt(items, i, e.target.value))}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPaste={(e) => onPaste(e, i)}
                maxLength={maxLength}
                placeholder={placeholders[i] ? `e.g. ${placeholders[i]}` : undefined}
                aria-invalid={dupe || undefined}
                aria-describedby={dupe ? `${id}-dupe-${i}` : undefined}
                enterKeyHint={full ? "done" : "next"}
                className={`min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base ${
                  dupe ? "border-error" : "border-line-strong"
                }`}
              />
              <span className="flex opacity-100 sm:opacity-40 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <button type="button" className={`${iconButton} max-sm:hidden`} disabled={i === 0} onClick={() => change(moveItem(items, i, -1), i - 1)} aria-label={`Move ${noun} ${i + 1} up`}>
                  <Chevron up />
                </button>
                <button
                  type="button"
                  className={`${iconButton} max-sm:hidden`}
                  disabled={i === items.length - 1}
                  onClick={() => change(moveItem(items, i, 1), i + 1)}
                  aria-label={`Move ${noun} ${i + 1} down`}
                >
                  <Chevron />
                </button>
                <button
                  type="button"
                  className={`${iconButton} hover:!text-error`}
                  disabled={items.length === 1 && value === ""}
                  onClick={() => change(removeAt(items, i), Math.min(i, items.length - 2))}
                  aria-label={`Remove ${noun} ${i + 1}`}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
              {dupe && (
                <span id={`${id}-dupe-${i}`} className="sr-only">
                  Same as an earlier {noun}.
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {dupes.size > 0 && <p className="mt-1 sm:pl-[6rem] text-xs font-semibold text-error">Each {noun} must be different. Change or remove the one in red.</p>}

      <button
        type="button"
        onClick={() => add(items.length - 1)}
        disabled={full}
        className="-ml-2 mt-1.5 sm:ml-[5.5rem] rounded-lg px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-40"
      >
        + Add {noun}
      </button>
      <span className="ml-2 hidden text-xs text-ink-soft sm:inline">Enter adds the next one. Pasting several lines fills several rows.</span>
      {note && (
        <p role="status" className="mt-1 sm:pl-[6rem] text-xs font-semibold text-ink-soft">
          {note}
        </p>
      )}
    </div>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden style={up ? { transform: "rotate(180deg)" } : undefined}>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
