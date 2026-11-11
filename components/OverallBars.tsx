import { topicColor } from "@/lib/colors";
import { CountUp } from "./CountUp";

export interface BarDatum {
  id: string;
  name: string;
  description?: string | null;
  value: number | null;
  n: number;
  /** Original topic index, for its identity colour. */
  index: number;
  /** Rank by average (1 = best); with `ranked`, shown instead of the list position. */
  rank?: number | null;
}

interface Props {
  data: BarDatum[];
  scaleMax: number;
  size?: "compact" | "large";
  ranked?: boolean;
}

/** Horizontal bars built from divs; width = value / scaleMax. */
export function OverallBars({ data, scaleMax, size = "compact", ranked = false }: Props) {
  const large = size === "large";
  return (
    <ol
      className={large ? "flex flex-col gap-[clamp(0.6rem,1.6vh,1.3rem)]" : "grid gap-x-10 gap-y-2"}
      // Compact view: two columns read top-to-bottom, so long lists still fit a 16:9 screen.
      style={
        !large && data.length > 4
          ? {
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gridTemplateRows: `repeat(${Math.ceil(data.length / 2)}, auto)`,
              gridAutoFlow: "column",
            }
          : large
            ? undefined
            : // One column that never grows past the card, whatever the text inside.
              { gridTemplateColumns: "minmax(0, 1fr)" }
      } aria-label="Average score per item">
      {data.map((d, pos) => {
        const rank = d.rank === undefined ? (d.value === null ? null : pos + 1) : d.rank;
        const pct = d.value === null ? 0 : (d.value / scaleMax) * 100;
        const color = topicColor(d.index);
        return (
          <li key={d.id} className="flex items-center gap-3">
            {ranked && (
              <span
                className={`font-display flex shrink-0 items-center justify-center rounded-full border border-line-strong font-semibold ${
                  rank === 1 ? "bg-sun" : "bg-white"
                } ${large ? "h-[clamp(2.4rem,4.6vh,3.6rem)] w-[clamp(2.4rem,4.6vh,3.6rem)] text-[clamp(1.1rem,1.6vw,1.8rem)]" : "h-8 w-8 text-base"}`}
                aria-label={rank === null ? "Not scored yet" : `Rank ${rank}`}
              >
                {rank ?? "–"}
              </span>
            )}
            <span className={`flex min-w-0 shrink-0 flex-col ${large ? "w-[32%]" : "w-[34%]"}`}>
              <span
                className={`leading-tight font-bold break-words ${large ? "text-[clamp(1.1rem,1.6vw,2rem)]" : "text-[clamp(0.95rem,1.1vw,1.3rem)]"}`}
                title={d.name}
              >
                {d.name}
              </span>
              {d.description && (
                <span
                  className={`font-semibold leading-snug text-ink-soft ${large ? "line-clamp-2 text-[clamp(0.8rem,1vw,1.15rem)]" : "truncate text-[clamp(0.7rem,0.8vw,0.9rem)]"}`}
                  title={d.description}
                >
                  {d.description}
                </span>
              )}
            </span>
            <span
              className={`relative flex-1 overflow-hidden rounded-full border border-line-strong bg-white ${
                large ? "h-[clamp(2.4rem,5.4vh,4.2rem)]" : "h-[clamp(1.4rem,2.6vh,2.1rem)]"
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </span>
            <span
              className={`font-display shrink-0 text-right font-semibold tabular-nums ${
                large ? "w-[5.5ch] text-[clamp(1.4rem,2.2vw,2.6rem)]" : "w-[4.5ch] text-[clamp(1.1rem,1.5vw,1.7rem)]"
              }`}
            >
              <CountUp value={d.value} format={(v) => v.toFixed(1)} />
            </span>
            {large && (
              <span className="w-[9ch] shrink-0 whitespace-nowrap text-[clamp(0.85rem,1vw,1.15rem)] font-semibold text-ink-soft">
                {d.n} {d.n === 1 ? "vote" : "votes"}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
