import { Credit } from "@/components/Credit";
import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { FeatureList } from "@/components/FeatureList";
import { HowToButton } from "@/components/HowToButton";
import { LiveDemo } from "@/components/LiveDemo";
import { aiAvailable } from "@/lib/ai";
import { Logo } from "@/components/Logo";
import { WarmUp } from "@/components/WarmUp";
import { KIND_INFO } from "@/lib/kinds";
import { ACTIVITIES } from "@/lib/activities";
import { MiniTree } from "@/components/MiniTree";

const CHIP_COLORS = ["bg-peach", "bg-sky", "bg-mint", "bg-lavender"];

const STEPS = [
  { title: "Write your questions", body: "Up to 10. It takes a couple of minutes." },
  { title: "Show the QR code", body: "People scan it with their phone. No app." },
  { title: "Watch the answers", body: "Results appear on your screen as people tap." },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <WarmUp />
      <header className="mx-auto flex h-[72px] max-w-[1200px] gap-3 items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap">
          <Link href="/admin" className="flex h-10 items-center rounded-lg border border-line-strong bg-white px-3.5 text-ink hover:bg-line-soft">
            Log in
          </Link>
          <Link href="/admin" className="key flex h-10 items-center rounded-lg bg-primary px-4 text-white">
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Create a presentation</span>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <section className="stagger grid grid-cols-1 gap-10 pt-12 pb-14 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.5rem,5.6vw,4rem)] leading-[1.04] text-ink">
              <span className="block">Know what the room thinks.</span>
              <span className="block text-ink-soft">Right now.</span>
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
              Ask your audience questions. They answer on their phones, and the results show up on your screen straight away.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/admin" className="key flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white">
                Create a presentation
              </Link>
              <HowToButton label="▶ See how it works" />
            </div>
            <p className="mt-3 text-sm text-ink-soft">Free. Start as a guest: no sign-up, nothing to install.</p>

            <div className="mt-9 max-w-md border-t border-line pt-5">
              <p className="text-sm font-semibold text-ink">Have a code? Join a presentation.</p>
              <JoinForm />
            </div>
          </div>
          <div className="min-w-0">
            <LiveDemo />
          </div>
        </section>

        <section className="border-t border-line py-14" aria-labelledby="how-h">
          <h2 id="how-h" className="font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-tight text-ink">
            How it works
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="font-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <p className="text-[15px] leading-snug text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-line py-14" aria-labelledby="activities-h">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <h2 id="activities-h" className="font-display max-w-xl text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">
                Team activities everyone can join
              </h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-soft">
                In the room or on a call, everyone writes from their phone and the picture fills up live.
              </p>
              <ul className="mt-6 flex max-w-xl flex-wrap gap-2" aria-label="Team activities">
                {ACTIVITIES.map((a) => (
                  <li key={a.id} title={a.blurb} className="flex items-center gap-1.5 rounded-full border border-line bg-white py-1.5 pr-3.5 pl-2.5 text-sm font-semibold text-ink">
                    <span aria-hidden>{a.icon}</span>
                    {a.label}
                  </li>
                ))}
              </ul>
              <Link href="/admin" className="key mt-7 inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-white">
                Start an activity
              </Link>
            </div>
            <MiniTree />
          </div>
        </section>

        <section className="border-t border-line py-14" aria-labelledby="features-h">
          <h2 id="features-h" className="font-display max-w-xl text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">
            What you can do
          </h2>
          <FeatureList ai={aiAvailable()} />
          <div className="mt-10 rounded-2xl border border-line bg-white p-5">
            <h3 className="font-semibold text-ink">Ask it your way: {KIND_INFO.length} kinds of question</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {KIND_INFO.map((k, i) => (
                <li key={k.id} title={k.hint} className={`${CHIP_COLORS[i % CHIP_COLORS.length]} rounded-full px-3 py-1.5 text-sm font-semibold text-ink`}>
                  {k.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-line py-16 text-center">
          <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-tight text-ink">Ready to try it?</h2>
          <Link href="/admin" className="key mt-7 inline-flex h-12 items-center rounded-lg bg-primary px-6 text-base font-bold text-white">
            Create a presentation
          </Link>
          <p className="mt-3 text-sm text-muted">Free. Start as a guest: no sign-up, no email.</p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft sm:px-8">
          <Logo />
          <p>Answers are anonymous. We don&rsquo;t store names or IP addresses.</p>
        </div>
        <Credit />
      </footer>
    </div>
  );
}
