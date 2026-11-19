import type { CSSProperties } from "react";
import { productFeatures, type Feature } from "@/lib/features";
import { KIND_INFO } from "@/lib/kinds";
import { Fold } from "./home/Fold";

const FEATURED = 4;

function Row({ f, style, className }: { f: Feature; style: CSSProperties; className: string }) {
  return (
    <li style={style} className={`group grid min-w-0 grid-cols-1 gap-x-6 gap-y-0.5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] ${className}`}>
      <span className="text-ink transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:translate-x-1.5">
        {f.title}
        {f.tag && <span className="ml-2 text-sm text-muted">{f.tag}</span>}
      </span>
      <span className="text-ink-soft transition-colors duration-500 group-hover:text-ink">{f.short}</span>
    </li>
  );
}

/**
 * "What you can do": the home page's features as rows on hairlines, a name and a few words each. The first few show;
 * the rest and the question types unfold from a button, so the list stays short on a phone.
 * Shown rows draw their hairline in after the one before (`.rule`, `--i`); unfolded ones slide in (`--j`).
 */
export function FeatureList({ ai }: { ai: boolean }) {
  const all = productFeatures({ ai });
  const rest = all.slice(FEATURED);
  return (
    <div className="mt-12">
      <ul className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
        {all.slice(0, FEATURED).map((f, i) => (
          <Row key={f.title} f={f} style={{ "--i": i } as CSSProperties} className="rule" />
        ))}
      </ul>
      <Fold id="more-features" more={`See all ${all.length} features`}>
        <ul className="grid grid-cols-1 gap-x-12 md:grid-cols-2">
          {rest.map((f, j) => (
            <Row key={f.title} f={f} style={{ "--j": j } as CSSProperties} className="unfold-item border-t border-line" />
          ))}
        </ul>
        <div style={{ "--j": rest.length } as CSSProperties} className="unfold-item grid grid-cols-1 gap-x-6 gap-y-1 border-t border-line pt-4 pb-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
          <p className="text-ink">Question types</p>
          <ul aria-label="Question types" className="flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
            {KIND_INFO.map((k) => (
              <li key={k.id} title={k.hint}>
                {k.label}
              </li>
            ))}
          </ul>
        </div>
      </Fold>
    </div>
  );
}
