"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "../admin/api";
import { AuthShell, ErrorNote, inputClass, primaryButton } from "./AuthShell";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox">
        <p className="text-lg">
          If an account exists for <strong className="break-all">{email}</strong>, we&rsquo;ve sent a link to reset its password. It
          expires in 30 minutes.
        </p>
        <p className="mt-3 text-sm text-ink-soft">Nothing after a few minutes? Check spam, or try again.</p>
        <Link href="/admin" className="mt-5 block text-center font-bold underline underline-offset-4">
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?">
      <form onSubmit={submit} noValidate>
        <p className="text-ink-soft">Enter your account email and we&rsquo;ll send you a link to choose a new password.</p>
        <label className="mt-4 block font-semibold">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={inputClass} />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" disabled={busy || !email.includes("@")} className={primaryButton}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/admin" className="mt-4 block text-center text-sm font-bold underline underline-offset-4">
          Back to log in
        </Link>
      </form>
    </AuthShell>
  );
}
