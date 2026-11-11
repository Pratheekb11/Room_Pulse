import { scaleColor } from "@/lib/colors";
import { avg, cellKey, sumAggs, type Agg } from "@/lib/stats";
import { CountUp } from "./CountUp";
import type { NamedItem } from "@/lib/types";

interface Props {
  topics: (NamedItem & { description?: string | null })[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  scaleMax: number;
  flash: Record<string, number>;
}

function Cell({ agg, scaleMax, flashKey, strong }: { agg: Agg; scaleMax: number; flashKey?: number; strong?: boolean }) {
  const value = avg(agg);
  const colors = value === null ? null : scaleColor(value, scaleMax);
  return (
    <td className="p-1">
      <div
        key={flashKey}
        className={`flex h-full min-h-[clamp(3rem,5.6vh,5.5rem)] flex-col items-center justify-center rounded-lg transition-colors duration-500 ${
          flashKey ? "animate-flash" : ""
        } ${colors ? "" : "border border-dashed border-line-strong bg-white text-ink/40"} ${strong ? "ring-1 ring-black/15" : ""}`}
        style={colors ? { backgroundColor: colors.bg, color: colors.fg } : undefined}
      >
        <span className="font-display text-[clamp(1.4rem,2.3vw,2.6rem)] font-semibold leading-none tabular-nums">
          <CountUp value={value} format={(v) => v.toFixed(1)} />
        </span>
        {agg.n > 0 && <span className="mt-1 text-[clamp(0.75rem,0.85vw,1rem)] font-semibold opacity-80">{agg.n} {agg.n === 1 ? "vote" : "votes"}</span>}
      </div>
    </td>
  );
}

/** One measure's score as a small tile (the narrow-screen cards). */
function Tile({ label, agg, scaleMax, strong }: { label: string; agg: Agg; scaleMax: number; strong?: boolean }) {
  const value = avg(agg);
  const colors = value === null ? null : scaleColor(value, scaleMax);
  return (
    <li
      className={`flex min-w-0 flex-col rounded-lg px-2 py-1.5 ${colors ? "" : "border border-dashed border-line-strong bg-white text-ink/50"} ${strong ? "ring-1 ring-black/15" : ""}`}
      style={colors ? { backgroundColor: colors.bg, color: colors.fg } : undefined}
    >
      <span className={`text-xs leading-tight ${strong ? "font-bold" : "font-semibold opacity-90"}`}>{label}</span>
      <span className="font-display mt-0.5 text-xl leading-none font-semibold tabular-nums">{value === null ? "–" : value.toFixed(1)}</span>
      {agg.n > 0 && <span className="mt-0.5 text-[11px] font-semibold opacity-80">{agg.n} {agg.n === 1 ? "vote" : "votes"}</span>}
    </li>
  );
}

/**
 * Where the table needs more room than the screen has, a card per item instead.
 * Literal class names (Tailwind only builds what it can see): up to 2 measures fit a phone,
 * up to 6 need 42rem, more need 64rem.
 */
function cardsUntil(measures: number): { cards: string; table: string } | null {
  if (measures <= 2) return null;
  return measures <= 6 ? { cards: "@2xl:hidden", table: "@max-2xl:hidden" } : { cards: "@5xl:hidden", table: "@max-5xl:hidden" };
}

/**
 * The item-name column. 22% suits a wide screen; on a phone that's ~75px and "Planning" broke mid-word,
 * so with the few measures that still show as a table there, names get the room the score tiles can spare.
 */
const NAME_COLUMN: Record<number, string> = {
  1: "w-[44%] @2xl:w-[22%]",
  2: "w-[38%] @2xl:w-[22%]",
};

export function Heatmap({ topics, criteria, cells, scaleMax, flash }: Props) {
  const empty: Agg = { n: 0, sum: 0 };
  // Container queries (not the viewport): the builder's preview draws the big screen at 1280px on any device.
  const cards = cardsUntil(criteria.length);
  return (
    <div className="@container">
      {cards && (
        <ul aria-label="Scores per item" className={`flex flex-col gap-3 ${cards.cards}`}>
          {topics.map((t) => {
            const row = criteria.map((c) => cells.get(cellKey(t.id, c.id)));
            return (
              <li key={t.id} className="rounded-xl border border-line-strong bg-white p-3">
                <p className="text-base font-bold leading-tight">{t.name}</p>
                {t.description && <p className="mt-0.5 text-xs font-semibold leading-snug text-ink-soft">{t.description}</p>}
                <ul aria-label={`Scores for ${t.name}`} className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5">
                  {criteria.map((c, i) => (
                    <Tile key={c.id} label={c.name} agg={row[i] ?? empty} scaleMax={scaleMax} />
                  ))}
                  <Tile label="Average" agg={sumAggs(row)} scaleMax={scaleMax} strong />
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      <table className={`w-full table-fixed border-separate border-spacing-0 ${cards?.table ?? ""}`}>
        <caption className="sr-only">Average score for each item on each measure</caption>
        <thead>
          <tr>
            <th scope="col" className={NAME_COLUMN[criteria.length] ?? "w-[22%]"} />
            {criteria.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={`px-1 pb-2 text-center align-bottom ${criteria.length > 6 ? "text-[clamp(0.75rem,0.85vw,1rem)]" : "text-[clamp(0.9rem,1.15vw,1.35rem)]"} font-bold leading-tight`}
              >
                {c.name}
              </th>
            ))}
            <th scope="col" className="px-1 pb-2 text-center align-bottom text-[clamp(0.9rem,1.15vw,1.35rem)] font-semibold">
              Average
            </th>
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => {
            const row = criteria.map((c) => cells.get(cellKey(t.id, c.id)));
            return (
              <tr key={t.id}>
                <th
                  scope="row"
                  className="pr-3 text-left text-[clamp(1rem,1.3vw,1.55rem)] font-bold leading-tight break-words"
                >
                  {t.name}
                  {t.description && (
                    <span className="mt-0.5 line-clamp-3 text-[clamp(0.75rem,0.9vw,1rem)] font-semibold leading-snug text-ink-soft" title={t.description}>
                      {t.description}
                    </span>
                  )}
                </th>
                {criteria.map((c, i) => {
                  const key = cellKey(t.id, c.id);
                  return <Cell key={c.id} agg={row[i] ?? empty} scaleMax={scaleMax} flashKey={flash[key]} />;
                })}
                <Cell agg={sumAggs(row)} scaleMax={scaleMax} strong />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="pr-3 pt-1 text-left text-[clamp(1rem,1.3vw,1.55rem)] font-semibold">
              All items
            </th>
            {criteria.map((c) => (
              <Cell
                key={c.id}
                agg={sumAggs(topics.map((t) => cells.get(cellKey(t.id, c.id))))}
                scaleMax={scaleMax}
                strong
              />
            ))}
            <Cell agg={sumAggs([...cells.values()])} scaleMax={scaleMax} strong />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
