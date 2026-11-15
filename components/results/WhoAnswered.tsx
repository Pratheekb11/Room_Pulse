// Names on (team activities): under a Pick one, Pick several, Put in order or Word cloud result,
// who picked each option (first place for Put in order) or said each word, in the order they answered.

export interface WhoLine {
  key: string;
  label: string;
  names: string[];
}

export function WhoAnswered({ rows, heading = "Who picked what" }: { rows: WhoLine[]; heading?: string }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={heading} className="@container mt-5">
      <h3 className="font-display text-lg font-semibold">{heading}</h3>
      <ul className="mt-2 grid grid-cols-1 gap-2 @[42rem]:grid-cols-2">
        {rows.map((r) => (
          <li key={r.key} className="min-w-0 rounded-xl border border-line bg-white px-4 py-3">
            <p className="flex items-baseline justify-between gap-3 font-bold">
              <span className="min-w-0">{r.label}</span>
              <span className="shrink-0 text-sm text-ink-soft tabular-nums">{r.names.length}</span>
            </p>
            {r.names.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {r.names.map((n, i) => (
                  <li key={`${n}-${i}`} className="rounded-full bg-canvas px-2.5 py-0.5 text-sm font-semibold">
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-soft">Nobody yet</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
