import { agreement } from "@/lib/insights";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "@/lib/stats";
import type { NamedItem } from "@/lib/types";

interface Props {
  topics: { item: NamedItem; index: number }[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  histograms: Map<string, number[]>;
  scaleMax: number;
}

const AGREEMENT_STYLE = {
  "Strong agreement": "bg-[#e3f7ef] text-[#0b6b4f]",
  "Mixed views": "bg-[#fff4d9] text-[#7a4b00]",
  "Split views": "bg-[#ffe4ea] text-[#a3122f]",
} as const;

/** Restrained, board-room summary: the answer first, then the ranked evidence. */
export function ExecSummary({ topics, criteria, cells, histograms, scaleMax }: Props) {
  const rows = topics
    .map(({ item }) => {
      const agg = sumAggs(criteria.map((c) => cells.get(cellKey(item.id, c.id))));
      return {
        item,
        value: avg(agg),
        n: agg.n,
        agree: agreement(histograms.get(item.id) ?? [], scaleMax),
        perCriterion: criteria.map((c) => avg(cells.get(cellKey(item.id, c.id)))),
      };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const top = rows[0]?.value !== null ? rows[0] : undefined;
  const critAvg = criteria.map((c) => ({ c, v: avg(sumAggs(topics.map(({ item }) => cells.get(cellKey(item.id, c.id))))) }));
  const rated = critAvg.filter((x) => x.v !== null) as { c: NamedItem; v: number }[];
  const strongest = rated.length ? rated.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const weakest = rated.length ? rated.reduce((a, b) => (b.v < a.v ? b : a)) : null;

  return (
    <div className="grid gap-[clamp(0.75rem,1.4vw,1.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-[clamp(0.75rem,1.4vw,1.5rem)]">
        <section className="rounded-[22px] bg-ink p-[clamp(1rem,1.8vw,2rem)] text-white">
          <h2 className="text-[clamp(0.9rem,1.1vw,1.2rem)] font-semibold text-white/70">Top pick</h2>
          {top ? (
            <>
              <p className="font-display mt-1 text-[clamp(1.8rem,3vw,3.4rem)] font-extrabold leading-tight">{top.item.name}</p>
              <p className="mt-2 text-[clamp(1rem,1.3vw,1.5rem)]">
                <span className="font-display text-[clamp(2.2rem,3.6vw,4rem)] font-extrabold">{fmt1(top.value)}</span>
                <span className="text-white/70"> / {scaleMax}</span>
              </p>
              {top.agree && <p className="mt-1 text-[clamp(0.9rem,1.1vw,1.2rem)] text-white/80">{top.agree.label} across {top.n} ratings</p>}
            </>
          ) : (
            <p className="mt-2 text-xl text-white/80">Waiting for ratings.</p>
          )}
        </section>
        <section className="grid grid-cols-2 gap-[clamp(0.75rem,1.4vw,1.5rem)]">
          {[
            { label: "Strongest criterion", x: strongest },
            { label: "Weakest criterion", x: weakest },
          ].map(({ label, x }) => (
            <div key={label} className="rounded-[22px] border-2 border-ink bg-white p-[clamp(0.75rem,1.2vw,1.4rem)]">
              <h3 className="text-[clamp(0.8rem,0.95vw,1.05rem)] font-semibold text-ink-soft">{label}</h3>
              <p className="mt-1 text-[clamp(1.1rem,1.5vw,1.7rem)] font-extrabold leading-tight">{x ? x.c.name : "—"}</p>
              <p className="font-display text-[clamp(1.5rem,2.2vw,2.5rem)] font-extrabold">{x ? fmt1(x.v) : ""}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="overflow-hidden rounded-[22px] border-2 border-ink bg-white">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Topics ranked by overall score</caption>
          <thead>
            <tr className="border-b-2 border-ink text-[clamp(0.8rem,0.95vw,1.05rem)] text-ink-soft">
              <th scope="col" className="w-[3.5rem] py-3 pl-5 font-semibold">#</th>
              <th scope="col" className="py-3 font-semibold">Topic</th>
              <th scope="col" className="py-3 font-semibold">Overall</th>
              <th scope="col" className="w-[28%] py-3 font-semibold">
                <span className="sr-only">Score bar</span>
              </th>
              <th scope="col" className="py-3 font-semibold">Room</th>
              <th scope="col" className="py-3 pr-5 text-right font-semibold">Ratings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.item.id} className="border-b border-line last:border-0">
                <td className="py-[clamp(0.45rem,1vh,0.9rem)] pl-5 pr-3 font-display text-[clamp(1rem,1.3vw,1.5rem)] font-extrabold text-ink-soft">{i + 1}</td>
                <td className="py-2 pr-3 text-[clamp(1rem,1.25vw,1.45rem)] font-bold">{r.item.name}</td>
                <td className="py-2 font-display text-[clamp(1.1rem,1.5vw,1.8rem)] font-extrabold tabular-nums">{fmt1(r.value)}</td>
                <td className="py-2 pr-4">
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#ebe7fb]">
                    <div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${r.value === null ? 0 : (r.value / scaleMax) * 100}%` }} />
                  </div>
                </td>
                <td className="py-2">
                  {r.agree ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-[clamp(0.75rem,0.9vw,1rem)] font-bold whitespace-nowrap ${AGREEMENT_STYLE[r.agree.label]}`}>
                      {r.agree.label}
                    </span>
                  ) : (
                    <span className="text-ink-soft">—</span>
                  )}
                </td>
                <td className="py-2 pr-5 text-right text-[clamp(0.9rem,1vw,1.15rem)] font-semibold tabular-nums text-ink-soft">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
