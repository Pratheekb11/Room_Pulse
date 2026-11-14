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
