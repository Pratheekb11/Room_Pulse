import { productFeatures } from "@/lib/features";
import { Sticker } from "./Sticker";

/** "What you can do": the home page's features at a glance: an icon, a name and a few words each. */
export function FeatureList({ ai }: { ai: boolean }) {
  return (
    <ul className="stagger mt-8 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {productFeatures({ ai }).map((f) => (
        <li key={f.title} className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-white">
            <Sticker name={f.icon} size={26} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink">
              {f.title}
              {f.tag && <span className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-bold text-ink">{f.tag}</span>}
            </span>
            <span className="block text-[15px] leading-snug text-ink-soft">{f.short}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
