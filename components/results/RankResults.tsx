import { readableOn, topicColor } from "@/lib/colors";
import { fmt1 } from "@/lib/stats";
import type { RankTally } from "@/lib/answers";

/** Dark ink for numbers on the places grid's light tints (the same in every design). */
const INK = "#26251e";

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** Options from most to least preferred, with their average place. */
export function RankList({ tally }: { tally: RankTally }) {
  return (
    <ol className="flex flex-col gap-[clamp(0.6rem,1.6vh,1.2rem)]" aria-label="Ranking results, best first">
      {tally.rows.map((r, pos) => {
        const c = topicColor(r.index);
        return (
          <li key={r.id} className="flex items-center gap-3">
            <span
              className="font-display flex h-[clamp(2rem,4.6vh,3.4rem)] w-[clamp(2rem,4.6vh,3.4rem)] shrink-0 items-center justify-center rounded-lg border border-line-strong text-[clamp(1.1rem,1.5vw,1.7rem)] font-semibold"
              style={{ backgroundColor: c, color: readableOn(c) }}
            >
              {r.average === null ? "–" : pos + 1}
            </span>
            <span className="w-[34%] shrink-0 text-[clamp(1rem,1.5vw,1.8rem)] font-bold leading-tight break-words">
              {r.name} {pos === 0 && r.average !== null && <span aria-label="top choice">👑</span>}
            </span>
            <span className="relative h-6 sm:h-[clamp(1.5rem,4.6vh,3.8rem)] flex-1 overflow-hidden rounded-full border border-line-strong bg-white">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
                style={{ width: `${r.average === null ? 0 : Math.max(4, r.score * 100)}%`, backgroundColor: c }}
              />
            </span>
            <span className="w-[clamp(3.5rem,9vw,9rem)] shrink-0 text-right text-[clamp(0.7rem,1vw,1.15rem)] leading-tight font-semibold text-ink-soft">
              <span className="font-display block text-[clamp(1.2rem,1.8vw,2.1rem)] text-ink tabular-nums">{fmt1(r.average)}</span>
              <span className="hidden sm:inline">average place</span>
              <span className="sm:hidden">avg. place</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Grid: how many people put each option in each place. Darker = more people. */
export function RankPlaces({ tally }: { tally: RankTally }) {
  const k = tally.rows.length;
  const max = Math.max(1, ...tally.rows.flatMap((r) => r.places));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[clamp(0.2rem,0.4vw,0.45rem)] text-[clamp(0.9rem,1.2vw,1.4rem)]">
        <thead>
          <tr>
            <th className="text-left font-semibold text-ink-soft">
              <span className="sr-only">Option</span>
            </th>
            {Array.from({ length: k }, (_, p) => (
              <th key={p} scope="col" className="font-display px-1 text-center font-semibold text-ink-soft">
                {ordinal(p + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tally.rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="max-w-[16ch] pr-2 text-left font-bold break-words">
                {r.name}
              </th>
              {r.places.map((n, p) => {
                const a = n / max;
                return (
                  <td
                    key={p}
                    className="font-display h-[clamp(2.4rem,5vh,3.6rem)] min-w-[2.8rem] rounded-lg border border-line text-center font-semibold tabular-nums transition-colors duration-500"
                    style={{
                      // light tint in every design, so the number is always dark ink
                      backgroundColor: n ? `color-mix(in srgb, ${topicColor(r.index)} ${Math.round(25 + a * 75)}%, #ffffff)` : "var(--color-white, #ffffff)",
                      color: n ? INK : undefined,
                    }}
                    aria-label={`${r.name}: ${n} ${n === 1 ? "person" : "people"} put it ${ordinal(p + 1)}`}
                  >
                    {n || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
