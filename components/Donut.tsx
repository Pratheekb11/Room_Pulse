import { scaleColor } from "@/lib/colors";

interface Props {
  counts: number[]; // counts[score - 1]
  scaleMax: number;
  center: string;
  label: string;
}

/** Score distribution as a donut (SVG stroke segments, animates between polls). */
export function Donut({ counts, scaleMax, center, label }: Props) {
  const total = counts.reduce((a, b) => a + b, 0);
  const R = 40;
  const GAP = total > 0 && counts.filter((c) => c > 0).length > 1 ? 0.8 : 0;
  let offset = 0;
  const summary = counts.map((c, i) => `${i + 1}: ${c}`).join(", ");

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={`${label}. Ratings by score — ${summary}`}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="#efeee8" strokeWidth="16" />
      {total > 0 &&
        counts.map((c, i) => {
          if (c === 0) return null;
          const pct = (c / total) * 100;
          const seg = Math.max(0, pct - GAP);
          const el = (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              pathLength={100}
              stroke={scaleColor(i + 1, scaleMax).bg}
              strokeWidth="16"
              strokeDasharray={`${seg} ${100 - seg}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 ease-out"
            />
          );
          offset += pct;
          return el;
        })}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display"
        style={{ fontSize: 22, fontWeight: 800, fill: "#26251e" }}
      >
        {center}
      </text>
    </svg>
  );
}

export function ScoreLegend({ scaleMax, lowLabel, highLabel }: { scaleMax: number; lowLabel: string; highLabel: string }) {
  return (
    <div className="flex items-center gap-3 text-[clamp(0.85rem,1vw,1.15rem)] font-semibold">
      <span>{lowLabel}</span>
      <span className="flex gap-1">
        {Array.from({ length: scaleMax }, (_, i) => {
          const c = scaleColor(i + 1, scaleMax);
          return (
            <span
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-ink/20 text-sm font-bold"
              style={{ backgroundColor: c.bg, color: c.fg }}
            >
              {i + 1}
            </span>
          );
        })}
      </span>
      <span>{highLabel}</span>
    </div>
  );
}
