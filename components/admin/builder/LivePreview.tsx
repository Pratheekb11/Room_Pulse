"use client";

import { useState } from "react";
import { getTheme, themeStyle, type ThemeId } from "@/lib/themes";
import type { PreviewQuestion } from "@/lib/preview";
import type { SessionInfo } from "@/lib/types";
import { PhoneSlide, ScreenSlide } from "../PresentationPreview";

/**
 * The question being edited, live, as people will see it: the real phone page or the real big screen, in the
 * chosen design. Changes as you type. Taps aren't saved.
 */
export function LivePreview({
  title,
  questions,
  selected,
  onPick,
  theme,
  decor,
  criteria,
  scaleMax,
  lowLabel,
  highLabel,
  onOpenFull,
  onDesign,
}: {
  title: string;
  questions: PreviewQuestion[];
  /** The question being edited (its place in the list). */
  selected: number;
  onPick: (i: number) => void;
  theme: ThemeId;
  decor: boolean;
  criteria: string[];
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  onOpenFull: () => void;
  onDesign: () => void;
}) {
  const [device, setDevice] = useState<"phone" | "screen">("phone");
  const session: SessionInfo = { code: "preview", title, scaleMax, lowLabel: lowLabel || "Low", highLabel: highLabel || "High", isOpen: true, revision: 0, theme, decor };
  const crit = (criteria.length ? criteria : ["Score"]).map((name, n) => ({ id: `c${n}`, name }));
  const index = Math.min(selected, questions.length - 1);

  return (
    <aside aria-label="Live preview" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Live preview</h3>
        <div role="tablist" aria-label="Show on" className="flex rounded-full border border-line-strong p-0.5 text-sm font-semibold">
          {(["phone", "screen"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={device === d}
              onClick={() => setDevice(d)}
              className={`rounded-full px-3 py-0.5 transition-colors duration-150 ${device === d ? "bg-ink text-white" : "hover:bg-canvas"}`}
            >
              {d === "phone" ? "Phone" : "Big screen"}
            </button>
          ))}
        </div>
      </div>

      <div style={themeStyle(theme)} className="mt-2 text-ink">
        {device === "phone" ? (
          <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[1.75rem] border-[5px] border-[#26251e] bg-canvas">
            <div className="theme-pattern h-[min(600px,calc(100dvh-15rem))] min-h-[24rem] overflow-y-auto">
              <PhoneSlide key={`${theme}-${index}`} title={title} questions={questions} index={index} onPick={onPick} session={session} criteria={crit} />
            </div>
          </div>
        ) : (
          <ScreenSlide title={title} questions={questions} index={index} onPick={onPick} session={session} />
        )}
      </div>

      <p className="mt-2 text-center text-xs text-ink-soft">{device === "phone" ? "Try it: taps here aren't saved." : "Sample results. Real answers replace them."}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm font-semibold">
        <button type="button" onClick={onDesign} className="underline underline-offset-4">
          Design: {getTheme(theme).label}
        </button>
        <button type="button" onClick={onOpenFull} className="underline underline-offset-4">
          Full-screen preview
        </button>
      </div>
    </aside>
  );
}
