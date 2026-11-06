"use client";

import { useEffect, useState } from "react";
import type { ResultsPayload } from "@/lib/types";

const FAST_MS = 1500;
const SLOW_MS = 5000;

export interface PollState {
  data: ResultsPayload | null;
  lastOkAt: number | null;
  notFound: boolean;
  /** Per-cell counter, bumped whenever that cell's numbers change (drives the flash). */
  flash: Record<string, number>;
}

function diffCells(prev: ResultsPayload | null, next: ResultsPayload, flash: Record<string, number>) {
  if (!prev) return flash;
  const key = (c: { topicId: string; criterionId: string }) => `${c.topicId}:${c.criterionId}`;
  const before = new Map(prev.cells.map((c) => [key(c), `${c.n}:${c.sum}`]));
  const after = new Map(next.cells.map((c) => [key(c), `${c.n}:${c.sum}`]));
  let out: Record<string, number> | null = null;
  const bump = (k: string) => {
    out ??= { ...flash };
    out[k] = (out[k] ?? 0) + 1;
  };
  for (const [k, v] of after) if (before.get(k) !== v) bump(k);
  for (const k of before.keys()) if (!after.has(k)) bump(k);
  return out ?? flash;
}

/**
 * One polling loop: never overlaps requests, backs off to 5 s on errors,
 * pauses while the tab is hidden and resumes immediately when visible.
 * `dashboardKey` is the secret from the presenter link; without it only the signed-in owner gets results.
 */
export function useResultsPoll(code: string, dashboardKey: string | null, enabled = true): PollState {
  const [state, setState] = useState<PollState>({ data: null, lastOkAt: null, notFound: false, flash: {} });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let inFlight = false;
    let delay = FAST_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (!stopped && document.visibilityState === "visible") timer = setTimeout(tick, delay);
    };

    async function tick() {
      if (stopped || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      try {
        const res = await fetch(`/api/results/${encodeURIComponent(code)}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: dashboardKey ? { "x-dashboard-key": dashboardKey } : undefined,
        });
        if (res.status === 404) {
          if (!stopped) setState((s) => ({ ...s, notFound: true }));
          delay = SLOW_MS;
        } else if (!res.ok) {
          delay = SLOW_MS;
        } else {
          const data = (await res.json()) as ResultsPayload;
          if (!stopped)
            setState((s) => ({ data, lastOkAt: Date.now(), notFound: false, flash: diffCells(s.data, data, s.flash) }));
          delay = FAST_MS;
        }
      } catch {
        delay = SLOW_MS;
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        controller = null;
        schedule();
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!inFlight) {
          if (timer) clearTimeout(timer);
          timer = undefined;
          void tick();
        }
      } else if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code, dashboardKey, enabled]);

  return state;
}
