"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ToBody } from "./Portal";

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  /** If set, the user must type this exact word to enable the confirm button. */
  typeToConfirm?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-page modal confirm (no window.confirm). */
export function ConfirmDialog(p: Props) {
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(p.onCancel);
  useEffect(() => {
    onCancelRef.current = p.onCancel;
  });
  const onCancel = () => onCancelRef.current();

  useEffect(() => {
    (p.typeToConfirm ? inputRef.current : cancelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.typeToConfirm]);

  const ok = !p.typeToConfirm || typed === p.typeToConfirm;

  return (
    <ToBody>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onMouseDown={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="slab w-full max-w-md rounded-xl bg-white p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="font-display text-2xl font-semibold">
          {p.title}
        </h2>
        <p className="mt-2 text-ink-soft">{p.body}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ok && !p.busy) p.onConfirm();
          }}
        >
          {p.typeToConfirm && (
            <label className="mt-4 block text-sm font-semibold">
              Type <span className="font-mono font-bold">{p.typeToConfirm}</span> to confirm
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 text-lg font-bold"
              />
            </label>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button ref={cancelRef} type="button" onClick={onCancel} className="key rounded-lg bg-white px-4 py-2 font-bold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!ok || p.busy}
              className={`key rounded-lg px-4 py-2 font-bold text-white ${p.danger ? "bg-error" : "bg-primary"}`}
            >
              {p.busy ? "Working…" : p.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ToBody>
  );
}
