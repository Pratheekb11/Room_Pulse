import { TOPIC_COLORS } from "@/lib/colors";

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
          className="font-display animate-pop leading-none font-extrabold transition-[font-size] duration-500"
          style={{
            fontSize: `clamp(1rem, ${1.2 + w.weight * 4.3}vw, ${1.4 + w.weight * 5}rem)`,
            color: TOPIC_COLORS[w.i % TOPIC_COLORS.length] === "#FFB81F" ? "#c98a00" : TOPIC_COLORS[w.i % TOPIC_COLORS.length],
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
