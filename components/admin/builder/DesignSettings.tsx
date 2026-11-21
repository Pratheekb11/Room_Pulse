"use client";

import { useEffect, useRef } from "react";
import type { ThemeId } from "@/lib/themes";
import { ToBody } from "../../Portal";
import { ThemePicker } from "../ThemePicker";

/** The slide design and the presentation-wide settings, in one panel opened from the builder's top bar. */
export function DesignSettings({
  theme,
  onTheme,
  recommended,
  title,
  decor,
  setDecor,
  showResults,
  setShowResults,
  named,
  setNamed,
  onClose,
}: {
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  recommended: { id: ThemeId; reason: string };
  title: string;
  decor: boolean;
  setDecor: (on: boolean) => void;
  /** Only when creating: once made, it's changed from the presentation's card. */
  showResults: boolean | null;
  setShowResults: (on: boolean) => void;
  named: boolean;
  setNamed: (on: boolean) => void;
  onClose: () => void;
}) {
  const done = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    done.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const check = "mt-0.5 h-5 w-5 shrink-0 accent-ink";
  return (
    <ToBody>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="design-h"
          className="slab max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-6"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="design-h" className="font-display text-2xl">
              Design &amp; settings
            </h2>
            <button ref={done} type="button" onClick={onClose} className="key rounded-lg bg-white px-4 py-1.5 font-bold">
              Done
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Colours and lettering on the big screen and on people&rsquo;s phones.</p>
          <div className="mt-3">
            <ThemePicker value={theme} onChange={onTheme} recommended={recommended} title={title} />
          </div>
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 text-sm">
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={decor} onChange={(e) => setDecor(e.target.checked)} className={check} />
              <span>
                <span className="font-semibold">Fun illustrations</span>
                <span className="block text-ink-soft">Cheerful doodle characters next to the title on the big screen and on phones, picked to match the design.</span>
              </span>
            </label>
            {showResults !== null && (
              <label className="flex items-start gap-2.5">
                <input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} className={check} />
                <span>
                  <span className="font-semibold">Show results on phones</span>
                  <span className="block text-ink-soft">People can watch the results live on their own phones, without any presenter controls. You can change this later.</span>
                </span>
              </label>
            )}
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={named} onChange={(e) => setNamed(e.target.checked)} className={check} />
              <span>
                <span className="font-semibold">Show who answered (names)</span>
                <span className="block text-ink-soft">
                  Phones ask for a name once, and the results show who picked each option. Good for team activities; leave it off to keep answers anonymous.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </ToBody>
  );
}
