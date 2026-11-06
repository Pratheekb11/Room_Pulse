import { topicColor } from "@/lib/colors";
import { CountUp } from "./CountUp";

export interface BarDatum {
  id: string;
  name: string;
  value: number | null;
  n: number;
  /** Original topic index, for its identity colour. */
  index: number;
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
          : undefined
      } aria-label="Average score per item">
      {data.map((d, rank) => {
        const pct = d.value === null ? 0 : (d.value / scaleMax) * 100;
        const color = topicColor(d.index);
        return (
          <li key={d.id} className="flex items-center gap-3">
            {ranked && (
              <span
                className={`font-display flex shrink-0 items-center justify-center rounded-full border border-line-strong font-semibold ${
                  rank === 0 && d.value !== null ? "bg-sun" : "bg-white"
                } ${large ? "h-[clamp(2.4rem,4.6vh,3.6rem)] w-[clamp(2.4rem,4.6vh,3.6rem)] text-[clamp(1.1rem,1.6vw,1.8rem)]" : "h-8 w-8 text-base"}`}
                aria-label={`Rank ${rank + 1}`}
              >
                {rank + 1}
              </span>
            )}
            <span
              className={`shrink-0 truncate font-bold ${
                large ? "w-[32%] text-[clamp(1.1rem,1.6vw,2rem)]" : "w-[34%] text-[clamp(0.95rem,1.1vw,1.3rem)]"
              }`}
              title={d.name}
            >
              {d.name}
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
