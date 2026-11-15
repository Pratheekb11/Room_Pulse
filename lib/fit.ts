// Fit to screen: how much to shrink a results page so all of it shows at once.

/** Below this the text is too small to read from the back of a room. */
export const FIT_MIN_SCALE = 0.4;

export interface Fit {
  /** 1 = full size. */
  scale: number;
  /** Width to lay the page out at; scaled, it fills the available width. */
  width: number;
  /** The page's height at that width, before scaling. */
  height: number;
  /** False when even the smallest size is taller than the screen (the page scrolls). */
  fits: boolean;
}

/**
 * The largest scale (never above 1) at which the page fits the available box.
 * A page shrunk to `s` is laid out `1 / s` times wider, so the screen's full width is used and
 * lists reflow into more columns; `measure(width)` gives the page's height at a layout width.
 */
export function fitScale(availWidth: number, availHeight: number, measure: (width: number) => number, steps = 7): Fit {
  const at = (scale: number): Fit => {
    const width = availWidth / scale;
    const height = measure(width);
    return { scale, width, height, fits: height * scale <= availHeight + 0.5 };
  };
  if (!(availWidth > 0) || !(availHeight > 0)) return { scale: 1, width: Math.max(0, availWidth), height: measure(Math.max(0, availWidth)), fits: true };
  const full = at(1);
  if (full.fits) return full;
  const smallest = at(FIT_MIN_SCALE);
  if (!smallest.fits) return smallest;
  let best = smallest;
  let lo = FIT_MIN_SCALE;
  let hi = 1;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    const fit = at(mid);
    if (fit.fits) {
      best = fit;
      lo = mid;
    } else hi = mid;
  }
  return best;
}

export interface FlexFit extends Fit {
  /** The height the flexible piece gets, at the layout width. */
  flex: number;
}

/**
 * Like `fitScale`, for a page with one piece that can be any height (a board: the tree, the night sky).
 * The piece takes the room that's left: the page stays at full size as long as the piece can be at
 * least `min` tall, and only shrinks when it can't. `measure(width)` gives the height of everything
 * else (`rest`) and the tallest the piece may be (`cap`) at a layout width.
 *
 * The piece's own height is never read back, so the answer doesn't depend on what was drawn before.
 * (When the piece sized itself from the screen and the page was then fitted around it, each changed
 * the other's answer and the picture flickered between two sizes.)
 */
export function fitWithFlex(
  availWidth: number,
  availHeight: number,
  measure: (width: number) => { rest: number; cap: number },
  min: number,
  steps = 7,
): FlexFit {
  const smallest = (m: { cap: number }) => Math.max(0, Math.min(min, m.cap));
  const fit = fitScale(
    availWidth,
    availHeight,
    (width) => {
      const m = measure(width);
      return m.rest + smallest(m);
    },
    steps,
  );
  const m = measure(fit.width);
  const room = availHeight > 0 ? Math.floor(availHeight / fit.scale - m.rest) : 0;
  const flex = Math.max(smallest(m), Math.min(m.cap, room));
  const height = m.rest + flex;
  return { ...fit, height, flex, fits: !(availHeight > 0) || height * fit.scale <= availHeight + 0.5 };
}
