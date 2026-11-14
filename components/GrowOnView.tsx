"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Holds back the "grow" animations inside it until it's scrolled onto the screen, then lets them play once
 * (the home page's tree: its leaves grow one after another when you get to it).
 * Until the browser has checked, nothing is hidden, so without JavaScript everything simply shows.
 */
export function GrowOnView({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setSeen(entry.isIntersecting);
        if (entry.isIntersecting) io.disconnect();
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-seen={seen === null ? undefined : seen} className={className}>
      {children}
    </div>
  );
}
