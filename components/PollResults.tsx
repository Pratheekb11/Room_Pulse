import { readableOn, topicColor } from "@/lib/colors";
import type { PollTally } from "@/lib/answers";
import { CountUp } from "./CountUp";
import { OptionPicture } from "./Picture";

const LETTERS = "ABCDEFGHIJ";

/** Words for the count next to each option, e.g. ["vote", "votes"] or ["person", "people"]. */
type Noun = [string, string];
const VOTES: Noun = ["vote", "votes"];

export function PollBars({ tally, noun = VOTES }: { tally: PollTally; noun?: Noun }) {
  return (
    <ol className="flex flex-col gap-[clamp(0.6rem,1.6vh,1.2rem)]" aria-label="Poll results">
      {tally.rows.map((r) => {
        const c = topicColor(r.index);
        const lead = tally.leader?.id === r.id;
        return (
          <li key={r.id} className="flex items-center gap-3">
            <span
              className="font-display flex h-[clamp(2rem,4.6vh,3.4rem)] w-[clamp(2rem,4.6vh,3.4rem)] shrink-0 items-center justify-center rounded-lg border border-line-strong text-[clamp(1.1rem,1.5vw,1.7rem)] font-semibold"
              style={{ backgroundColor: c, color: readableOn(c) }}
              aria-hidden
            >
              {LETTERS[r.index]}
            </span>
            <OptionPicture id={r.imageId} size="screen" />
            <span className="w-[34%] shrink-0 text-[clamp(1rem,1.5vw,1.8rem)] sm:w-[26%] font-bold leading-tight break-words">
              {r.name} {lead && <span aria-label="leading">👑</span>}
            </span>
            <span className="relative h-6 sm:h-[clamp(1.5rem,4.6vh,3.8rem)] flex-1 overflow-hidden rounded-full border border-line-strong bg-white">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
                style={{ width: `${r.pct}%`, backgroundColor: c }}
              />
            </span>
            <span className="font-display w-[4ch] shrink-0 text-right text-[clamp(1.1rem,2.2vw,2.6rem)] font-semibold tabular-nums">
              <CountUp value={r.pct} />%
            </span>
            <span className="hidden w-[8ch] shrink-0 text-[clamp(0.85rem,1vw,1.15rem)] font-semibold whitespace-nowrap text-ink-soft sm:inline">
              {r.n} {r.n === 1 ? noun[0] : noun[1]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Vertical columns, one per option. */
export function PollColumns({ tally, noun = VOTES }: { tally: PollTally; noun?: Noun }) {
  // More than 5 columns don't fit a narrow screen: there the same results show as bars.
  // Container queries: the builder's preview draws the big screen at 1280px on any device.
  const many = tally.rows.length > 5;
  return (
    <div className="@container">
      {many && (
        <div className="@3xl:hidden">
          <PollBars tally={tally} noun={noun} />
        </div>
      )}
    <div className={`flex h-[clamp(16rem,52vh,36rem)] items-end gap-[clamp(0.5rem,1.6vw,2rem)] px-2 ${many ? "@max-3xl:hidden" : ""}`} role="img" aria-label={tally.rows.map((r) => `${r.name}: ${r.pct}%`).join(", ")}>
      {tally.rows.map((r) => {
        const c = topicColor(r.index);
        return (
          <div key={r.id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            <span className="font-display text-[clamp(1.4rem,2.4vw,2.8rem)] font-semibold tabular-nums leading-none"><CountUp value={r.pct} />%</span>
            <span className="mb-2 text-[clamp(0.8rem,1vw,1.1rem)] font-semibold text-ink-soft">
              {r.n} {r.n === 1 ? noun[0] : noun[1]}
            </span>
            <div
              className="w-full max-w-[9rem] rounded-t-2xl border border-b-0 border-black/10 transition-[height] duration-700 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
              style={{ height: `${Math.max(r.pct, r.n ? 2 : 0)}%`, backgroundColor: c }}
            />
            <div className="w-full border-t border-line-strong pt-2 text-center">
              <OptionPicture id={r.imageId} size="screen" className="mx-auto mb-1 block" />
              <span className="font-display mr-1 font-semibold">{LETTERS[r.index]}</span>
              <span className={`${many ? "text-[clamp(0.75rem,0.85vw,1.05rem)]" : "text-[0.8rem] sm:text-[clamp(0.9rem,1.25vw,1.4rem)]"} font-bold break-words hyphens-auto`}>{r.name}</span>
              {tally.leader?.id === r.id && <span aria-label="leading"> 👑</span>}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

/** Pie (hole=false) or donut chart of the poll. */
export function PollPie({ tally, hole = true }: { tally: PollTally; hole?: boolean }) {
  // A full pie is a thick stroke on a circle whose radius is half the stroke width.
  const R = hole ? 40 : 25;
  const W = hole ? 20 : 50;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-[clamp(1rem,4vw,5rem)]">
      <div className="relative aspect-square w-[clamp(16rem,32vw,34rem)]">
        <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={tally.rows.map((r) => `${r.name}: ${r.pct}%`).join(", ")}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line-soft)" strokeWidth={W} />
          {tally.total > 0 &&
            tally.rows.map((r) => {
              if (r.n === 0) return null;
              const pct = (r.n / tally.total) * 100;
              const seg = Math.max(0, pct - (tally.rows.filter((x) => x.n > 0).length > 1 ? 0.6 : 0));
              const el = (
                <circle
                  key={r.id}
                  cx="50"
                  cy="50"
                  r={R}
                  fill="none"
                  pathLength={100}
                  stroke={topicColor(r.index)}
                  strokeWidth={W}
                  strokeDasharray={`${seg} ${100 - seg}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 50 50)"
                  className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
                />
              );
              offset += pct;
              return el;
            })}
        </svg>
        {hole && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-[clamp(2rem,3.4vw,3.8rem)] font-semibold leading-none"><CountUp value={tally.total} /></span>
            <span className="text-[clamp(0.85rem,1vw,1.15rem)] font-semibold text-ink-soft">votes</span>
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {tally.rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 text-[clamp(1rem,1.4vw,1.6rem)] font-bold">
            <span aria-hidden className="h-6 w-6 shrink-0 rounded-md border border-line-strong" style={{ backgroundColor: topicColor(r.index) }} />
            <OptionPicture id={r.imageId} size="screen" />
            <span className="max-w-[18ch] break-words">{r.name}</span>
            <span className="font-display ml-auto pl-6 font-semibold tabular-nums">{r.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
