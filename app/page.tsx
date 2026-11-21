import type { Viewport } from "next";
import Link from "next/link";
import { Credit } from "@/components/Credit";
import { JoinForm } from "@/components/JoinForm";
import { FeatureList } from "@/components/FeatureList";
import { HowToButton } from "@/components/HowToButton";
import { LiveRoom } from "@/components/home/LiveRoom";
import { aiAvailable } from "@/lib/ai";
import { Logo } from "@/components/Logo";
import { WarmUp } from "@/components/WarmUp";
import { ACTIVITIES } from "@/lib/activities";
import { MiniTree } from "@/components/MiniTree";
import { LinkRow } from "@/components/home/LinkRow";
import { ActivityList } from "@/components/home/ActivityList";
import { Reveal } from "@/components/home/Reveal";
import { Words } from "@/components/home/Words";
import type { CSSProperties } from "react";

// the browser bar matches the page's dark canvas
export const viewport: Viewport = { themeColor: "#131314" };

const STEPS = [
  { title: "Write your questions", body: "Up to 10. It takes a couple of minutes." },
  { title: "Show the QR code", body: "People scan it with their phone. No app." },
  { title: "Watch the answers", body: "Results appear on your screen as people tap." },
];

const PULSE = "M2 16h52l7-11 9 22 8-17 5 6h75";

const H2 = "font-display font-normal text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.04] tracking-[-0.04em] text-ink";

// Quiet: two tones, one weight of type, hairlines and room. The only accent is the logo's colour.
export default function Home() {
  return (
    <div className="quiet home-quiet min-h-dvh">
      <WarmUp />
      <header className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between gap-3 px-5 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-5 text-[15px] whitespace-nowrap sm:gap-7">
          <Link href="/admin" className="sweep text-ink-soft transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/admin" className="sweep text-ink">
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Create a presentation</span>
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 sm:px-8">
        {/* the hook: the headline beside a live room (a big screen in a real design, phones answering);
            on phones the room comes straight after the headline, before the buttons */}
        <section className="grid grid-cols-1 gap-x-14 gap-y-8 pt-6 pb-6 sm:pt-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-y-12 lg:pt-20">
          {/* on phones the headline, the room, then this line: the hook shows in the first screen */}
          <div className="contents lg:col-start-1 lg:row-start-1 lg:block lg:min-w-0 lg:self-end">
            <h1 className="font-display drift order-1 max-w-[15ch] text-[clamp(2.6rem,5.2vw,4.9rem)] leading-[1] font-normal tracking-[-0.045em] text-ink">
              <span className="block">
                <Words text="Know what the room thinks." />
              </span>
              <span className="block">
                <Words text="Right now." start={6} />
              </span>
            </h1>
            <p className="animate-fade order-3 max-w-md text-[17px] lg:mt-6 leading-relaxed text-ink-soft [animation-delay:600ms] [animation-duration:1000ms]">
              Ask your audience questions. They answer on their phones, and the results show up on your screen straight away.
            </p>
          </div>
          <div className="animate-fade order-2 min-w-0 [animation-delay:300ms] [animation-duration:1200ms] lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <LiveRoom />
          </div>
          <div className="animate-fade order-4 min-w-0 [animation-delay:800ms] [animation-duration:1000ms] lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/admin" className="inline-flex h-12 items-center rounded-md bg-ink px-6 text-base text-canvas transition-opacity hover:opacity-85">
                Create a presentation
              </Link>
              <HowToButton label="See how it works" className="sweep text-ink" />
            </div>
            <p className="mt-4 text-sm text-ink-soft">Free. Start as a guest: no sign-up, nothing to install.</p>
            <div className="mt-9 max-w-md">
              <p className="text-sm text-muted">Have a code? Join a presentation.</p>
              <JoinForm />
            </div>
          </div>
        </section>

        <section className="pt-28 sm:pt-40" aria-labelledby="how-h">
          <Reveal>
            <h2 id="how-h" className={H2}>
              <Words text="How it works" />
            </h2>
          </Reveal>
          <ol className="mt-12 grid grid-cols-1 gap-x-12 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="min-w-0">
                <Reveal delay={i * 120} className="rule pt-5 pb-8">
                  {/* a light passes along the line from step to step: write, scan, watch */}
                  <span aria-hidden className="glint" style={{ "--i": i } as CSSProperties} />
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
                  <Words text="Team activities everyone can join" />
                </h2>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft">
                  In the room or on a call, everyone writes from their phone and the picture fills up live.
                </p>
                <div className="mt-10">
                  <ActivityList items={ACTIVITIES.map((a) => ({ id: a.id, label: a.label, blurb: a.blurb, minutes: a.minutes }))} />
                </div>
                <LinkRow href="/admin" className="mt-8 max-w-md">
                  Start an activity
                </LinkRow>
              </div>
              <div className="float-scroll min-w-0">
                <MiniTree />
              </div>
            </div>
          </Reveal>
        </section>

        <section className="pt-28 sm:pt-40" aria-labelledby="features-h">
          <Reveal>
            <h2 id="features-h" className={H2}>
              <Words text="What you can do" />
            </h2>
          </Reveal>
          <Reveal>
            <FeatureList ai={aiAvailable()} />
          </Reveal>
        </section>

        <section className="pt-28 pb-24 text-center sm:pt-36 sm:pb-32">
          <Reveal>
            <div aria-hidden className="flex justify-center">
              <span className="thread h-24 sm:h-36" />
            </div>
            <h2 className={`${H2} mt-10 text-muted`}>
              <Words text="Ready when you are." />
            </h2>
            <Link href="/admin" className="font-display sweep sweep-lg mt-3 inline-block text-[clamp(2.4rem,7vw,5.5rem)] leading-[1.02] tracking-[-0.045em] text-ink">
              <Words text="Create a presentation" start={4} />
            </Link>
            <p className="mt-6 text-ink-soft">Free. Start as a guest: no sign-up, no email.</p>
            {/* a pulse line with a heartbeat running along it */}
            <svg aria-hidden viewBox="0 0 160 32" className="mx-auto mt-14 h-8 w-40 overflow-visible" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path pathLength={1} className="pulse-base" d={PULSE} stroke="var(--color-line-strong)" />
              <path pathLength={1} className="heartbeat" d={PULSE} stroke="var(--color-primary)" strokeWidth="2" />
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
              <Link href="/admin" className="sweep hover:text-ink">
                Create a presentation
              </Link>
            </li>
            <li>
              <Link href="/admin" className="sweep hover:text-ink">
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
