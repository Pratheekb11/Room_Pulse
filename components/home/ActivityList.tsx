import type { CSSProperties } from "react";
import { Fold } from "./Fold";

export interface ActivityItem {
  id: string;
  label: string;
  blurb: string;
  minutes: number;
}

/** One activity: its name, how long it takes and what it is. Opens the builder with it ready to go. */
function ActivityLink({ a }: { a: ActivityItem }) {
  return (
    <a href={`/admin?activity=${a.id}`} className="group block py-4">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-lg text-ink transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-1.5">
          {a.label}
          <span aria-hidden className="ml-2 inline-block text-ink-soft opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            →
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted tabular-nums">{a.minutes} min</span>
      </span>
      <span className="mt-1 block text-[15px] leading-snug text-ink-soft">{a.blurb}</span>
    </a>
  );
}

/**
 * The home page's team activities: the first few, the rest folded. Every one shows how long it takes and what it is,
 * and opens the builder with that activity (`/admin?activity=<id>`).
 */
export function ActivityList({ items, featured = 4 }: { items: ActivityItem[]; featured?: number }) {
  const rest = items.slice(featured);
  return (
    <div>
      <ul aria-label="Team activities" className="grid grid-cols-1">
        {items.slice(0, featured).map((a, i) => (
          <li key={a.id} style={{ "--i": i } as CSSProperties} className="rule">
            <ActivityLink a={a} />
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <Fold id="more-activities" more={`See all ${items.length} activities`}>
          <ul aria-label="More team activities" className="grid grid-cols-1 pb-1">
            {rest.map((a, i) => (
              <li key={a.id} style={{ "--j": i } as CSSProperties} className="unfold-item border-t border-line">
                <ActivityLink a={a} />
              </li>
            ))}
          </ul>
        </Fold>
      )}
    </div>
  );
}
