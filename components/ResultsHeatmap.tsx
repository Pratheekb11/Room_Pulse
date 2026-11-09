import { scaleColor } from "@/lib/colors";
import type { HeatRow } from "@/lib/heat";
import { kindLabel } from "@/lib/kinds";

interface Props {
  rows: HeatRow[];
  /** Questions with nothing to compare (open answers, Q&A, numbers). */
  skipped: string[];
  scaleMax: number;
  onOpen: (groupIndex: number) => void;
}

/** Heat 0…1 on the same colour scale as the scores, so one legend reads every question. */
const heatColor = (heat: number) => scaleColor(1 + heat * 4, 5);

/** Every question's results at a glance: one row of tiles per question, darker = stronger. */
export function ResultsHeatmap({ rows, skipped, scaleMax, onOpen }: Props) {
  return (
    <div className="flex flex-col gap-[clamp(0.75rem,1.4vw,1.5rem)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[clamp(0.85rem,1vw,1.1rem)] font-semibold text-ink-soft">
        <span className="flex items-center gap-1.5">
          Weaker
          <span aria-hidden className="flex overflow-hidden rounded-full border border-line-strong">
            {[0, 0.25, 0.5, 0.75, 1].map((h) => (
              <span key={h} className="h-3.5 w-6" style={{ backgroundColor: heatColor(h).bg }} />
            ))}
          </span>
          Stronger
        </span>
        <span>
          Darker = stronger. Scores use the 1 to {scaleMax} scale; choices and words are compared with the top answer of their question.
        </span>
      </div>

      {rows.map((row) => (
        <section key={row.focusId || "loose"} className="slab rounded-xl bg-white p-[clamp(0.75rem,1.3vw,1.5rem)]">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[clamp(0.8rem,0.9vw,1rem)] font-semibold text-ink-soft">{kindLabel(row.kind)}</p>
              <h2 className="font-display text-[clamp(1.2rem,1.7vw,2rem)] font-semibold leading-tight break-words">{row.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => onOpen(row.groupIndex)}
              aria-label={`Open the results of ${row.name}`}
              className="shrink-0 rounded-full bg-ink px-3 py-1 text-[clamp(0.8rem,0.95vw,1.05rem)] font-bold text-white hover:bg-primary"
            >
              Open
            </button>
          </div>
          {row.tiles.length === 0 ? (
            <p className="text-ink-soft">No answers yet</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]">
              {row.tiles.map((tile) => {
                const c = tile.heat === null ? null : heatColor(tile.heat);
                return (
                  <li
                    key={tile.id}
                    className={`relative flex min-h-[clamp(5.5rem,11vh,8rem)] min-w-0 flex-col rounded-lg p-[clamp(0.5rem,0.8vw,0.85rem)] transition-colors duration-500 ${
                      c ? "" : "border border-dashed border-line-strong bg-white text-ink-soft"
                    } ${tile.best ? "ring-2 ring-ink ring-offset-2" : ""}`}
                    style={c ? { backgroundColor: c.bg, color: c.fg } : undefined}
                  >
                    <span className="line-clamp-2 text-[clamp(0.9rem,1.05vw,1.2rem)] font-bold leading-tight break-words" title={tile.name}>
                      {tile.name}
                    </span>
                    {tile.description && (
                      <span className="mt-0.5 line-clamp-2 text-[clamp(0.72rem,0.85vw,0.95rem)] leading-snug opacity-85" title={tile.description}>
                        {tile.description}
                      </span>
                    )}
                    <span className="mt-auto flex items-baseline justify-between gap-2 pt-1.5">
                      <span className="font-display text-[clamp(1.3rem,1.9vw,2.2rem)] font-semibold leading-none tabular-nums">{tile.label}</span>
                      <span className="text-right text-[clamp(0.7rem,0.8vw,0.9rem)] font-semibold opacity-85">{tile.detail}</span>
                    </span>
                    {tile.best && <span className="sr-only">Strongest answer</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}

      {skipped.length > 0 && (
        <p className="text-[clamp(0.85rem,1vw,1.1rem)] text-ink-soft">
          Not shown here: {skipped.map((s) => `“${s}”`).join(", ")}. Open answers, Q&amp;A and numbers have no options to compare; see them under “Cards”.
        </p>
      )}
    </div>
  );
}
