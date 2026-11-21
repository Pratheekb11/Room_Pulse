"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GUEST_DAYS } from "@/lib/guest-rules";
import { ToBody } from "../Portal";

/**
 * The guest code, shown when it matters: after the first presentation is saved, and before logging out.
 * (Guests start building straight away; nothing asks them to write a code down before they've made anything.)
 */
export function GuestCodeCard({
  code,
  title,
  body = `Write it down. Type it on any phone or computer to get back to your presentations. They last ${GUEST_DAYS} days.`,
  primary,
  onPrimary,
  danger,
  secondary,
  onSecondary,
}: {
  code: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  primary: string;
  onPrimary: () => void;
  /** The primary action leaves (logging out). */
  danger?: boolean;
  secondary?: string;
  onSecondary?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(onSecondary ?? onPrimary);
  useEffect(() => {
    dismiss.current = onSecondary ?? onPrimary;
  });
  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  }

  return (
    <ToBody>
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/50 p-5">
        <div className="slab w-full max-w-sm rounded-xl bg-white p-6 text-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <h2 id={titleId} className="font-display text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{body}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-sun px-4 py-3">
            <span className="font-mono text-[clamp(1.8rem,8vw,2.25rem)] tracking-[0.08em] whitespace-nowrap" aria-label={`Guest code ${code.split("").join(" ")}`}>
              {code}
            </span>
            <button type="button" onClick={copy} className="rounded-lg border border-line-strong bg-white px-2.5 py-1 text-sm font-semibold">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            ref={primaryRef}
            type="button"
            onClick={onPrimary}
            className={`key mt-5 w-full rounded-lg py-3 text-lg font-semibold text-white ${danger ? "bg-error" : "bg-primary"}`}
          >
            {primary}
          </button>
          {secondary && onSecondary && (
            <button type="button" onClick={onSecondary} className="mt-3 w-full text-sm font-semibold underline underline-offset-4">
              {secondary}
            </button>
          )}
        </div>
      </div>
    </ToBody>
  );
}
