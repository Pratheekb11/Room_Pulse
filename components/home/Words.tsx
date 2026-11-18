import { Fragment } from "react";

// A line of the headline that rises in word by word: each word slides up from behind its own mask.
// The spaces sit between the masks (inside an inline-block a trailing space is swallowed).
// Plain spans and CSS only, so the home page stays static; without animation the words simply show.
export function Words({ text, start = 0, step = 70, base = 120 }: { text: string; start?: number; step?: number; base?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          {i > 0 ? " " : null}
          <span className="word-mask">
            <span className="word-rise" style={{ animationDelay: `${base + (start + i) * step}ms` }}>
              {w}
            </span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
