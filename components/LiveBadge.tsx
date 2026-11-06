"use client";

import { useEffect, useState } from "react";

export function LiveBadge({ lastOkAt }: { lastOkAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const live = lastOkAt !== null && now - lastOkAt < 5000;

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border border-line-strong px-3.5 py-1 text-lg font-bold ${
        live ? "bg-white" : "bg-sun"
      }`}
    >
      <span
        aria-hidden
        className={`h-3 w-3 rounded-full ${live ? "animate-live bg-mint" : "bg-[#b26a00]"}`}
      />
      {live ? "Live" : "Reconnecting…"}
    </span>
  );
}
