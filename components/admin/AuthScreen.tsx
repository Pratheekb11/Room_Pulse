"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "../Logo";
import { apiFetch } from "./api";
import { GuestOptions } from "./GuestOptions";

type Mode = "login" | "signup";

export function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Typing a guest code replaces the whole sign-in area, so only one form shows at a time.
  const [returning, setReturning] = useState(false);

  const tooShort = mode === "signup" && password.length > 0 && password.length < 10;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      await res.json();
      setPassword("");
      onSignedIn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={`flex-1 rounded-full py-2 font-bold ${mode === m ? "bg-ink text-white" : "text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex min-h-dvh flex-col px-5 py-5 sm:px-8">
      <Logo />
      <div className="mx-auto my-auto w-full max-w-sm">
        <h1 className="font-display text-center text-4xl leading-tight tracking-tight">{returning ? "Welcome back" : "Make a presentation"}</h1>
        {!returning && <p className="mt-2 text-center text-ink-soft">Takes about two minutes.</p>}

        <GuestOptions onSignedIn={onSignedIn} returning={returning} onReturningChange={setReturning} />
        {!returning && (
          <>

        <p className="mt-6 flex items-center gap-3 text-sm text-ink-soft before:h-px before:flex-1 before:bg-line-strong after:h-px after:flex-1 after:bg-line-strong">
          or use an account
        </p>
        <form onSubmit={submit} className="slab mt-4 rounded-xl bg-white p-6" noValidate>
          <div role="tablist" aria-label="Account" className="flex rounded-full border border-line-strong p-0.5">
            {tab("login", "Log in")}
            {tab("signup", "Sign up")}
          </div>

          <label className="mt-5 block font-semibold">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 text-lg"
            />
          </label>

          <label className="mt-4 block font-semibold">
            Password
            <div className="mt-1 flex rounded-lg border border-line-strong focus-within:outline-3 focus-within:outline-sky">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 10 : undefined}
                maxLength={128}
                required
                aria-describedby={mode === "signup" ? "pw-hint" : undefined}
                className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="px-3 text-sm font-bold"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {mode === "login" && (
            <p className="mt-1.5 text-right text-sm">
              <Link href="/forgot" className="font-semibold underline underline-offset-4">
                Forgot password?
              </Link>
            </p>
          )}
          {mode === "signup" && (
            <p id="pw-hint" className={`mt-1.5 text-sm ${tooShort ? "font-semibold text-error" : "text-ink-soft"}`}>
              At least 10 characters. A short phrase is easy to remember.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-sm font-semibold text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password || tooShort}
            className="key mt-5 w-full rounded-lg bg-ink py-3 text-lg font-semibold text-white disabled:opacity-40"
          >
            {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
          </button>
          <p className="mt-3 text-center text-xs text-ink-soft">An account keeps your presentations for good.</p>
        </form>
          </>
        )}
      </div>
    </main>
  );
}
