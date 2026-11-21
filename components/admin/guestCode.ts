"use client";

// The guest code is shown once by the server. Keep it for this browser session only
// (sessionStorage: survives refresh, gone when the browser closes) so the banner can remind the guest.
const KEY = "liverate:guest-code";

export function rememberGuestCode(code: string | null): void {
  try {
    if (code) window.sessionStorage.setItem(KEY, code);
    else window.sessionStorage.removeItem(KEY);
    window.sessionStorage.removeItem("liverate:guest-pin"); // from the older PIN sign-in
  } catch {
    /* storage unavailable */
  }
}

export function readGuestCode(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** "k7qm3xpa" → "K7QM-3XPA" (for display while typing, too). */
export function formatGuestCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return s.length > 4 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

// A new guest sees their code after their first presentation is saved, once per browser session.
const SEEN = "liverate:guest-code-seen";
export function codeSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN) === "1";
  } catch {
    return false;
  }
}
export function markCodeSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN, "1");
  } catch {
    /* storage unavailable */
  }
}
