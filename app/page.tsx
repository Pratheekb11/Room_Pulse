import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Shapes } from "@/components/Shapes";
import { JoinForm } from "@/components/JoinForm";

export default function Home() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <Shapes />
      <header className="px-5 pt-5 sm:px-8">
        <Logo />
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-12">
        <div className="slab rounded-[28px] bg-white px-6 py-8 sm:px-10 sm:py-10">
          <h1 className="font-display text-[clamp(2.4rem,9vw,3.6rem)] font-extrabold leading-[0.95] tracking-tight">
            Got a code?
            <br />
            Jump in.
          </h1>
          <p className="mt-4 max-w-sm text-lg text-ink-soft">
            Type the code on the presenter&rsquo;s screen. No sign-up, no names.
          </p>
          <JoinForm />
        </div>

        <p className="mt-8 text-center text-ink-soft">
          Running the room?{" "}
          <Link href="/admin" className="font-semibold text-ink underline decoration-violet decoration-2 underline-offset-4">
            Create a session
          </Link>
        </p>
      </section>
    </main>
  );
}
