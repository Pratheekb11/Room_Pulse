import { Logo } from "../Logo";
import { Words } from "@/components/home/Words";

/** Centered card layout shared by the account pages. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8">
      <Logo />
      <div className="mx-auto my-auto w-full max-w-sm py-10">
        <h1 className="font-display text-center text-4xl font-semibold leading-tight tracking-tight">
          <Words text={title} />
        </h1>
        <div className="slab enter mt-6 rounded-xl bg-white p-6" style={{ "--i": 3 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </main>
  );
}

export const inputClass = "mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 text-lg";
export const primaryButton = "key font-display mt-5 w-full rounded-lg bg-primary py-3 text-xl font-bold text-white";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-sm font-semibold text-error">
      {children}
    </p>
  );
}
