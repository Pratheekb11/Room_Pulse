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
import { Sticker, type StickerName } from "@/components/Sticker";
import { Marquee } from "@/components/home/Marquee";
import { Reveal } from "@/components/home/Reveal";
import { SpinBadge } from "@/components/home/SpinBadge";
import { Spotlight } from "@/components/home/Spotlight";
import { Tilt } from "@/components/home/Tilt";
import { Words } from "@/components/home/Words";

const STEPS: { title: string; body: string; icon: StickerName }[] = [
  { title: "Write your questions", body: "Up to 10. It takes a couple of minutes.", icon: "clipboard" },
  { title: "Show the QR code", body: "People scan it with their phone. No app.", icon: "phone" },
  { title: "Watch the answers", body: "Results appear on your screen as people tap.", icon: "bars" },
];

// Duotone: cobalt panels with volt accents, ink outlines and hard shadows; giant type that rises in.
export default function Home() {
  return (
    <div className="min-h-dvh">
      <WarmUp />
      <Spotlight className="relative isolate overflow-hidden bg-primary text-white">
        <div aria-hidden className="halftone pointer-events-none absolute inset-0 -z-10" />
        <header className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-8">
          <Logo tone="light" />
          <nav className="flex items-center gap-2 text-[15px] font-semibold whitespace-nowrap">
            <Link href="/admin" className="flex h-10 items-center rounded-full border-2 border-white/40 px-4 text-white transition-colors hover:border-white hover:bg-white/10">
              Log in
            </Link>
            <Link href="/admin" className="pop-btn flex h-10 items-center rounded-full bg-volt px-4 text-ink">
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Create a presentation</span>
            </Link>
          </nav>
        </header>

        <section className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-5 pt-10 pb-16 sm:px-8 sm:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-24">
          <div className="min-w-0">
            <p className="animate-rise inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
              <span className="animate-live h-2 w-2 rounded-full bg-volt" />
              Live answers from every phone in the room
            </p>
            <h1 className="font-display mt-6 text-[clamp(2.9rem,7.6vw,5.75rem)] leading-[0.95] tracking-[-0.045em] text-white">
              <span className="block">
                <Words text="Know what the room" />{" "}
                <span className="marker">
                  <Words text="thinks." start={4} />
                </span>
              </span>
              <span className="block text-volt">
                <Words text="Right now." start={5} />
              </span>
            </h1>
            <p className="animate-rise mt-6 max-w-md text-[17px] leading-relaxed text-white/85 [animation-delay:500ms]">
              Ask your audience questions. They answer on their phones, and the results show up on your screen straight away.
            </p>

            <div className="animate-rise mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 [animation-delay:620ms]">
              <Link href="/admin" className="pop-btn flex h-14 items-center justify-center rounded-full bg-volt px-7 text-[17px] font-bold text-ink">
                Create a presentation
                <span aria-hidden className="ml-2 text-xl leading-none">→</span>
              </Link>
              <HowToButton label="▶ See how it works" className="font-semibold text-white underline decoration-volt decoration-2 underline-offset-[6px] hover:decoration-white" />
            </div>
            <p className="animate-rise mt-4 text-sm text-white/75 [animation-delay:700ms]">Free. Start as a guest: no sign-up, nothing to install.</p>

            <div className="animate-rise mt-9 max-w-md rounded-2xl border-2 border-ink bg-white p-4 text-ink shadow-[6px_6px_0_var(--color-ink)] [animation-delay:800ms]">
              <p className="text-sm font-semibold text-ink">Have a code? Join a presentation.</p>
              <JoinForm />
            </div>
          </div>

          <div className="animate-rise relative min-w-0 [animation-delay:350ms] lg:pl-4">
            <SpinBadge text="FREE · NO SIGN-UP · LIVE · " className="absolute -top-12 -right-2 z-10 h-24 w-24 sm:-top-14 sm:h-28 sm:w-28 lg:-right-6" />
            <span aria-hidden className="float absolute -bottom-7 -left-3 z-10 [--r:-12deg]">
              <Sticker name="star" size={52} />
            </span>
            <span aria-hidden className="float-late absolute top-1/3 -left-8 z-10 hidden [--r:10deg] lg:block">
              <Sticker name="bubble" size={46} />
            </span>
            <Tilt>
              <LiveDemo />
            </Tilt>
          </div>
        </section>

        <Marquee
          items={KIND_INFO.map((k) => k.label)}
          className="font-display -mx-4 -mb-2 -rotate-[1.5deg] border-y-2 border-ink bg-volt py-3 text-[clamp(1.4rem,3.4vw,2.4rem)] tracking-[-0.03em] text-ink sm:py-4"
        />
        <div className="h-10 sm:h-14" />
      </Spotlight>

      <main className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <section className="py-20 sm:py-24" aria-labelledby="how-h">
          <Reveal>
            <h2 id="how-h" className="font-display text-[clamp(2.25rem,5.5vw,4rem)] leading-[0.95] tracking-[-0.04em] text-ink">
              How it <span className="text-primary">works</span>
            </h2>
          </Reveal>
          <ol className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="min-w-0">
                <Reveal delay={i * 120} className="h-full">
                  <div className="lift wiggle-on-hover group relative h-full overflow-hidden rounded-3xl border-2 border-ink bg-white p-6 hover:bg-primary">
                    <span aria-hidden className="font-display pointer-events-none absolute -top-6 -right-1 text-[8.5rem] leading-none text-primary/10 transition-colors group-hover:text-white/15">
                      {i + 1}
                    </span>
                    <span className="wiggle grid h-14 w-14 place-items-center rounded-2xl border-2 border-ink bg-volt">
                      <Sticker name={step.icon} size={32} />
                    </span>
                    <h3 className="font-display mt-5 text-2xl text-ink transition-colors group-hover:text-white">
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-[15px] leading-snug text-ink-soft transition-colors group-hover:text-white/85">{step.body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-20 sm:pb-24" aria-labelledby="activities-h">
          <Reveal>
            <div className="grid grid-cols-1 items-center gap-10 overflow-hidden rounded-[2rem] border-2 border-ink bg-volt p-6 shadow-[8px_8px_0_var(--color-ink)] sm:p-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <h2 id="activities-h" className="font-display max-w-xl text-[clamp(2.1rem,4.6vw,3.5rem)] leading-[0.98] tracking-[-0.04em] text-ink">
                  Team activities everyone can join
                </h2>
                <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink">
                  In the room or on a call, everyone writes from their phone and the picture fills up live.
                </p>
                <ul className="mt-6 flex max-w-xl flex-wrap gap-2" aria-label="Team activities">
                  {ACTIVITIES.map((a) => (
                    <li
                      key={a.id}
                      title={a.blurb}
                      className="wiggle-on-hover flex items-center gap-1.5 rounded-full border-2 border-ink bg-white py-1 pr-3.5 pl-2 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
                    >
                      <span className="wiggle inline-flex">
                        <Sticker name={a.icon} size={20} />
                      </span>
                      {a.label}
                    </li>
                  ))}
                </ul>
                <Link href="/admin" className="pop-btn mt-8 inline-flex h-12 items-center rounded-full bg-primary px-6 font-bold text-white">
                  Start an activity <span aria-hidden className="ml-2">→</span>
                </Link>
              </div>
              <div className="min-w-0 rotate-2 transition-transform duration-500 hover:rotate-0">
                <MiniTree />
              </div>
            </div>
          </Reveal>
        </section>

        <section className="pb-20 sm:pb-24" aria-labelledby="features-h">
          <Reveal>
            <h2 id="features-h" className="font-display max-w-2xl text-[clamp(2.25rem,5.5vw,4rem)] leading-[0.95] tracking-[-0.04em] text-ink">
              What you <span className="text-primary">can do</span>
            </h2>
          </Reveal>
          <FeatureList ai={aiAvailable()} />
        </section>

        <section className="pb-20 sm:pb-24">
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-[2.5rem] border-2 border-ink bg-primary px-6 py-16 text-center text-white shadow-[10px_10px_0_var(--color-ink)] sm:py-20">
              <div aria-hidden className="halftone pointer-events-none absolute inset-0 -z-10" />
              <span aria-hidden className="float absolute top-6 left-6 hidden [--r:-10deg] sm:block">
                <Sticker name="sparkle" size={48} />
              </span>
              <span aria-hidden className="float-late absolute right-8 bottom-8 hidden [--r:12deg] sm:block">
                <Sticker name="star" size={56} />
              </span>
              <h2 className="font-display text-[clamp(2.6rem,8vw,6rem)] leading-[0.92] tracking-[-0.045em]">
                Ready to <span className="text-volt">try it?</span>
              </h2>
              <Link href="/admin" className="pop-btn mt-9 inline-flex h-14 items-center rounded-full bg-volt px-8 text-[17px] font-bold text-ink">
                Create a presentation <span aria-hidden className="ml-2 text-xl leading-none">→</span>
              </Link>
              <p className="mt-4 text-sm text-white/80">Free. Start as a guest: no sign-up, no email.</p>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t-2 border-ink bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft sm:px-8">
          <Logo />
          <p>Answers are anonymous. We don&rsquo;t store names or IP addresses.</p>
        </div>
        <Credit />
      </footer>
    </div>
  );
}
