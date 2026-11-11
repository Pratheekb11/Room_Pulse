import { scaleColor } from "@/lib/colors";
import { takeaways } from "@/lib/insights";
import { bestAndWorst, sortItems, type ItemSort, type RatedItem } from "@/lib/rank-items";
import { cellKey, avg, fmt1, type Agg } from "@/lib/stats";
import type { NamedItem } from "@/lib/types";

interface Props {
  /** Every item with its average and rank (rateItems). */
  rows: RatedItem[];
  sort: ItemSort;
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  scaleMax: number;
  voterCount: number;
}

const AGREEMENT_STYLE = {
  "Most people agree": "bg-mint/30 text-success",
  "Opinions vary": "bg-sun text-ink",
  "People disagree": "bg-peach/35 text-error",
} as const;

/** "A", "A and B", "A, B and C". */
const andList = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The best or the lowest rated item, big; every item when several share the score. */
function Standout({ label, rows, scaleMax, dark }: { label: string; rows: RatedItem[]; scaleMax: number; dark?: boolean }) {
  const row = rows[0];
  const tied = rows.length > 1;
  return (
    <section
      className={`flex flex-1 flex-col rounded-xl p-[clamp(1rem,1.8vw,2rem)] ${dark ? "bg-ink text-white" : "border-2 border-error/40 bg-white"}`}
    >
      <h2 className={`text-[clamp(0.9rem,1.1vw,1.2rem)] font-semibold ${dark ? "text-white/70" : "text-error"}`}>{tied ? `Tied for ${label}` : `${label[0].toUpperCase()}${label.slice(1)} rated`}</h2>
      <p className="font-display mt-1 text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-[1.05] break-words">{andList(rows.map((r) => r.item.name))}</p>
      {!tied && row.item.description && (
        <p className={`mt-1 text-[clamp(0.9rem,1.1vw,1.25rem)] leading-snug break-words ${dark ? "text-white/80" : "text-ink-soft"}`}>{row.item.description}</p>
      )}
      <p className="mt-auto pt-3">
        <span className="font-display text-[clamp(2.2rem,3.8vw,4.4rem)] font-semibold leading-none">{fmt1(row.value)}</span>
        <span className={`text-[clamp(1rem,1.3vw,1.5rem)] ${dark ? "text-white/70" : "text-ink-soft"}`}> / {scaleMax}</span>
      </p>
      {!tied && row.agree && <p className={`mt-1 text-[clamp(0.9rem,1.1vw,1.2rem)] ${dark ? "text-white/80" : "text-ink-soft"}`}>{row.agree}</p>}
    </section>
  );
}

