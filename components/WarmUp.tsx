"use client";

import { useEffect } from "react";

const KEY = "liverate:warm";
/** The server and database fall asleep after a few idle minutes; don't wake them more often than this. */
const EVERY_MS = 4 * 60_000;

/**
 * Wakes the server function and database in the background while a visitor reads the page,
 * so their first real action (sign in, create, join) doesn't wait for a cold start.
 */
export function WarmUp() {
  useEffect(() => {
    try {
      const last = Number(window.sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last < EVERY_MS) return;
      window.sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* storage unavailable: wake anyway */
    }
    void fetch("/api/warm", { cache: "no-store", keepalive: true }).catch(() => {});
  }, []);
  return null;
}
