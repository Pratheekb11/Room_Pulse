import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";
import { LiveDemo } from "@/components/LiveDemo";
import { Logo } from "@/components/Logo";

const FEATURES = [
  {
    title: "Score a list of ideas",
    body: "People give each idea a score, like 1 to 5, on things such as impact and effort. You see which idea wins.",
    pill: "Score items",
    color: "bg-peach",
  },
  {
    title: "Run a quick poll",
    body: "People pick one option with a single tap. The bar or pie chart updates as the votes come in.",
    pill: "Poll",
    color: "bg-sky",
  },
  {
    title: "Collect words",
    body: "People type up to three words. The words used most show up biggest on your screen.",
    pill: "Word cloud",
    color: "bg-lavender",
  },
];

const STEPS = [
  { title: "Write your questions", body: "Make a presentation with up to 10 questions. It takes a couple of minutes." },
  { title: "Show the QR code", body: "People scan it with their phone camera, or type the short code. That's all they need." },
  { title: "Watch the answers", body: "Results appear on your screen as people answer. Show them to the room or keep them to yourself." },
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
              Ask your audience questions. They answer on their phones, and the results show up on your screen straight away. Nobody needs an app or an account to answer.
            </p>
            <JoinForm />
            <p className="mt-3 text-sm text-muted">Joining someone else&rsquo;s presentation? Type the code shown on their screen.</p>
          </div>
          <LiveDemo />
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

        <section className="border-t border-line py-20">
          <h2 className="font-display max-w-xl text-[clamp(1.75rem,3vw,2.25rem)] leading-tight text-ink">Three kinds of question</h2>
          <div className="stagger mt-10 grid gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-line bg-white p-6">
                <span className={`${f.color} rounded-full px-2.5 py-1 text-xs font-semibold text-ink`}>{f.pill}</span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-24 text-center">
          <h2 className="font-display text-[clamp(1.75rem,3.4vw,2.5rem)] leading-tight text-ink">Ready to try it?</h2>
          <Link href="/admin" className="key mt-8 inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white">
            Create a presentation
          </Link>
          <p className="mt-3 text-sm text-muted">Free. You can start as a guest without signing up.</p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft sm:px-8">
          <Logo />
          <p>Answers are anonymous. We don&rsquo;t store names or IP addresses.</p>
        </div>
      </footer>
    </div>
  );
}
