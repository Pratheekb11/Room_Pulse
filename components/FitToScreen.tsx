"use client";

import { useLayoutEffect, useRef } from "react";
import { fitScale } from "@/lib/fit";

/**
 * With `on`, shrinks its children so all of them show between this box's top and the bottom of the
 * window (lib/fit.ts): the page is laid out wider and scaled down with a transform, so nothing is
 * cut off and the presenter doesn't scroll. Measured again when the window, the box or the results change.
 */
export function FitToScreen({ on, children }: { on: boolean; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = outer.current;
    const page = inner.current;
    if (!box || !page) return;
    const clear = () => {
      box.style.height = "";
      box.style.overflow = "";
      page.style.width = "";
      page.style.transform = "";
      page.style.transformOrigin = "";
      delete box.dataset.fit;
    };
    if (!on) return clear();

    let frame = 0;
    const measure = () => {
      frame = 0;
      const availWidth = box.clientWidth;
      // from the box's top (wherever the page is scrolled to) down to the window's bottom edge, less the page's own padding
      const top = box.getBoundingClientRect().top + window.scrollY;
      const availHeight = window.innerHeight - top - Math.max(12, window.innerHeight * 0.02);
      const fit = fitScale(availWidth, availHeight, (width) => {
        page.style.width = `${width}px`;
        return page.offsetHeight;
      });
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
    <div ref={outer}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
