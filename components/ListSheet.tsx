"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface SheetRow {
  key: string;
  label: string;
  /** Small text on the left, e.g. the question number or "✓". */
  mark: string;
  /** Small text after the label, e.g. "0/3". */
  note?: string;
  current: boolean;
  done?: boolean;
}

/**
 * A full-screen list to jump to a question: big rows, scrolls up and down, never sideways.
 * Esc or Close shuts it; picking a row picks and shuts it.
 */
export function ListSheet({
  title,
  rows,
  currentAttr,
  onPick,
  onClose,
}: {
  title: string;
  rows: SheetRow[];
  /** aria-current value for the current row ("page" on the big screen, "step" on the phone). */
  currentAttr: "page" | "step";
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const current = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    current.current?.focus();
    current.current?.scrollIntoView?.({ block: "center" });
    // capture, and stop it: the results screen's own Esc (back to all questions) must not fire too
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close.current();
    };
    window.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
    };
  }, []);

  const sheet = (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-canvas text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-line-strong px-4 py-3">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-full border border-line-strong bg-white px-4 py-1.5 text-sm font-bold">
          Close
        </button>
      </div>
      <ol className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-4">
        {rows.map((r, i) => (
          <li key={r.key}>
            <button
              ref={r.current ? current : undefined}
              type="button"
              onClick={() => {
                onPick(i);
                onClose();
              }}
              aria-current={r.current ? currentAttr : undefined}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-base font-bold ${
                r.current ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                  r.current ? "bg-white text-ink" : r.done ? "bg-mint text-ink" : "border border-line-strong"
                }`}
              >
                {r.mark}
              </span>
              <span className="min-w-0 flex-1 break-words">{r.label}</span>
              {r.note && <span className="shrink-0 text-sm font-semibold opacity-70">{r.note}</span>}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
  // On the body: a parent with a backdrop blur (the voter's sticky bar) would trap a fixed layer.
  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}

/** The button that opens the sheet: looks like a dropdown, says where you are. */
export function SheetButton({ kicker, label, className = "", onClick }: { kicker: string; label: string; className?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border border-line-strong bg-white px-3 py-2 text-left ${className}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-ink-soft">{kicker}</span>
        <span className="block truncate text-base font-bold">{label}</span>
      </span>
      <span aria-hidden className="shrink-0 text-lg leading-none text-ink-soft">
        ▾
      </span>
    </button>
  );
}
