"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Read a browser-only value (window.location, sessionStorage…) without a
 * hydration mismatch: `undefined` during SSR / hydration, the real value after.
 * The getter must return a primitive (or a stable reference).
 */
export function useClientValue<T>(getter: () => T): T | undefined {
  return useSyncExternalStore(noopSubscribe, getter, () => undefined);
}
