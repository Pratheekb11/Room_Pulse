"use client";

import { kindLabel } from "@/lib/kinds";
import { railLabel, type QuestionDraft } from "@/lib/builder";
import { topicColor } from "@/lib/colors";
import { KindIcon } from "./KindIcon";

/**
 * The list of questions: tap one to edit it, move it up or down, add another. On a laptop it's a column of its
 * own beside the editor; on a phone the editor opens in place under the selected question (`renderSelected`).
 */
export function QuestionRail({
  questions,
  selected,
  problems,
  showProblems,
  onSelect,
  onMove,
  onAdd,
  max,
  renderSelected,
}: {
  questions: QuestionDraft[];
  selected: number;
  problems: Map<number, string[]>;
  /** Mark questions with problems (after a first try to create). */
  showProblems: boolean;
  onSelect: (key: number) => void;
  onMove: (key: number, by: -1 | 1) => void;
  onAdd: () => void;
  max: number;
  renderSelected?: (q: QuestionDraft, index: number) => React.ReactNode;
}) {
  const arrow = "grid h-8 w-8 place-items-center rounded-md text-ink-soft hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-25";
  return (
    <nav aria-label="Questions" className="min-w-0">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Questions</h3>
        <span className="text-sm text-ink-soft tabular-nums">
          {questions.length} of {max}
        </span>
      </div>
      <ol className="mt-2 flex flex-col gap-1.5">
        {questions.map((q, i) => {
          const on = q.key === selected;
          const bad = showProblems && (problems.get(q.key)?.length ?? 0) > 0;
          const open = on && renderSelected;
          return (
            <li
              key={q.key}
              className={`enter group rounded-xl border transition-colors duration-150 ${on ? "border-ink bg-white" : "border-line bg-white hover:border-line-strong"}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => onSelect(q.key)}
                  aria-current={on ? "true" : undefined}
                  aria-expanded={renderSelected ? on : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-2.5 pl-2.5 text-left"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums"
                    style={{ boxShadow: `inset 0 -3px 0 ${topicColor(i)}`, background: "var(--color-canvas)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-semibold ${q.name.trim() ? "" : "text-ink-soft"}`}>{railLabel(q)}</span>
                    <span className="flex items-center gap-1 text-xs text-ink-soft">
                      <KindIcon kind={q.kind} className="h-3.5 w-3.5" />
                      {kindLabel(q.kind)}
                    </span>
                  </span>
                  {bad && (
                    <span className="shrink-0 rounded-full bg-error px-1.5 text-xs font-bold text-white" aria-label="Needs fixing">
                      !
                    </span>
                  )}
                </button>
                {questions.length > 1 && (
                  <span className={`flex flex-col ${on ? "" : "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"}`}>
                    <button type="button" className={arrow} disabled={i === 0} onClick={() => onMove(q.key, -1)} aria-label={`Move question ${i + 1} up`}>
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                        <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button type="button" className={arrow} disabled={i === questions.length - 1} onClick={() => onMove(q.key, 1)} aria-label={`Move question ${i + 1} down`}>
                      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
              {open && <div className="border-t border-line px-3 pb-4 pt-3">{renderSelected(q, i)}</div>}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onAdd}
        disabled={questions.length >= max}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong py-3 font-bold transition-colors duration-150 hover:border-ink hover:bg-canvas disabled:opacity-40"
      >
        <span aria-hidden className="text-lg leading-none">+</span> Add question
      </button>
    </nav>
  );
}
