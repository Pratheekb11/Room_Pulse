import type { CSSProperties } from "react";
import { productFeatures } from "@/lib/features";

/**
 * "What you can do": the home page's features as rows on hairlines: a name and a few words each.
 * Each row's hairline draws in from the left after the one before it (`.rule`, `--i`); the name steps right on hover.
 */
export function FeatureList({ ai }: { ai: boolean }) {
  return (
    <ul className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-2">
      {productFeatures({ ai }).map((f, i) => (
        <li
          key={f.title}
          style={{ "--i": i } as CSSProperties}
          className="rule group grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
        >
          <span className="text-ink transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-1.5">
            {f.title}
            {f.tag && <span className="ml-2 text-sm text-muted">{f.tag}</span>}
          </span>
          <span className="text-ink-soft transition-colors duration-500 group-hover:text-ink">{f.short}</span>
        </li>
      ))}
    </ul>
  );
}
