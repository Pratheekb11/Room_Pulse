"use client";

import { HowToDemo } from "../HowToDemo";
import { productFeatures } from "@/lib/features";

/** Beside the builder and the sign-in: the "Show me how" walkthrough and what LiveRate can do. */
export function BuilderSide({ ai }: { ai: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="how-side-h" className="slab rounded-xl bg-white p-4 sm:p-5">
        <h2 id="how-side-h" className="font-display text-2xl">
          See how it works
        </h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">Pick a question type to watch it being made, answered on a phone and shown on screen.</p>
        <HowToDemo compact />
      </section>

      <section aria-labelledby="features-h">
        <h2 id="features-h" className="font-display text-2xl">
          What you can do
        </h2>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {productFeatures({ ai }).map((f) => (
            <li key={f.title} className="rounded-xl border border-line bg-white p-4">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                <span aria-hidden>{f.icon}</span>
                {f.title}
                {f.tag && <span className="rounded-full bg-lavender px-2 py-0.5 text-[11px] font-bold text-ink">{f.tag}</span>}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
