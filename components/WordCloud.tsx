import { TOPIC_COLORS, TOPIC_INKS } from "@/lib/colors";

/** Biggest words in the middle: alternate placing words to the left and right of the centre. */
function centreOut<T>(items: T[]): T[] {
  const left: T[] = [];
  const right: T[] = [];
  items.forEach((x, i) => (i % 2 === 0 ? right : left).push(x));
  return [...left.reverse(), ...right];
}

export function WordCloud({ words }: { words: { word: string; n: number; weight: number }[] }) {
  if (words.length === 0) {
    return <p className="py-16 text-center text-[clamp(1.2rem,1.8vw,2rem)] font-semibold text-ink-soft">Answers will float in here.</p>;
  }
  return (
    <ul
      className="flex min-h-[50vh] flex-wrap content-center items-center justify-center gap-x-[clamp(0.8rem,1.6vw,2rem)] gap-y-2 px-4"
      aria-label={`Word cloud: ${words.map((w) => `${w.word} (${w.n})`).join(", ")}`}
    >
      {centreOut(words.map((w, i) => ({ ...w, i }))).map((w) => (
        <li
          key={w.word}
          className="font-display animate-pop leading-none font-semibold transition-[font-size] duration-500"
          style={{
            fontSize: `clamp(1rem, ${1.2 + w.weight * 4.3}vw, ${1.4 + w.weight * 5}rem)`,
            color: TOPIC_INKS[w.i % TOPIC_INKS.length],
            opacity: 0.8 + w.weight * 0.2,
          }}
          title={`${w.n} ${w.n === 1 ? "person" : "people"}`}
        >
          {w.word}
        </li>
      ))}
    </ul>
  );
}

/** Ranked list: every answer with how many people gave it. */
export function WordList({ words }: { words: { word: string; n: number; weight: number }[] }) {
  if (words.length === 0) {
    return <p className="py-16 text-center text-[clamp(1.2rem,1.8vw,2rem)] font-semibold text-ink-soft">Answers will appear here.</p>;
  }
  const max = words[0].n;
  const shown = words.slice(0, 12);
  return (
    <ol className="mt-4 flex flex-col gap-[clamp(0.4rem,1vh,0.8rem)]" aria-label="Answers, most common first">
      {shown.map((w, i) => (
        <li key={w.word} className="flex items-center gap-3">
          <span className="font-display w-[2.5ch] text-right text-[clamp(1rem,1.3vw,1.5rem)] font-semibold text-ink-soft">{i + 1}</span>
          <span className="w-[28%] truncate text-[clamp(1.05rem,1.5vw,1.8rem)] font-bold" title={w.word}>
            {w.word}
          </span>
          <span className="relative h-[clamp(1.6rem,3.4vh,2.6rem)] flex-1 overflow-hidden rounded-full border border-line-strong bg-white">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
              style={{ width: `${(w.n / max) * 100}%`, backgroundColor: TOPIC_COLORS[i % TOPIC_COLORS.length] }}
            />
          </span>
          <span className="font-display w-[4ch] text-right text-[clamp(1.1rem,1.6vw,1.9rem)] font-semibold tabular-nums">{w.n}</span>
        </li>
      ))}
      {words.length > shown.length && (
        <li className="text-center text-sm font-semibold text-ink-soft">+ {words.length - shown.length} more answers</li>
      )}
    </ol>
  );
}
