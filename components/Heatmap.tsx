import { scaleColor } from "@/lib/colors";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "@/lib/stats";
import type { NamedItem } from "@/lib/types";

interface Props {
  topics: NamedItem[];
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
        className={`flex h-full min-h-[clamp(3rem,5.6vh,5.5rem)] flex-col items-center justify-center rounded-xl transition-colors duration-500 ${
          flashKey ? "animate-flash" : ""
        } ${colors ? "" : "border-2 border-dashed border-line bg-white text-ink/40"} ${strong ? "ring-2 ring-ink ring-offset-0" : ""}`}
        style={colors ? { backgroundColor: colors.bg, color: colors.fg } : undefined}
      >
        <span className="font-display text-[clamp(1.4rem,2.3vw,2.6rem)] font-extrabold leading-none tabular-nums">
          {fmt1(value)}
        </span>
        {agg.n > 0 && <span className="mt-1 text-[clamp(0.75rem,0.85vw,1rem)] font-semibold opacity-80">n={agg.n}</span>}
      </div>
    </td>
  );
}

export function Heatmap({ topics, criteria, cells, scaleMax, flash }: Props) {
  const empty: Agg = { n: 0, sum: 0 };
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-0">
        <caption className="sr-only">Average rating per topic and criterion</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[22%]" />
            {criteria.map((c) => (
              <th
                key={c.id}
                scope="col"
                className="px-1 pb-2 text-center align-bottom text-[clamp(0.9rem,1.15vw,1.35rem)] font-bold leading-tight"
              >
                {c.name}
              </th>
            ))}
            <th scope="col" className="px-1 pb-2 text-center align-bottom text-[clamp(0.9rem,1.15vw,1.35rem)] font-extrabold">
              Overall
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
            <th scope="row" className="pr-3 pt-1 text-left text-[clamp(1rem,1.3vw,1.55rem)] font-extrabold">
              Average
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
