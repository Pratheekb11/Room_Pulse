"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiFetch } from "../admin/api";
import { AuthShell, ErrorNote, inputClass, primaryButton } from "./AuthShell";
import { useLinkToken } from "./useLinkToken";

export function ResetForm() {
  const token = useLinkToken();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      router.replace("/admin");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_link") setExpired(true);
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (token === undefined) return <AuthShell title="Choose a new password"><p className="text-center">One moment.</p></AuthShell>;
  if (!token || expired) {
    return (
      <AuthShell title="This link doesn't work">
        <p className="text-lg">Reset links work once and expire after 30 minutes.</p>
        <Link href="/forgot" className={`${primaryButton} block text-center`}>
          Send a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={submit} noValidate>
        <label className="block font-semibold">
          New password
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            maxLength={128}
            className={inputClass}
            aria-describedby="pw-hint"
          />
        </label>
        <p id="pw-hint" className={`mt-1.5 text-sm ${tooShort ? "font-semibold text-error" : "text-ink-soft"}`}>
          At least 10 characters.
        </p>
        <label className="mt-4 block font-semibold">
          Type it again
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            maxLength={128}
            className={inputClass}
          />
        </label>
        {mismatch && <p className="mt-1.5 text-sm font-semibold text-error">The two passwords don&rsquo;t match.</p>}
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4" />
          Show passwords
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" disabled={busy || password.length < 10 || confirm !== password} className={primaryButton}>
          {busy ? "Saving…" : "Save new password"}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">This signs you out on every other device.</p>
      </form>
    </AuthShell>
  );
}
