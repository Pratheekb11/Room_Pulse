import { scaleColor } from "@/lib/colors";
import { agreement, takeaways } from "@/lib/insights";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "@/lib/stats";
import type { NamedItem } from "@/lib/types";

interface Props {
  topics: { item: NamedItem; index: number }[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  histograms: Map<string, number[]>;
  scaleMax: number;
  voterCount: number;
}

const AGREEMENT_STYLE = {
  "Most people agree": "bg-mint/30 text-success",
  "Opinions vary": "bg-sun text-ink",
  "People disagree": "bg-peach/35 text-error",
} as const;

/** Board-room summary: the answer first, then the findings, then the evidence. */
export function ExecSummary({ topics, criteria, cells, histograms, scaleMax, voterCount }: Props) {
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

  const top = rows[0] && rows[0].value !== null ? rows[0] : null;
  const findings = takeaways(
    rows.map((r) => ({ name: r.item.name, overall: r.value, perCriterion: r.perCriterion, agreement: r.agree?.label ?? null })),
    criteria.map((c) => c.name),
    scaleMax,
  );
  const ratings = rows.reduce((s, r) => s + r.n, 0);

  return (
    <div className="grid gap-[clamp(0.75rem,1.4vw,1.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
      <div className="flex flex-col gap-[clamp(0.75rem,1.4vw,1.5rem)]">
        <section className="flex flex-1 flex-col rounded-xl bg-ink p-[clamp(1rem,1.8vw,2rem)] text-white">
          <h2 className="text-[clamp(0.9rem,1.1vw,1.2rem)] font-semibold text-white/70">Highest score</h2>
          {top ? (
            <>
              <p className="font-display mt-1 text-[clamp(1.8rem,3vw,3.4rem)] font-semibold leading-[1.05]">{top.item.name}</p>
              <p className="mt-auto pt-4">
                <span className="font-display text-[clamp(2.6rem,4.4vw,5rem)] font-semibold leading-none">{fmt1(top.value)}</span>
                <span className="text-[clamp(1rem,1.3vw,1.5rem)] text-white/70"> / {scaleMax}</span>
              </p>
              {top.agree && <p className="mt-2 text-[clamp(0.9rem,1.1vw,1.2rem)] text-white/80">{top.agree.label}</p>}
            </>
          ) : (
            <p className="mt-2 text-xl text-white/80">No scores yet.</p>
          )}
        </section>
        <section className="grid grid-cols-2 gap-[clamp(0.75rem,1.4vw,1.5rem)]">
          {[
            { label: "People answered", value: voterCount },
            { label: "Scores given", value: ratings },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-line-strong bg-white p-[clamp(0.75rem,1.2vw,1.4rem)]">
              <p className="font-display text-[clamp(1.8rem,2.6vw,3rem)] font-semibold leading-none tabular-nums">{s.value}</p>
              <p className="mt-1 text-[clamp(0.85rem,1vw,1.1rem)] font-semibold text-ink-soft">{s.label}</p>
            </div>
          ))}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-[clamp(0.75rem,1.4vw,1.5rem)]">
        <section className="rounded-xl border border-line-strong bg-white p-[clamp(1rem,1.5vw,1.6rem)]">
          <h2 className="font-display text-[clamp(1.1rem,1.5vw,1.7rem)] font-semibold">What the room thinks</h2>
          {findings.length ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {findings.map((f) => (
                <li key={f} className="flex gap-3 text-[clamp(1rem,1.25vw,1.4rem)] leading-snug">
                  <span aria-hidden className="mt-[0.45em] h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-ink-soft">A short summary appears here once people start scoring.</p>
          )}
        </section>

        <section className="overflow-x-auto rounded-xl border border-line-strong bg-white">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Items ranked by average score, with each measure</caption>
            <thead>
              <tr className="border-b border-line-strong text-[clamp(0.75rem,0.9vw,1rem)] text-ink-soft">
                <th scope="col" className="w-[3rem] py-2.5 pl-5 font-semibold">Rank</th>
                <th scope="col" className="py-2.5 pl-2 font-semibold">Item</th>
                <th scope="col" className="py-2.5 font-semibold">Average</th>
                {criteria.map((c) => (
                  <th key={c.id} scope="col" className="max-w-[9ch] truncate px-1 py-2.5 text-center font-semibold" title={c.name}>
                    {c.name}
                  </th>
                ))}
                <th scope="col" className="py-2.5 pl-2 pr-5 font-semibold">Agreement</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.item.id} className="border-b border-line last:border-0">
                  <td className="font-display py-[clamp(0.4rem,0.9vh,0.8rem)] pl-5 text-[clamp(1rem,1.3vw,1.5rem)] font-semibold text-ink-soft">{i + 1}</td>
                  <td className="py-2 pl-2 pr-3 text-[clamp(1rem,1.2vw,1.4rem)] font-bold">{r.item.name}</td>
                  <td className="font-display py-2 pr-2 text-[clamp(1.1rem,1.5vw,1.8rem)] font-semibold tabular-nums">{fmt1(r.value)}</td>
                  {r.perCriterion.map((v, ci) => {
                    const c = v === null ? null : scaleColor(v, scaleMax);
                    return (
                      <td key={criteria[ci].id} className="px-1 py-2 text-center">
                        <span
                          className="inline-block min-w-[3.2ch] rounded-lg px-1.5 py-0.5 text-[clamp(0.85rem,1vw,1.15rem)] font-bold tabular-nums"
                          style={c ? { backgroundColor: c.bg, color: c.fg } : undefined}
                        >
                          {fmt1(v)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2 pl-2 pr-5">
                    {r.agree ? (
                      <span className={`rounded-full px-2.5 py-0.5 text-[clamp(0.72rem,0.85vw,0.95rem)] font-bold whitespace-nowrap ${AGREEMENT_STYLE[r.agree.label]}`}>
                        {r.agree.label}
                      </span>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
