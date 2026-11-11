import { formatNumber, type NumberStats } from "@/lib/answers";
import { CountUp } from "../CountUp";

const withUnit = (v: number | null, unit: string | null) => `${formatNumber(v)}${unit && v !== null ? ` ${unit}` : ""}`;

/** Column per range of numbers, with the average marked. */
export function NumberHistogram({ stats, min, max, unit }: { stats: NumberStats; min: number; max: number; unit: string | null }) {
  const top = Math.max(1, ...stats.bins.map((b) => b.n));
  // one bar per whole number (small ranges like 1 to 5)
  const singles = stats.bins.every((b) => b.from === b.to);
  // With one bar per number, bar i is centred at (i + 0.5) / count of the width.
  const meanPct =
    stats.mean === null ? null
    : singles ? ((stats.mean - min + 0.5) / stats.bins.length) * 100
    : ((stats.mean - min) / (max - min)) * 100;
  return (
    <div>
      <p className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[clamp(1rem,1.4vw,1.6rem)] font-semibold text-ink-soft">
        <span>
          Average <span className="font-display text-ink">{withUnit(stats.mean, unit)}</span>
        </span>
        <span>
          Middle value <span className="font-display text-ink">{withUnit(stats.median, unit)}</span>
        </span>
        <span>
          {stats.n} {stats.n === 1 ? "answer" : "answers"}
        </span>
      </p>
      <div className="relative">
        <div
          className="flex h-[clamp(14rem,44vh,30rem)] items-end gap-[clamp(0.2rem,0.6vw,0.7rem)] border-b border-line-strong"
          role="img"
          aria-label={stats.bins.map((b) => `${formatNumber(b.from)}${singles ? "" : ` to ${formatNumber(b.to)}`}: ${b.n}`).join(", ")}
        >
          {stats.bins.map((b, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              {b.n > 0 && <span className="font-display mb-1 text-[clamp(0.9rem,1.3vw,1.5rem)] font-semibold tabular-nums">{b.n}</span>}
              <div
                className="w-full rounded-t-lg bg-sky transition-[height] duration-700 ease-[cubic-bezier(0.3,1.3,0.5,1)]"
                style={{ height: `${(b.n / top) * 85}%`, minHeight: b.n ? 4 : 0 }}
              />
            </div>
          ))}
        </div>
        {meanPct !== null && (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-primary" style={{ left: `${Math.min(100, Math.max(0, meanPct))}%` }}>
            <span className="absolute -top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-xs font-bold whitespace-nowrap text-white">average</span>
          </div>
        )}
      </div>
      {singles ? (
        <div className="mt-1 flex gap-[clamp(0.2rem,0.6vw,0.7rem)] text-[clamp(0.75rem,0.95vw,1.05rem)] font-semibold text-ink-soft">
          {stats.bins.map((b) => (
            <span key={b.from} className="min-w-0 flex-1 text-center">
              {formatNumber(b.from)}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-1 flex justify-between text-[clamp(0.75rem,0.95vw,1.05rem)] font-semibold text-ink-soft">
          <span>{formatNumber(min)}</span>
          <span>{formatNumber((min + max) / 2)}</span>
          <span>{withUnit(max, unit)}</span>
        </div>
      )}
    </div>
  );
}

/** Big average and middle value, with the lowest and highest answers. */
export function NumberSummary({ stats, unit }: { stats: NumberStats; unit: string | null }) {
  const tile = "rounded-xl border border-line-strong bg-canvas-soft p-[clamp(0.8rem,1.6vw,1.8rem)]";
  const label = "text-[clamp(0.85rem,1.1vw,1.25rem)] font-semibold text-ink-soft";
  const big = "font-display mt-1 block text-[clamp(2.4rem,6vw,6.5rem)] leading-none font-semibold tabular-nums break-words";
  return (
    <div className="grid grid-cols-1 gap-[clamp(0.6rem,1.2vw,1.4rem)] sm:grid-cols-2">
      <div className={tile}>
        <span className={label}>Average</span>
        <span className={big}>
          {stats.mean === null ? "–" : formatNumber(stats.mean)}
          {unit && stats.mean !== null && <span className="ml-2 text-[0.4em] text-ink-soft">{unit}</span>}
        </span>
      </div>
      <div className={tile}>
        <span className={label}>Middle value</span>
        <span className={big}>
          {stats.median === null ? "–" : formatNumber(stats.median)}
          {unit && stats.median !== null && <span className="ml-2 text-[0.4em] text-ink-soft">{unit}</span>}
        </span>
      </div>
      <div className={`${tile} flex flex-wrap justify-between gap-4 sm:col-span-2`}>
        <span>
          <span className={label}>Lowest</span>
          <span className="font-display block text-[clamp(1.4rem,2.4vw,2.8rem)] font-semibold">{withUnit(stats.low, unit)}</span>
        </span>
        <span>
          <span className={label}>Highest</span>
          <span className="font-display block text-[clamp(1.4rem,2.4vw,2.8rem)] font-semibold">{withUnit(stats.high, unit)}</span>
        </span>
        <span>
          <span className={label}>Answers</span>
          <span className="font-display block text-[clamp(1.4rem,2.4vw,2.8rem)] font-semibold">
            <CountUp value={stats.n} />
          </span>
        </span>
      </div>
    </div>
  );
}
