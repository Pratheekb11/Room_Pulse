"use client";

import { useEffect, useState } from "react";

/** After a moment of waiting, say why, so a slow first load doesn't look like a broken site. */
export function SlowHint({ afterMs = 1500 }: { afterMs?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), afterMs);
    return () => clearTimeout(t);
  }, [afterMs]);
  return (
    <p aria-live="polite" className={`mt-6 max-w-xs text-center text-sm text-ink-soft transition-opacity duration-500 ${show ? "opacity-100" : "opacity-0"}`}>
      {show ? "Starting up… the first load after a quiet spell takes a few seconds." : ""}
    </p>
  );
}
