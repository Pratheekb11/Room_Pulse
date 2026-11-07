"use client";

import { useEffect, useRef } from "react";

import { topicColor } from "@/lib/colors";
import { THEMES, getTheme, themeStyle, type ThemeId } from "@/lib/themes";

/** A small slide drawn in a design's own colours and headline type. */
function Swatch({ id, title }: { id: ThemeId; title: string }) {
  return (
    <span
      aria-hidden
      style={themeStyle(id)}
      className="flex aspect-[16/10] w-full flex-col justify-between gap-1 theme-pattern overflow-hidden rounded-md border border-line bg-canvas p-1.5 text-left text-ink sm:p-2"
    >
      <span className="font-display block truncate text-[13px] leading-tight sm:text-[15px]">{title || "Aa"}</span>
      <span className="flex flex-col gap-0.5 sm:gap-1">
        {[78, 52, 30].map((w, i) => (
          <span key={w} className="block h-1 rounded-full sm:h-1.5" style={{ width: `${w}%`, backgroundColor: i === 0 ? "var(--color-primary)" : topicColor(i) }} />
        ))}
      </span>
    </span>
  );
}

/**
 * Slide design choice: one tile per design, the recommended one marked.
 * `compact` is the one-row strip used inside the preview.
 */
export function ThemePicker({
  value,
  onChange,
  recommended,
  title = "",
  compact = false,
}: {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
  recommended: { id: ThemeId; reason: string };
  title?: string;
  compact?: boolean;
}) {
  const rec = getTheme(recommended.id);
  const row = useRef<HTMLDivElement>(null);
  // In the scrolling row, keep the picked design in view (it may be far along on a phone).
  useEffect(() => {
    if (!compact || !row.current) return;
    const el = row.current.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el) return;
    const r = row.current;
    const left = el.offsetLeft - r.offsetLeft;
    if (left < r.scrollLeft || left + el.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollTo({ left: left - 8, behavior: "instant" as ScrollBehavior });
  }, [compact, value]);
  return (
    <div>
      <div
        ref={row}
        role="radiogroup"
        aria-label="Slide design"
        className={compact ? "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" : "grid grid-cols-3 gap-1.5 sm:grid-cols-5 sm:gap-2"}
      >
        {THEMES.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(t.id)}
              title={t.blurb}
              className={`flex flex-col gap-1.5 rounded-lg border bg-white p-1.5 text-left ${compact ? "w-32 shrink-0" : ""} ${
                on ? "border-ink ring-2 ring-ink" : "border-line-strong hover:border-ink"
              }`}
            >
              <Swatch id={t.id} title={title} />
              <span className="flex flex-col px-0.5 leading-tight">
                <span className="truncate text-sm font-bold">{t.label}</span>
                {t.id === recommended.id ? (
                  <span className="truncate text-[11px] font-bold text-primary-active">★ Best fit</span>
                ) : (
                  <span className="truncate text-[11px] text-ink-soft">{t.style}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
          <span className="font-semibold text-ink">Recommended: {rec.label}.</span> {recommended.reason}{" "}
          {value !== recommended.id && (
            <button type="button" onClick={() => onChange(recommended.id)} className="font-semibold text-ink underline underline-offset-4">
              Use {rec.label}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
