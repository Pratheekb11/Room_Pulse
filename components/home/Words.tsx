import { Fragment, type CSSProperties } from "react";

// Words that rise one after another from behind their own mask (the home page's headline and section titles).
// `--i` is each word's place, for the stagger; `start` carries the count on across lines. The spaces sit between
// the masks (inside an inline-block a trailing space is swallowed). Inside a Reveal they wait until scrolled to.
export function Words({ text, start = 0 }: { text: string; start?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          {i > 0 ? " " : null}
          <span className="w">
            <span style={{ "--i": start + i } as CSSProperties}>{w}</span>
          </span>
        </Fragment>
      ))}
    </>
  );
}
