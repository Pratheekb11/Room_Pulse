import { productFeatures } from "@/lib/features";

/** "What you can do": the home page's feature grid. */
export function FeatureList({ ai }: { ai: boolean }) {
  return (
    <ul className="stagger mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {productFeatures({ ai }).map((f) => (
        <li key={f.title} className="rounded-xl border border-line bg-white p-5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink">
            <span aria-hidden>{f.icon}</span>
            {f.title}
            {f.tag && <span className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-bold text-ink">{f.tag}</span>}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
        </li>
      ))}
    </ul>
  );
}
