"use client";

import { useSyncExternalStore } from "react";

/** Whether a media query matches, kept up to date as the window changes (false on the server). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (change) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", change);
      return () => mq.removeEventListener("change", change);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
