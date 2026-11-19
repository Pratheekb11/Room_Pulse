import type { CSSProperties } from "react";
import { Fold } from "./Fold";

export interface ActivityItem {
  id: string;
  label: string;
  blurb: string;
  minutes: number;
}

/** The home page's team activities: the first few with what they are and how long they take, the rest folded. */
export function ActivityList({ items, featured = 4 }: { items: ActivityItem[]; featured?: number }) {
  const rest = items.slice(featured);
  return (
    <div>
      <ul aria-label="Team activities" className="grid grid-cols-1">
        {items.slice(0, featured).map((a, i) => (
          <li key={a.id} style={{ "--i": i } as CSSProperties} className="rule group py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg text-ink transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-1.5">{a.label}</span>
              <span className="text-sm text-muted tabular-nums">{a.minutes} min</span>
            </div>
            <p className="mt-1 text-[15px] leading-snug text-ink-soft">{a.blurb}</p>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <Fold id="more-activities" more={`See all ${items.length} activities`}>
          <ul aria-label="More team activities" className="grid grid-cols-1 gap-x-8 pb-1 min-[420px]:grid-cols-2">
            {rest.map((a, i) => (
              <li key={a.id} title={a.blurb} style={{ "--j": i } as CSSProperties} className="unfold-item border-t border-line py-2.5 text-ink-soft">
                {a.label}
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </div>
  );
}
