import { productFeatures } from "@/lib/features";
import { Sticker } from "./Sticker";

// The tiles take turns at being cobalt, volt and white, so the grid reads as the home page's duotone.
const TILES = [
  { card: "bg-white", icon: "bg-volt", title: "text-ink", body: "text-ink-soft" },
  { card: "bg-primary", icon: "bg-white", title: "text-white", body: "text-white/85" },
  { card: "bg-volt", icon: "bg-white", title: "text-ink", body: "text-ink" },
];

/** "What you can do": the home page's features at a glance: an icon, a name and a few words each. */
export function FeatureList({ ai }: { ai: boolean }) {
  return (
    <ul className="stagger mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {productFeatures({ ai }).map((f, i) => {
        const t = TILES[i % TILES.length];
        return (
          <li key={f.title} className={`lift wiggle-on-hover flex min-w-0 items-start gap-4 rounded-3xl border-2 border-ink p-5 ${t.card}`}>
            <span aria-hidden className={`wiggle grid h-12 w-12 shrink-0 place-items-center rounded-2xl border-2 border-ink ${t.icon}`}>
              <Sticker name={f.icon} size={28} />
            </span>
            <span className="min-w-0">
              <span className={`font-display flex flex-wrap items-center gap-x-2 gap-y-1 text-lg leading-tight ${t.title}`}>
                {f.title}
                {f.tag && <span className="rounded-full border-2 border-ink bg-white px-2 py-0.5 font-sans text-[11px] font-bold text-ink">{f.tag}</span>}
              </span>
              <span className={`mt-1 block text-[15px] leading-snug ${t.body}`}>{f.short}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
