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

const TYPE_COLORS = ["bg-peach", "bg-sky", "bg-mint", "bg-lavender"];

const GUEST_POINTS = ["No sign-up or email", "Free", "Your audience needs no app"];

const STEPS = [
  { title: "Write your questions", body: "Make a presentation with up to 10 questions. It takes a couple of minutes." },
  { title: "Show the QR code", body: "People scan it with their phone camera, or type the short code. That's all they need." },
  { title: "Watch the answers", body: "Results appear on your screen as people answer. Show them to the room or keep them to yourself." },
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
        <section className="stagger grid gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2.5rem,5.6vw,4rem)] leading-[1.04] text-ink">
              <span className="block">Know what the room thinks.</span>
              <span className="block text-ink-soft">Right now.</span>
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
              Ask your audience questions. They answer on their phones, and the results show up on your screen straight away.
            </p>

            <div className="mt-8 max-w-md rounded-xl border border-line-strong bg-white p-4 sm:p-5">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-xs font-bold text-ink">
                <span aria-hidden>✓</span> Guest mode: no sign-up needed
              </p>
              <Link href="/admin" className="key mt-3 flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-base font-bold text-white">
                Create a presentation
              </Link>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                {GUEST_POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span aria-hidden className="text-success">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Start as a guest in one tap. Save an account later if you want to keep your presentations.</p>
              <p className="mt-3 text-sm">
                <HowToButton label="▶ See how it works" />
              </p>
            </div>

            <div className="mt-8 max-w-md">
              <p className="text-sm font-semibold text-ink">Joining someone else&rsquo;s presentation?</p>
              <p className="text-sm text-muted">Type the code shown on their screen.</p>
              <JoinForm />
            </div>
          </div>
          <div className="min-w-0">
            <LiveDemo />
          </div>
        </section>

        <section className="border-t border-line py-20" aria-labelledby="how-h">
          <h2 id="how-h" className="font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="font-display grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-strong text-ink">{i + 1}</span>
                <div>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-line py-20" aria-labelledby="features-h">
          <h2 id="features-h" className="font-display max-w-xl text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">
            What you can do
          </h2>
          <FeatureList ai={aiAvailable()} />
        </section>

        <section className="border-t border-line py-20" aria-labelledby="types-h">
          <h2 id="types-h" className="font-display max-w-xl text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">
            {KIND_INFO.length} kinds of question
          </h2>
          <ul className="stagger mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {KIND_INFO.map((k, i) => (
              <li key={k.id} className="rounded-xl border border-line bg-white p-5">
                <span className={`${TYPE_COLORS[i % TYPE_COLORS.length]} rounded-full px-2.5 py-1 text-xs font-semibold text-ink`}>{k.label}</span>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{k.hint}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line py-24 text-center">
          <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-tight text-ink">Ready to try it?</h2>
          <Link href="/admin" className="key mt-8 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white">
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
