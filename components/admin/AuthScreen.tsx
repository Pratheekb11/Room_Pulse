"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "../Logo";
import { Shapes } from "../Shapes";
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
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-5 py-5">
      <Shapes variant="quiet" />
      <Logo />
      <div className="mx-auto my-auto w-full max-w-sm">
        <h1 className="font-display text-center text-4xl font-extrabold leading-tight tracking-tight">
          {mode === "login" ? "Welcome back" : "Run your first session"}
        </h1>
        <form onSubmit={submit} className="slab mt-6 rounded-[24px] bg-white p-6" noValidate>
          <div role="tablist" aria-label="Account" className="flex rounded-full border-2 border-ink p-0.5">
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
              className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2.5 text-lg"
            />
          </label>

          <label className="mt-4 block font-semibold">
            Password
            <div className="mt-1 flex rounded-xl border-2 border-ink focus-within:outline-3 focus-within:outline-sky">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? 10 : undefined}
                maxLength={128}
                required
                aria-describedby={mode === "signup" ? "pw-hint" : undefined}
                className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-lg focus:outline-none"
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
            <p id="pw-hint" className={`mt-1.5 text-sm ${tooShort ? "font-semibold text-[#c2193f]" : "text-ink-soft"}`}>
              At least 10 characters. A short phrase is easy to remember.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-coral/15 px-3 py-2 text-sm font-semibold text-[#a3122f]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !email || !password || tooShort}
            className="key font-display mt-5 w-full rounded-xl bg-violet py-3 text-xl font-bold text-white"
          >
            {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <GuestOptions onSignedIn={onSignedIn} />
      </div>
    </main>
  );
}
