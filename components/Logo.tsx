import Link from "next/link";

/** Wordmark: a small orange pulse mark and the name in ink. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-[28px]" : "text-[21px] sm:text-[23px]";
  return (
    <Link href="/" className={`${text} inline-flex items-center gap-2 font-semibold tracking-[-0.025em] text-ink`}>
      <svg aria-hidden viewBox="0 0 20 20" className="h-[1.15em] w-[1.15em]">
        <rect width="20" height="20" rx="5" fill="var(--color-primary)" />
        <path d="M3.5 11h3l2-5 3 9 2-4h3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      LiveRate
    </Link>
  );
}
