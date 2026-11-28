"use client";

import { useState } from "react";
import { chartsFor, defaultChart } from "@/lib/charts";
import { BOARDS, MAX_LEAVES, MAX_LEAVES_LIMIT } from "@/lib/boards";
import { KIND_INFO } from "@/lib/kinds";
import { PRESETS } from "@/lib/presets";
import { EXAMPLES, LIST_COPY, QUIZ_TIMES, startRows, type OptionKind, type QuestionDraft } from "@/lib/builder";
import { filledItems, rowsForKind } from "@/lib/list-edit";
import { hasOptions, MAX_DESCRIPTION, MAX_ITEM_DESCRIPTION, MAX_TOPICS_PER_FOCUS } from "@/lib/validation";
import { ListEditor } from "../ListEditor";
import { PicturePicker } from "../PicturePicker";
import { KindIcon } from "./KindIcon";
import { ScoringSettings, type ScoringProps } from "./ScoringSettings";
import { TypePicker } from "./TypePicker";

export const field = "mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2";
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const chip = (on: boolean) => `rounded-full border border-line-strong px-3 py-1 text-sm font-bold ${on ? "bg-ink text-white" : "bg-white hover:bg-canvas"}`;

/**
 * One question at a time: its type, the question in a big box, its options, and only the settings it can't work
 * without. Everything else (description, picture, chart, how Score items are scored) waits under "More options".
 */
