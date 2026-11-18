import Link from "next/link";
import type { ReactNode } from "react";

/** A link set on a hairline, its words on the left and a thin arrow on the right that steps up on hover. */
export function LinkRow({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`link-row flex items-center justify-between gap-4 border-t border-line py-4 text-ink transition-colors hover:border-ink-soft ${className}`}>
      <span>{children}</span>
      <svg aria-hidden viewBox="0 0 16 16" className="link-arrow h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M4 12 12 4M5.5 4H12v6.5" />
      </svg>
    </Link>
  );
}