/** Board-room summary: the best and the lowest rated first, then the findings, then every item by rank. */
export function ExecSummary({ rows, sort, criteria, cells, scaleMax, voterCount }: Props) {
  const { best, bestTies, worstTies } = bestAndWorst(rows);
  const findings = takeaways(
    rows.map((r) => ({
      name: r.item.name,
      overall: r.value,
      perCriterion: criteria.map((c) => avg(cells.get(cellKey(r.item.id, c.id)))),
      agreement: r.agree,
    })),
    criteria.map((c) => c.name),
    scaleMax,
  );
  const ratings = rows.reduce((s, r) => s + r.n, 0);
  const sorted = sortItems(rows, sort);
  /** A column per measure fits only for a few of them. */
  const measureColumns = criteria.length <= 3;

  return (
    <div className="grid gap-[clamp(0.75rem,1.4vw,1.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
      <div className="flex flex-col gap-[clamp(0.75rem,1.4vw,1.5rem)]">
        {best ? (
          <div className="grid gap-[clamp(0.75rem,1.4vw,1.5rem)] sm:grid-cols-2 lg:grid-cols-1">
            <Standout label="best" rows={bestTies} scaleMax={scaleMax} dark />
            {worstTies.length > 0 && <Standout label="lowest" rows={worstTies} scaleMax={scaleMax} />}
          </div>
        ) : (
          <section className="rounded-xl bg-ink p-[clamp(1rem,1.8vw,2rem)] text-white">
            <h2 className="text-[clamp(0.9rem,1.1vw,1.2rem)] font-semibold text-white/70">Best rated</h2>
            <p className="mt-2 text-xl text-white/80">No scores yet.</p>
          </section>
        )}
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

        {/* A column per measure only for a few measures and only where there's room; otherwise chips under each item.
            Container queries: the builder's preview draws the big screen at 1280px on any device. */}
        <section className="@container rounded-xl border border-line-strong bg-white">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Every item with its rank by average score, its description and each measure</caption>
            <thead>
              <tr className="border-b border-line-strong text-[clamp(0.75rem,0.9vw,1rem)] text-ink-soft">
                <th scope="col" className="w-[3rem] py-2.5 pl-3 font-semibold sm:pl-5">Rank</th>
                <th scope="col" className="py-2.5 pl-2 font-semibold">Item</th>
                <th scope="col" className="py-2.5 font-semibold">Average</th>
                {criteria.map((c) =>
                  measureColumns && (
                    <th key={c.id} scope="col" className="hidden max-w-[9ch] truncate px-1 py-2.5 text-center font-semibold @2xl:table-cell" title={c.name}>
                      {c.name}
                    </th>
                  ),
                )}
                <th scope="col" className="py-2.5 pl-2 pr-3 font-semibold sm:pr-5">Agreement</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const perCriterion = criteria.map((c) => avg(cells.get(cellKey(r.item.id, c.id))));
                const tag = bestTies.includes(r) ? "Best" : worstTies.includes(r) ? "Lowest" : null;
                return (
                  <tr key={r.item.id} className="border-b border-line last:border-0">
                    <td className="font-display py-[clamp(0.4rem,0.9vh,0.8rem)] pl-3 align-top sm:pl-5 text-[clamp(1rem,1.3vw,1.5rem)] font-semibold text-ink-soft">
                      {r.rank ?? "–"}
                    </td>
                    <td className="py-2 pl-2 pr-3 align-top">
                      <span className="text-[clamp(1rem,1.2vw,1.4rem)] font-bold [overflow-wrap:anywhere]">{r.item.name}</span>
                      {tag && (
                        <span
                          className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-[clamp(0.7rem,0.8vw,0.9rem)] font-bold ${
                            tag === "Best" ? "bg-ink text-white" : "bg-peach/35 text-error"
                          }`}
                        >
                          {tag}
                        </span>
                      )}
                      {r.item.description && (
                        <span className="mt-0.5 block text-[clamp(0.8rem,0.95vw,1.05rem)] leading-snug text-ink-soft [overflow-wrap:anywhere]">{r.item.description}</span>
                      )}
                      {criteria.length > 1 && (
                        <ul aria-label={`Scores for ${r.item.name}`} className={`mt-1.5 flex flex-wrap gap-1 ${measureColumns ? "@2xl:hidden" : ""}`}>
                          {perCriterion.map((v, ci) => {
                            const c = v === null ? null : scaleColor(v, scaleMax);
                            return (
                              <li
                                key={criteria[ci].id}
                                className="rounded-md border border-line px-1.5 py-0.5 text-[clamp(0.72rem,0.85vw,0.95rem)] font-semibold"
                                style={c ? { backgroundColor: c.bg, color: c.fg, borderColor: "transparent" } : undefined}
                              >
                                {criteria[ci].name} <span className="font-bold tabular-nums">{fmt1(v)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td className="font-display py-2 pr-2 align-top text-[clamp(1.1rem,1.5vw,1.8rem)] font-semibold tabular-nums">{fmt1(r.value)}</td>
                    {measureColumns && perCriterion.map((v, ci) => {
                      const c = v === null ? null : scaleColor(v, scaleMax);
                      return (
                        <td key={criteria[ci].id} className="hidden px-1 py-2 text-center align-top @2xl:table-cell">
                          <span
                            className="inline-block min-w-[3.2ch] rounded-lg px-1.5 py-0.5 text-[clamp(0.85rem,1vw,1.15rem)] font-bold tabular-nums"
                            style={c ? { backgroundColor: c.bg, color: c.fg } : undefined}
                          >
                            {fmt1(v)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-2 pl-2 pr-3 align-top sm:pr-5">
                      {r.agree ? (
                        <span className={`inline-block rounded-xl px-2.5 py-0.5 text-[clamp(0.72rem,0.85vw,0.95rem)] font-bold [overflow-wrap:break-word] sm:rounded-full sm:whitespace-nowrap ${AGREEMENT_STYLE[r.agree]}`}>
                          {r.agree}
                        </span>
                      ) : (
                        <span className="text-ink-soft">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
