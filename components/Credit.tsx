/**
 * Who built LiveRate. On the home page, and one quiet line (`subtle`) at the bottom of the thank-you screen.
 * Not on any other screen: test/credit.test.ts.
 */
export function Credit({ subtle = false }: { subtle?: boolean }) {
  return (
    <p className={subtle ? "animate-fade px-5 pb-4 text-center text-xs text-muted [animation-delay:900ms]" : "px-5 pb-6 text-center text-[13.5px] text-ink-soft"}>
      Built and maintained by{" "}
      <a
        href="https://github.com/Pratheekb11"
        className={subtle ? "underline-offset-4 hover:underline" : "font-semibold text-ink underline-offset-4 hover:underline"}
        rel="noopener noreferrer"
        target="_blank"
      >
        Pratheek B
      </a>
    </p>
  );
}
