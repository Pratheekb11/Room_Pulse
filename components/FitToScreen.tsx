"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import { fitScale, fitWithFlex } from "@/lib/fit";

const FitContext = createContext<{ on: boolean; refit: () => void }>({ on: false, refit: () => {} });

/**
 * Is Fit to screen on around this component? A piece that can be any height (a board) then marks its
 * box with `data-fit-flex="<width ÷ height>"` and `data-fit-min="<px>"`, draws inside the height that
 * box is given, and calls `refit()` if its shape changes. It must not size itself from the screen.
 */
export function useFit() {
  return useContext(FitContext);
}

/**
 * With `on`, shrinks its children so all of them show between this box's top and the bottom of the
 * window (lib/fit.ts): the page is laid out wider and scaled down with a transform, so nothing is
 * cut off and the presenter doesn't scroll. Measured again when the window, the box or the results change.
 * A `[data-fit-flex]` piece inside gets the room that's left, so the page shrinks only if it must.
 */
export function FitToScreen({ on, children }: { on: boolean; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const refit = useRef<() => void>(() => {});
  const context = useMemo(() => ({ on, refit: () => refit.current() }), [on]);

  useLayoutEffect(() => {
    const box = outer.current;
    const page = inner.current;
    if (!box || !page) return;
    let flexed: HTMLElement | null = null;
    const clear = () => {
      box.style.height = "";
      box.style.overflow = "";
      page.style.width = "";
      page.style.transform = "";
      page.style.transformOrigin = "";
      if (flexed) flexed.style.height = "";
      flexed = null;
      delete box.dataset.fit;
      refit.current = () => {};
    };
    if (!on) return clear();

    let frame = 0;
    const measure = () => {
      frame = 0;
      const availWidth = box.clientWidth;
      // from the box's top (wherever the page is scrolled to) down to the window's bottom edge, less the page's own padding
      const top = box.getBoundingClientRect().top + window.scrollY;
      const availHeight = window.innerHeight - top - Math.max(12, window.innerHeight * 0.02);
      const flex = page.querySelector<HTMLElement>("[data-fit-flex]");
      if (flexed && flexed !== flex) flexed.style.height = "";
      flexed = flex;
      let fit;
      if (flex) {
        // a board: its height is set here and nowhere else, from the height of everything around it
        const ratio = Number(flex.dataset.fitFlex) || 1.6;
        const min = Number(flex.dataset.fitMin) || 160;
        const flexFit = fitWithFlex(
          availWidth,
          availHeight,
          (width) => {
            page.style.width = `${width}px`;
            flex.style.height = "0px";
            return { rest: page.offsetHeight, cap: flex.clientWidth / ratio };
          },
          min,
        );
        flex.style.height = `${flexFit.flex}px`;
        fit = flexFit;
      } else {
        fit = fitScale(availWidth, availHeight, (width) => {
          page.style.width = `${width}px`;
          return page.offsetHeight;
        });
      }
      page.style.width = `${fit.width}px`;
      page.style.transformOrigin = "top left";
      page.style.transform = fit.scale === 1 ? "" : `scale(${fit.scale})`;
      // the box takes the scaled size, so what follows (and the page's height) lines up with what shows
      box.style.height = `${Math.ceil(page.offsetHeight * fit.scale)}px`;
      box.style.overflow = "hidden";
      box.dataset.fit = fit.scale.toFixed(3);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    refit.current = schedule;
    measure();
    const watch = new ResizeObserver(schedule);
    watch.observe(box);
    for (const child of Array.from(page.children)) watch.observe(child);
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      watch.disconnect();
      window.removeEventListener("resize", schedule);
      clear();
    };
  }, [on, children]);

  return (
    <FitContext value={context}>
      <div ref={outer}>
        <div ref={inner}>{children}</div>
      </div>
    </FitContext>
  );
}
