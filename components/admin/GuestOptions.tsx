"use client";

import { useState } from "react";
import { apiFetch } from "./api";
import { formatGuestCode, rememberGuestCode } from "./guestCode";

const field = "mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 text-lg";

/** "Start now" (shows the guest code once) and "Get back in" (type the guest code). */
export function GuestOptions({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"idle" | "code" | "return">("idle");
  const [guestCode, setGuestCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(guestCode ?? "");
      setCopied(true);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/guest", { method: "POST" });
      const body = (await res.json()) as { guestCode: string };
      rememberGuestCode(body.guestCode);
      setGuestCode(body.guestCode);
      setMode("code");
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
      await apiFetch("/api/auth/guest-return", { method: "POST", body: JSON.stringify({ guestCode: typed }) });
      rememberGuestCode(formatGuestCode(typed));
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "code" && guestCode) {
    return (
      // Full-page, so nothing else on the screen competes with the code.
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-canvas p-5">
        <div className="slab w-full max-w-sm rounded-xl bg-white p-6 text-center" role="dialog" aria-modal="true" aria-labelledby="code-h">
          <h2 id="code-h" className="font-display text-2xl">
            Your guest code
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Write it down. Type it on any phone or computer to get back to your presentations.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-sun px-4 py-3">
            <span className="font-mono text-[clamp(1.8rem,8vw,2.25rem)] tracking-[0.08em] whitespace-nowrap" aria-label={`Guest code ${guestCode.split("").join(" ")}`}>
              {guestCode}
            </span>
            <button type="button" onClick={copyCode} className="rounded-lg border border-line-strong bg-white px-2.5 py-1 text-sm font-semibold">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button type="button" onClick={onSignedIn} className="key mt-5 w-full rounded-lg bg-primary py-3 text-lg font-semibold text-white">
            I&rsquo;ve saved it
          </button>
        </div>
      </div>
    );
  }

  if (mode === "return") {
    return (
      <form onSubmit={comeBack} className="slab mt-6 rounded-xl bg-white p-6" noValidate>
        <h2 className="font-display text-2xl">Get back in</h2>
        <label className="mt-3 block font-semibold">
          Your guest code
          <input
            value={formatGuestCode(typed)}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="K7QM-3XPA"
            className={`${field} font-mono tracking-[0.12em] uppercase`}
          />
        </label>
        {error && <p role="alert" className="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-sm font-semibold text-error">{error}</p>}
        <button type="submit" disabled={busy || formatGuestCode(typed).length !== 9} className="key mt-5 w-full rounded-lg bg-primary py-3 text-lg font-semibold text-white">
          {busy ? "Checking…" : "Get back in"}
        </button>
        <button type="button" onClick={() => setMode("idle")} className="mt-3 w-full text-sm font-semibold underline underline-offset-4">
          Back
        </button>
      </form>
    );
  }

  return (
    <div className="slab mt-6 rounded-xl bg-white p-6 text-center">
      <button type="button" disabled={busy} onClick={start} className="key font-display w-full rounded-lg bg-primary py-3 text-xl text-white">
        {busy ? "Starting…" : "Start now, no sign-up"}
      </button>
      <p className="mt-2 text-sm text-ink-soft">Guest presentations last 3 days. You can save your account at any time to keep them.</p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-error">{error}</p>}
      <button type="button" onClick={() => setMode("return")} className="mt-3 text-sm font-semibold underline underline-offset-4">
        Have a guest code? Get back in
      </button>
    </div>
  );
}
