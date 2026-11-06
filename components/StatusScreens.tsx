import Link from "next/link";
import { Logo } from "./Logo";

export function CenteredMessage({ title, body, link = true }: { title: string; body: string; link?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8">
      <Logo />
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-lg text-ink-soft">{body}</p>
        {link && (
          <Link href="/" className="key font-display mt-8 rounded-xl bg-primary px-6 py-3 text-lg font-bold text-white">
            Go to the home page
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
        {["bg-line-strong", "bg-primary", "bg-line-strong"].map((c, i) => (
          <span
            key={i}
            className={`${c} block w-3 animate-bounce rounded-sm`}
            style={{ height: 18 + i * 8, animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </main>
  );
}
