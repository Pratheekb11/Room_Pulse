"use client";

import { useClientValue } from "../useClientValue";

// Read once per page load, then removed from the address bar.
let captured: string | null | undefined;

function readOnce(): string | null {
  if (captured === undefined) {
    captured = new URLSearchParams(window.location.search).get("token");
    if (captured) window.history.replaceState(null, "", window.location.pathname);
  }
  return captured;
}

/**
 * The ?token= from an emailed link. `undefined` while rendering on the server,
 * then the token (or null). Removes it from the address bar so it doesn't linger
 * in history or get shared by accident.
 */
export function useLinkToken(): string | null | undefined {
  return useClientValue(readOnce);
}
