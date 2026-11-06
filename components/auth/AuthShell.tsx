import { Logo } from "../Logo";
import { Shapes } from "../Shapes";

/** Centered card layout shared by the account pages. */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-5 py-5">
      <Shapes variant="quiet" />
      <Logo />
      <div className="mx-auto my-auto w-full max-w-sm py-10">
        <h1 className="font-display text-center text-4xl font-extrabold leading-tight tracking-tight">{title}</h1>
        <div className="slab mt-6 rounded-[24px] bg-white p-6">{children}</div>
      </div>
    </main>
  );
}

export const inputClass = "mt-1 w-full rounded-xl border-2 border-ink px-3 py-2.5 text-lg";
export const primaryButton = "key font-display mt-5 w-full rounded-xl bg-violet py-3 text-xl font-bold text-white";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold text-[#a3122f]">
      {children}
    </p>
  );
}
