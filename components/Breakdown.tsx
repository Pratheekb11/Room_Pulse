import { topicColor } from "@/lib/colors";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "@/lib/stats";
import type { NamedItem } from "@/lib/types";
import { Donut } from "./Donut";

interface Props {
  topics: { item: NamedItem; index: number }[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  histograms: Map<string, number[]>;
  scaleMax: number;
}

/** One card per topic: donut of score distribution + mini bars per criterion. */
export function Breakdown({ topics, criteria, cells, histograms, scaleMax }: Props) {
  const cols = topics.length <= 4 ? 2 : 3;
  return (
    <div className="grid gap-[clamp(0.6rem,1.2vw,1.25rem)]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {topics.map(({ item: t, index }) => {
        const row = criteria.map((c) => cells.get(cellKey(t.id, c.id)));
        const overall = avg(sumAggs(row));
        const counts = histograms.get(t.id) ?? new Array<number>(scaleMax).fill(0);
        return (
          <article key={t.id} className="slab flex flex-col overflow-hidden rounded-[22px] bg-white p-4">
            <h3 className="flex items-center gap-2 text-[clamp(1rem,1.3vw,1.5rem)] font-extrabold leading-tight">
              <span aria-hidden className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: topicColor(index) }} />
              <span className="line-clamp-2" title={t.name}>
                {t.name}
              </span>
            </h3>
            <div className="mt-3 flex flex-1 items-center gap-4">
            <div className="aspect-square w-[40%] max-w-[13rem] shrink-0">
              <Donut counts={counts} scaleMax={scaleMax} center={fmt1(overall)} label={`${t.name}: overall ${fmt1(overall)}`} />
            </div>
            <ul className="flex min-w-0 flex-1 flex-col justify-center gap-[clamp(0.25rem,0.7vh,0.6rem)]">
              {criteria.map((c, i) => {
                const v = avg(row[i]);
                return (
                  <li key={c.id}>
                    <div className="flex justify-between gap-2 text-[clamp(0.75rem,0.9vw,1.05rem)] font-semibold">
                      <span className="truncate" title={c.name}>
                        {c.name}
                      </span>
                      <span className="font-display font-extrabold tabular-nums">{fmt1(v)}</span>
                    </div>
                    <div className="mt-0.5 h-[clamp(0.5rem,1vh,0.8rem)] overflow-hidden rounded-full bg-[#ebe7fb]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${v === null ? 0 : (v / scaleMax) * 100}%`, backgroundColor: topicColor(index) }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            </div>
          </article>
        );
      })}
    </div>
  );
}
