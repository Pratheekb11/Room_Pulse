"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lifts its contents in when they're scrolled onto the screen (the home page's sections).
 * Hidden only once the browser has checked it's off screen, so without JavaScript everything simply shows.
 */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<boolean | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setShown(entry.isIntersecting);
        if (entry.isIntersecting) io.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-shown={shown === null ? undefined : shown} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
