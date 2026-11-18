import { productFeatures } from "@/lib/features";

/** "What you can do": the home page's features as a list of rows on hairlines: a name and a few words each. */
export function FeatureList({ ai }: { ai: boolean }) {
  return (
    <ul className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-2">
      {productFeatures({ ai }).map((f) => (
        <li key={f.title} className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-1 border-t border-line py-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <span className="text-ink">
            {f.title}
            {f.tag && <span className="ml-2 text-sm text-muted">{f.tag}</span>}
          </span>
          <span className="text-ink-soft">{f.short}</span>
        </li>
      ))}
    </ul>
  );
}
