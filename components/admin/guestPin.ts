"use client";

// The guest PIN is shown once by the server. Keep it for this browser session only
// (sessionStorage: survives refresh, gone when the browser closes) so the banner can remind the guest.
const KEY = "liverate:guest-pin";

export function rememberGuestPin(pin: string | null): void {
  try {
    if (pin) window.sessionStorage.setItem(KEY, pin);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function readGuestPin(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const formatPin = (pin: string) => `${pin.slice(0, 3)} ${pin.slice(3)}`;
