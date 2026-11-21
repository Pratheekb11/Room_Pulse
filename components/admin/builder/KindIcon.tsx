import type { QuestionKind } from "@/lib/types";

/** Line icons for each kind of question (and the Yes / No shortcut), drawn in the text colour. */
const PATHS: Record<QuestionKind | "yes-no", React.ReactNode> = {
  rating: (
    <>
      <path d="M4 18h3v-5H4zM10.5 18h3V8h-3zM17 18h3V4h-3z" />
    </>
  ),
  poll: (
    <>
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="6" cy="17" r="2.2" />
      <circle cx="6" cy="7" r="0.6" fill="currentColor" />
      <path d="M11 7h9M11 17h9" />
    </>
  ),
  multi: (
    <>
      <rect x="3.8" y="4.8" width="4.4" height="4.4" rx="1" />
      <rect x="3.8" y="14.8" width="4.4" height="4.4" rx="1" />
      <path d="M4.8 7l1.2 1.2 2.4-2.6M4.8 17l1.2 1.2 2.4-2.6M11 7h9M11 17h9" />
    </>
  ),
  rank: (
    <>
      <path d="M4 6h1.5v4M4 10h3M4 14.5c.4-.8 2.8-.9 2.8.6 0 1.2-2.8 2-2.8 3.4h3M11 8h9M11 16h9" />
    </>
  ),
  number: (
    <>
      <path d="M9 4L7 20M17 4l-2 16M4.5 9h15M3.5 15h15" />
    </>
  ),
  text: (
    <>
      <path d="M4 5h16v11H9l-4 3.5V16H4z" />
      <path d="M8 9h8M8 12.5h5" />
    </>
  ),
  quiz: (
    <>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 13V9.5M10 3h4M12 3v3" />
    </>
  ),
  qa: (
    <>
      <path d="M12 4l5 6h-3v9h-4v-9H7z" />
    </>
  ),
  words: (
    <>
      <path d="M3 9h7M13 9h8M5 14h4M12 14h6M7 19h10" />
    </>
  ),
  "yes-no": (
    <>
      <path d="M4 12.5l3 3 6-7" />
      <path d="M15 9l5 5M20 9l-5 5" />
    </>
  ),
};

export function KindIcon({ kind, className = "h-6 w-6" }: { kind: QuestionKind | "yes-no"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[kind]}
    </svg>
  );
}
