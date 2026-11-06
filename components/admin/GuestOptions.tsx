"use client";

import { useState } from "react";
import { apiFetch } from "./api";
import { formatPin, rememberGuestPin } from "./guestPin";

const field = "mt-1 w-full rounded-xl border-2 border-ink px-3 py-2.5 text-lg";

/** "Continue as guest" (shows the PIN once) and "Return as guest" (code + PIN). */
export function GuestOptions({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"idle" | "pin" | "return">("idle");
  const [pin, setPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(pin ?? "");
      setCopied(true);
    } catch {
      /* clipboard blocked: the PIN is on screen */
    }
  }
  const [code, setCode] = useState("");
  const [enteredPin, setEnteredPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/guest", { method: "POST" });
      const body = (await res.json()) as { pin: string };
      rememberGuestPin(body.pin);
      setPin(body.pin);
      setMode("pin");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function comeBack(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/guest-return", { method: "POST", body: JSON.stringify({ code, pin: enteredPin }) });
      rememberGuestPin(enteredPin);
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "pin" && pin) {
    return (
      // Full-page, so nothing else on the screen competes with the PIN.
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-canvas p-5">
      <div className="slab w-full max-w-sm rounded-[24px] bg-white p-6 text-center" role="dialog" aria-modal="true" aria-labelledby="pin-h">
        <h2 id="pin-h" className="font-display text-2xl font-extrabold">
          Save your guest PIN
        </h2>
        <p className="mt-1 text-sm text-ink-soft">You need it to get back in after closing the browser.</p>
        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-sun px-4 py-3">
          <span className="font-display text-[clamp(2rem,9vw,2.5rem)] font-extrabold tracking-[0.12em] whitespace-nowrap tabular-nums" aria-label={`PIN ${pin.split("").join(" ")}`}>
            {formatPin(pin)}
          </span>
          <button type="button" onClick={copyPin} className="rounded-lg border-2 border-ink bg-white px-2.5 py-1 text-sm font-bold">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button type="button" onClick={onSignedIn} className="key mt-5 w-full rounded-xl bg-violet py-3 text-lg font-bold text-white">
          I&rsquo;ve saved it
        </button>
      </div>
      </div>
    );
  }

  if (mode === "return") {
    return (
      <form onSubmit={comeBack} className="slab mt-6 rounded-[24px] bg-white p-6" noValidate>
        <h2 className="font-display text-2xl font-extrabold">Return as guest</h2>
        <p className="mt-1 text-sm text-ink-soft">Enter the code of any presentation you made, and your PIN.</p>
        <label className="mt-4 block font-semibold">
          Presentation code
          <input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoComplete="off" maxLength={12} className={`${field} tracking-[0.15em]`} />
        </label>
        <label className="mt-4 block font-semibold">
          Guest PIN
          <input
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${field} tracking-[0.3em]`}
          />
        </label>
        {error && <p role="alert" className="mt-3 rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold text-[#a3122f]">{error}</p>}
        <button type="submit" disabled={busy || code.trim().length < 4 || enteredPin.length !== 6} className="key mt-5 w-full rounded-xl bg-violet py-3 text-lg font-bold text-white">
          {busy ? "Checking…" : "Get back in"}
        </button>
        <button type="button" onClick={() => setMode("idle")} className="mt-3 w-full text-sm font-bold underline underline-offset-4">
          Back
        </button>
      </form>
    );
  }

  return (
    <div className="mt-5 text-center">
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={busy} onClick={start} className="rounded-full border-2 border-ink bg-white px-5 py-2 font-bold hover:bg-canvas">
          {busy ? "Starting…" : "Continue as guest"}
        </button>
        <button type="button" onClick={() => setMode("return")} className="rounded-full px-4 py-2 font-bold underline underline-offset-4">
          Return as guest
        </button>
      </div>
      <p className="mt-2 text-sm text-ink-soft">No sign-up. Results are kept for 3 days.</p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-[#a3122f]">{error}</p>}
    </div>
  );
}
