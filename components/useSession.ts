"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionPayload } from "@/lib/types";

export type SessionState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error" }
  | { kind: "ready"; data: SessionPayload };

/**
 * Loads session info; keeps retrying (every 3 s) while the server is unreachable.
 * Loads again when `revision` changes (the presenter edited the questions), keeping the old data meanwhile.
 */
export function useSession(code: string, revision?: number, initial?: SessionPayload | null): SessionState {
  const [state, setState] = useState<SessionState>(initial ? { kind: "ready", data: initial } : { kind: "loading" });
  // Questions that came with the page don't need loading again until the presenter edits them.
  const skipFirst = useRef(Boolean(initial));
  const initialRevision = useRef(initial?.session.revision);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      if (revision === undefined || revision === initialRevision.current) return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        // A stuck request counts as no connection, so the retry below takes over instead of a frozen screen.
        const res = await fetch(`/api/session/${encodeURIComponent(code)}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (cancelled) return;
        if (res.status === 404) return setState({ kind: "not_found" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as SessionPayload;
        if (!cancelled) setState({ kind: "ready", data });
      } catch {
        if (cancelled) return;
        setState((s) => (s.kind === "ready" ? s : { kind: "error" }));
        timer = setTimeout(load, 3000);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [code, revision]);

  return state;
}
