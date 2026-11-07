import { readableOn } from "@/lib/colors";
import type { SaveStatus } from "@/lib/vote-queue";

/** Coloured header with a short "how to answer" line and the question, then the card body. */
export function CardShell({
  id,
  color,
  how,
  question,
  children,
}: {
  id: string;
  color: string;
  how: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <section className="slab overflow-hidden rounded-xl bg-white" aria-labelledby={id}>
      <header className="px-5 py-4" style={{ backgroundColor: color, color: readableOn(color) }}>
        <p className="text-sm font-semibold opacity-80">{how}</p>
        <h2 id={id} className="font-display text-2xl font-semibold leading-tight break-words">
          {question}
        </h2>
      </header>
      {children}
    </section>
  );
}

const SAVE_TEXT: Partial<Record<SaveStatus, string>> = {
  saving: "Saving…",
  saved: "Saved ✓",
  retrying: "Retrying…",
  error: "Not saved. Try again.",
  closed: "Not saved: voting is closed",
};

export function saveText(status: SaveStatus | undefined): string {
  return status ? (SAVE_TEXT[status] ?? "") : "";
}
