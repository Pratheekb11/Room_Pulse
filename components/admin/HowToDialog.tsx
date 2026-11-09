"use client";

import { useEffect, useId, useRef } from "react";
import type { QuestionKind } from "@/lib/types";
import { HowToDemo } from "../HowToDemo";
import { ToBody } from "../Portal";

/** "Show me how" from the builder: the walkthrough in a dialog, starting on the type being edited. */
export function HowToDialog({ kind, onClose }: { kind: QuestionKind; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToBody>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-4" onMouseDown={() => onCloseRef.current()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="slab max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-2xl font-semibold">
            How to make a question
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="key rounded-lg bg-white px-3 py-1.5 text-sm font-bold">
            Close
          </button>
        </div>
        <HowToDemo initial={kind} compact />
      </div>
    </div>
    </ToBody>
  );
}
