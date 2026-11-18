"use client";

import { useRef, type ReactNode } from "react";

/**
 * A soft glow that follows the pointer across a panel (the home page's cobalt hero).
 * Sets --spot-x / --spot-y on the panel; the glow itself is CSS (.spotlight). Touch and reduced motion
 * leave it where it starts.
 */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function move(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - box.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - box.top}px`);
  }
  return (
    <div ref={ref} onPointerMove={move} className={`spotlight ${className}`}>
      {children}
    </div>
  );
}