export function QuestionEditor({
  question: f,
  index: i,
  total,
  onChange: update,
  onRemove,
  onDuplicate,
  canDuplicate,
  answered,
  counts,
  problems,
  scoring,
  scoringNumber,
  scaleMax,
  lowLabel,
  highLabel,
  criteria,
  compact = false,
  openMore = false,
}: {
  question: QuestionDraft;
  index: number;
  total: number;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canDuplicate: boolean;
  /** Answers saved to this question so far (edit mode). */
  answered: number;
  counts: Record<string, number>;
  /** This question's own problems, shown once the presenter has tried to create. */
  problems: string[];
  /** The scoring settings, when this is the Score items question that holds them; null otherwise. */
  scoring: ScoringProps | null;
  scoringNumber: number;
  scaleMax: number;
  lowLabel: string;
  highLabel: string;
  criteria: string[];
  /** Inside the phone's folded list: no header of its own. */
  compact?: boolean;
  /** Start with More options open (the walkthrough shows the scoring settings). */
  openMore?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const extrasSet = [
    f.description !== null && "description",
    f.image && "picture",
  ].filter(Boolean) as string[];
  const [moreOpen, setMoreOpen] = useState(openMore || extrasSet.length > 0);
  const kind = KIND_INFO.find((k) => k.id === f.kind)!;

  if (picking)
    return (
      <TypePicker
        title="Change the type"
        current={f.kind}
        onCancel={() => setPicking(false)}
        onPick={(choice) => {
          setPicking(false);
          if ("preset" in choice) {
            const p = PRESETS.find((x) => x.id === choice.preset)!;
            update({ kind: p.kind, chart: defaultChart(p.kind), board: null, items: p.options.map((name) => ({ name })) });
            return;
          }
          const k = choice.kind;
          // a shortcut's Yes / No / Not sure doesn't carry into Score items; at least 2 rows to fill
          update({ kind: k, chart: defaultChart(k), board: null, items: rowsForKind(f.items, k, startRows(k).length) });
        }}
      />
    );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!compact && <span className="text-sm font-semibold text-ink-soft tabular-nums">Question {i + 1} of {total}</span>}
          {f.id ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-sm font-bold">
              <KindIcon kind={f.kind} className="h-4 w-4" />
              {kind.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              aria-label={`Change the type of question ${i + 1} (now ${kind.label})`}
              className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-white px-3 py-1.5 font-bold hover:border-ink"
            >
              <KindIcon kind={f.kind} className="h-5 w-5" />
              {kind.label}
              <span aria-hidden className="text-ink-soft">▾</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canDuplicate && (
            <button type="button" onClick={onDuplicate} className="rounded-lg px-2 py-1 text-sm font-semibold text-ink-soft hover:bg-canvas hover:text-ink" aria-label={`Duplicate question ${i + 1}`}>
              Duplicate
            </button>
          )}
          {total > 1 && (
            <button
              type="button"
              onClick={onRemove}
              title="Remove this question"
              className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-canvas hover:text-error"
              aria-label={`Remove question ${i + 1}`}
            >
              <BinIcon />
            </button>
          )}
        </div>
      </div>
      {f.id ? (
        <p className="mt-1.5 text-sm text-ink-soft">
          {answered > 0 ? `${plural(answered, "answer")} so far. ` : ""}To use a different type, remove this question and add a new one.
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink-soft">{kind.hint}</p>
      )}

      <label className="mt-4 block font-semibold">
        What do you want to ask?
        <input
          id={`question-${f.key}`}
          value={f.name}
          onChange={(e) => update({ name: e.target.value })}
          maxLength={120}
          placeholder={`e.g. ${EXAMPLES[f.kind].name}`}
          className={`${field} py-3 text-xl font-semibold`}
        />
      </label>

      {problems.length > 0 && (
        <ul role="alert" className="mt-2 list-disc rounded-lg border border-error/40 py-2 pr-3 pl-7 text-sm text-error">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {hasOptions(f.kind) && (
        <ListEditor
          label={LIST_COPY[f.kind as OptionKind].label}
          noun={LIST_COPY[f.kind as OptionKind].noun}
          items={f.items}
          onChange={(items) => update({ items })}
          max={MAX_TOPICS_PER_FOCUS}
          maxLength={120}
          placeholders={EXAMPLES[f.kind].list}
          answers={counts}
          pictures
          describe={f.kind === "rating" ? { max: MAX_ITEM_DESCRIPTION, placeholder: "Description (optional), e.g. what it would change" } : undefined}
        />
      )}

      {f.kind === "rating" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-canvas px-3 py-2 text-sm">
          <span>
            Scored 1 to {scaleMax} ({lowLabel || "Low"} to {highLabel || "High"})
            {criteria.length > 1 ? ` on ${criteria.join(", ")}` : ""}.
          </span>
          {scoring ? (
            <button type="button" onClick={() => setMoreOpen(true)} className="font-semibold underline underline-offset-4">
              Change
            </button>
          ) : (
            <span className="text-ink-soft">Set in question {scoringNumber}.</span>
          )}
        </p>
      )}

      {f.kind === "quiz" && (
        <div className="mt-4">
          <p id={`right-${f.key}`} className="text-sm font-semibold">
            Right answer
          </p>
          <div role="radiogroup" aria-labelledby={`right-${f.key}`} className="mt-1 flex flex-wrap gap-1.5">
            {filledItems(f.items).map((name) => {
              const on = name.trim() === f.correct.trim();
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => update({ correct: name })}
                  className={`rounded-full border border-line-strong px-3 py-1 text-sm font-bold ${on ? "bg-mint" : "bg-white hover:bg-canvas"}`}
                >
                  {on ? "✓ " : ""}
                  {name}
                </button>
              );
            })}
            {filledItems(f.items).length === 0 && <span className="text-sm text-ink-soft">Type the answers above first.</span>}
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Time to answer
            <select value={f.seconds} onChange={(e) => update({ seconds: Number(e.target.value) })} className={`${field} text-base`}>
              {QUIZ_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t < 60 ? `${t} seconds` : t === 60 ? "1 minute" : `${t / 60} minutes`}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1.5 text-xs text-ink-soft">
            On the results screen you start each quiz question. Everyone&apos;s phone jumps to it, and the right answer shows when time is up.
          </p>
        </div>
      )}

      {f.kind === "number" && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold">
            Lowest answer
            <input inputMode="decimal" value={f.min} onChange={(e) => update({ min: e.target.value })} className={`${field} text-base`} />
          </label>
          <label className="block text-sm font-semibold">
            Highest answer
            <input inputMode="decimal" value={f.max} onChange={(e) => update({ max: e.target.value })} className={`${field} text-base`} />
          </label>
          <label className="col-span-2 block text-sm font-semibold sm:col-span-1">
            Unit <span className="font-normal text-ink-soft">(optional)</span>
            <input value={f.unit} maxLength={20} onChange={(e) => update({ unit: e.target.value })} placeholder="e.g. %, users, km" className={`${field} text-base`} />
          </label>
        </div>
      )}

      {f.kind === "text" && (
        <div className="mt-4">
          <p id={`board-${f.key}`} className="text-sm font-semibold">
            Show answers as
          </p>
          <div role="radiogroup" aria-labelledby={`board-${f.key}`} className="mt-1 flex flex-wrap gap-1.5">
            {[{ id: null, label: "A list", blurb: "Answers as cards" }, ...BOARDS].map((b) => {
              const on = (f.board ?? null) === b.id;
              return (
                <button
                  key={b.id ?? "list"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={b.blurb}
                  onClick={() => update({ board: b.id, chart: b.id ? "board" : f.chart === "board" ? defaultChart("text") : f.chart })}
                  className={chip(on)}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {f.board
              ? `${BOARDS.find((b) => b.id === f.board)!.blurb}. Each one shows its writer's name.`
              : "Answers are anonymous. Pick a picture for team activities: each answer shows its writer's name."}
          </p>
          {f.board && (
            <label className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">How many {f.board === "tree" ? "leaves" : f.board === "wall" ? "notes" : "stars"} each person can add</span>
              <select
                value={f.maxLeaves ?? MAX_LEAVES}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  update({ maxLeaves: n === MAX_LEAVES ? null : n });
                }}
                className="rounded-md border border-line-strong bg-white px-2 py-1 font-bold tabular-nums"
              >
                {Array.from({ length: MAX_LEAVES_LIMIT }, (_, n) => n + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls={`more-${f.key}`}
          className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left font-semibold"
        >
          <span>
            More options
            <span className="ml-2 text-sm font-normal text-ink-soft">
              {extrasSet.length ? extrasSet.join(", ") : f.kind === "rating" && scoring ? "description, picture, scoring, chart" : "description, picture, chart"}
            </span>
          </span>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className={`shrink-0 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}>
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {moreOpen && (
          <div id={`more-${f.key}`} className="enter mt-2">
            {f.description === null ? (
              <button
                type="button"
                onClick={() => update({ description: "" })}
                className="block text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink"
              >
                + Add a description (optional)
              </button>
            ) : (
              <div className="mt-1">
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`desc-${f.key}`} className="text-sm font-semibold">
                    Description <span className="font-normal text-ink-soft">(optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => update({ description: null })}
                    aria-label={`Remove the description of question ${i + 1}`}
                    className="text-xs font-semibold text-ink-soft underline underline-offset-4"
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  id={`desc-${f.key}`}
                  aria-describedby={`desc-${f.key}-hint`}
                  value={f.description}
                  onChange={(e) => update({ description: e.target.value })}
                  maxLength={MAX_DESCRIPTION}
                  rows={2}
                  placeholder="e.g. Think about the last two weeks. Answers are anonymous."
                  className={`${field} text-base`}
                />
                <p id={`desc-${f.key}-hint`} className="mt-0.5 text-xs text-ink-soft">
                  Shown under the question on phones and on the big screen. {MAX_DESCRIPTION - f.description.length} characters left.
                </p>
              </div>
            )}

            <PicturePicker value={f.image} what={`question ${i + 1}`} onChange={(image) => update({ image })} />

            {f.kind === "multi" && (
              <label className="mt-3 block text-sm font-semibold">
                Each person can pick
                <select
                  value={f.maxPicks ?? ""}
                  onChange={(e) => update({ maxPicks: e.target.value ? Number(e.target.value) : null })}
                  className={`${field} text-base`}
                >
                  <option value="">As many as they like</option>
                  {Array.from({ length: MAX_TOPICS_PER_FOCUS - 1 }, (_, n) => n + 1).map((n) => (
                    <option key={n} value={n}>
                      Up to {n}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {f.kind === "rating" && scoring && <ScoringSettings {...scoring} />}

            <div className="mt-3">
              <p id={`chart-${f.key}`} className="text-sm font-semibold">
                Show results as
              </p>
              <div role="radiogroup" aria-labelledby={`chart-${f.key}`} className="mt-1 flex flex-wrap gap-1.5">
                {chartsFor(f.kind, f.board).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={f.chart === c.id}
                    onClick={() => update({ chart: c.id })}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${f.chart === c.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-soft">You can switch charts on the results screen too.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 7h14M10 4h4M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5" />
    </svg>
  );
}
