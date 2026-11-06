/** Decorative background shapes. Purely visual, hidden from assistive tech. */
export function Shapes({ variant = "hero" }: { variant?: "hero" | "quiet" }) {
  if (variant === "quiet") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sun/30" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-[38%_62%_55%_45%] bg-violet/15" />
      </div>
    );
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-16 top-24 h-56 w-56 rounded-full bg-coral" />
      <div className="absolute right-[8%] top-10 h-40 w-40 rotate-12 rounded-[28px] bg-sun" />
      <div className="absolute -right-20 bottom-16 h-72 w-72 rounded-[42%_58%_63%_37%] bg-violet" />
      <div className="absolute bottom-10 left-[12%] h-24 w-24 rotate-45 rounded-2xl bg-mint" />
      <svg className="absolute left-[40%] top-6 w-40 text-sky" viewBox="0 0 160 40" fill="none">
        <path d="M4 30c16-24 32-24 48 0s32 24 48 0 32-24 56 0" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      </svg>
    </div>
  );
}
