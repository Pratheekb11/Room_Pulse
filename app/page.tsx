import type { Viewport } from "next";
import Link from "next/link";
import { Credit } from "@/components/Credit";
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
import { LinkRow } from "@/components/home/LinkRow";
import { Reveal } from "@/components/home/Reveal";

// the browser bar matches the page's dark canvas
export const viewport: Viewport = { themeColor: "#131314" };

const STEPS = [
  { title: "Write your questions", body: "Up to 10. It takes a couple of minutes." },
  { title: "Show the QR code", body: "People scan it with their phone. No app." },
  { title: "Watch the answers", body: "Results appear on your screen as people tap." },
];

const H2 = "font-display font-normal text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.04] tracking-[-0.04em] text-ink";

// Quiet: two tones, one weight of type, hairlines and room. The only accent is the logo's colour.
export default function Home() {
  return (
    <div className="home-quiet min-h-dvh">
      <WarmUp />
      <header className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between gap-3 px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-5 text-[15px] whitespace-nowrap sm:gap-7">
          <Link href="/admin" className="text-ink-soft transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/admin" className="text-ink underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-ink">
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Create a presentation</span>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 sm:px-8">
        <section className="pt-16 pb-6 sm:pt-28 lg:pt-36">
          <h1 className="font-display max-w-[15ch] text-[clamp(2.75rem,7.2vw,6rem)] leading-[1] font-normal tracking-[-0.045em] text-ink">
            <span className="line-mask">
              <span className="line-rise">Know what the room thinks.</span>
            </span>
            <span className="line-mask">
              <span className="line-rise [animation-delay:300ms]">Right now.</span>
            </span>
          </h1>

          <div className="animate-fade mt-14 grid grid-cols-1 gap-x-12 gap-y-12 [animation-delay:700ms] [animation-duration:1200ms] lg:mt-20 lg:grid-cols-2">
            <div className="min-w-0 lg:order-2">
              <p className="max-w-md text-[17px] leading-relaxed text-ink-soft">
                Ask your audience questions. They answer on their phones, and the results show up on your screen straight away.
              </p>
              <p className="mt-4 max-w-md text-[17px] leading-relaxed text-ink-soft">Free. Start as a guest: no sign-up, nothing to install.</p>
            </div>
            <div className="min-w-0 lg:order-1">
              <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link href="/admin" className="inline-flex h-12 items-center rounded-md bg-ink px-6 text-base text-canvas transition-opacity hover:opacity-85">
                  Create a presentation
                </Link>
                <HowToButton label="See how it works" className="text-ink underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-ink" />
              </div>
              <div className="mt-10 max-w-md">
                <p className="text-sm text-muted">Have a code? Join a presentation.</p>
                <JoinForm />
              </div>
            </div>
          </div>

          <div aria-hidden className="mt-16 flex justify-center sm:mt-20">
            <span className="thread h-20 sm:h-28" />
          </div>
          <Reveal className="mt-6">
            <LiveDemo />
          </Reveal>
        </section>

        <section className="pt-28 sm:pt-40" aria-labelledby="how-h">
          <Reveal>
            <h2 id="how-h" className={H2}>
              How it works
            </h2>
          </Reveal>
          <ol className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="min-w-0">
                <Reveal delay={i * 120} className="border-t border-line pt-5 pb-8">
                  <span className="text-sm text-muted tabular-nums">0{i + 1}</span>
                  <h3 className="mt-6 text-lg text-ink">{step.title}</h3>
                  <p className="mt-1 text-ink-soft">{step.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section className="pt-28 sm:pt-40" aria-labelledby="activities-h">
          <Reveal>
            <div className="grid grid-cols-1 items-start gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="min-w-0">
                <h2 id="activities-h" className={`${H2} max-w-[14ch]`}>
                  Team activities everyone can join
                </h2>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft">
                  In the room or on a call, everyone writes from their phone and the picture fills up live.
                </p>
                <ul className="mt-10 grid grid-cols-1 gap-x-8 text-ink-soft min-[420px]:grid-cols-2" aria-label="Team activities">
                  {ACTIVITIES.map((a) => (
                    <li key={a.id} title={a.blurb} className="border-t border-line py-2.5">
                      {a.label}
                    </li>
                  ))}
                </ul>
                <LinkRow href="/admin" className="mt-8 max-w-md">
                  Start an activity
                </LinkRow>
              </div>
              <div className="min-w-0">
                <MiniTree />
              </div>
            </div>
          </Reveal>
        </section>

        <section className="pt-28 sm:pt-40" aria-labelledby="features-h">
          <Reveal>
            <h2 id="features-h" className={H2}>
              What you can do
            </h2>
          </Reveal>
          <Reveal>
            <FeatureList ai={aiAvailable()} />
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
              <p className="text-ink">Question types</p>
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
                {KIND_INFO.map((k) => (
                  <li key={k.id} title={k.hint}>
                    {k.label}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        <section className="pt-28 pb-24 text-center sm:pt-36 sm:pb-32">
          <Reveal>
            <div aria-hidden className="flex justify-center">
              <span className="thread h-24 sm:h-36" />
            </div>
            <h2 className={`${H2} mt-10 text-muted`}>Ready when you are.</h2>
            <Link
              href="/admin"
              className="font-display mt-3 inline-block text-[clamp(2.4rem,7vw,5.5rem)] leading-[1.02] tracking-[-0.045em] text-ink underline decoration-line-strong decoration-1 underline-offset-[0.18em] transition-colors hover:decoration-ink"
            >
              Create a presentation
            </Link>
            <p className="mt-6 text-ink-soft">Free. Start as a guest: no sign-up, no email.</p>
            <svg aria-hidden viewBox="0 0 20 20" className="mx-auto mt-12 h-10 w-10">
              <path d="M2 11h3.5l2.5-6 4 11 2.5-5H18" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-x-8 gap-y-6 px-5 pt-10 pb-4 text-sm text-ink-soft sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          <div>
            <Logo />
          </div>
          <p className="max-w-xs">Answers are anonymous. We don&rsquo;t store names or IP addresses.</p>
          <ul className="flex flex-col gap-1.5">
            <li>
              <Link href="/admin" className="hover:text-ink">
                Create a presentation
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-ink">
                Log in
              </Link>
            </li>
          </ul>
          <div className="lg:text-right [&_p]:px-0 [&_p]:text-left lg:[&_p]:text-right">
            <Credit />
          </div>
        </div>
      </footer>
    </div>
  );
}
