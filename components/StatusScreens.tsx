import Link from "next/link";
import { Logo } from "./Logo";
import { Shapes } from "./Shapes";

export function CenteredMessage({ title, body, link = true }: { title: string; body: string; link?: boolean }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-5 py-5">
      <Shapes variant="quiet" />
      <Logo />
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{body}</p>
        {link && (
          <Link href="/" className="key font-display mt-8 rounded-2xl bg-violet px-6 py-3 text-lg font-bold text-white">
            Enter another code
          </Link>
        )}
      </div>
    </main>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <div className="flex items-end gap-1.5" role="status" aria-label={label}>
        {["bg-coral", "bg-violet", "bg-sun"].map((c, i) => (
          <span
            key={c}
            className={`${c} block w-3 animate-bounce rounded-sm`}
            style={{ height: 18 + i * 8, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </main>
  );
}
