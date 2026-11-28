import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Words } from "@/components/home/Words";
import { PRIVACY_CONTACT, PRIVACY_SECTIONS, PRIVACY_UPDATED } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy · LiveRate", description: "What LiveRate keeps, why, and for how long." };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

export default function PrivacyPage() {
  return (
    <div className="quiet contents">
      <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8">
        <Logo />
        <article className="mx-auto w-full max-w-2xl py-10 sm:py-16">
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            <Words text="Privacy" />
          </h1>
          <p className="enter mt-3 text-ink-soft" style={{ "--i": 1 } as CSSProperties}>
            Last updated {PRIVACY_UPDATED}. What LiveRate keeps, why, and for how long, in plain words.
          </p>

          {PRIVACY_SECTIONS.map((s, i) => (
            <section key={s.heading} className="enter mt-10 border-t border-line pt-6" style={{ "--i": Math.min(i + 2, 6) } as CSSProperties}>
              <h2 className="font-display text-2xl tracking-tight">{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-ink-soft">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-ink-soft">
                  {s.list.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <p className="mt-10 border-t border-line pt-6 leading-relaxed text-ink-soft">
            Questions or deletion requests:{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`} className="sweep text-ink">
              {PRIVACY_CONTACT}
            </a>
          </p>
          <p className="mt-6">
            <Link href="/" className="sweep text-ink">
              ← Back to the home page
            </Link>
          </p>
        </article>
      </main>
    </div>
  );
}
