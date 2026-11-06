import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { LiveDemo } from "@/components/LiveDemo";
import { Logo } from "@/components/Logo";

const FEATURES = [
  {
    title: "Rate what matters",
    body: "Topics scored on your criteria. Heatmaps, rankings and a summary your exec team can read in ten seconds.",
    pill: "Rating",
    color: "bg-peach",
  },
  {
    title: "Polls that move",
    body: "One tap per person. Bars, columns or a pie that redraws itself as the room makes up its mind.",
    pill: "Poll",
    color: "bg-sky",
  },
  {
    title: "Hear every voice",
    body: "Up to three words each. A word cloud that grows on the projector while people are still typing.",
    pill: "Words",
    color: "bg-lavender",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 text-sm font-medium">
          <Link href="/admin" className="rounded-lg px-3 py-2 text-ink hover:bg-line-soft">
            Log in
          </Link>
          <Link href="/admin" className="key rounded-lg bg-primary px-4 py-2.5 text-white">
            Create a presentation
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <section className="stagger grid gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
          <div>
            <h1 className="font-display text-[clamp(2.5rem,5.6vw,4rem)] leading-[1.04] text-ink">
              Ask the room.
              <br />
              Watch it answer.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
              Live, anonymous voting for meetings and talks. Every tap lands on the big screen in under a second.
            </p>
            <JoinForm />
            <p className="mt-3 text-sm text-muted">Got a code from the screen? Enter it above. No sign-up.</p>
          </div>
          <LiveDemo />
        </section>

        <section className="border-t border-line py-20">
          <h2 className="font-display max-w-xl text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">Three ways to ask. One screen that keeps up.</h2>
          <div className="stagger mt-10 grid gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-line bg-white p-6">
                <span className={`${f.color} rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-ink uppercase`}>{f.pill}</span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-24 text-center">
          <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-tight text-ink">Your next meeting could decide something.</h2>
          <Link href="/admin" className="key mt-8 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white">
            Create a presentation
          </Link>
          <p className="mt-3 text-sm text-muted">Free. Try it as a guest, no sign-up.</p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft sm:px-8">
          <Logo />
          <p>Anonymous by design. No names, no IPs.</p>
        </div>
      </footer>
    </div>
  );
}
