"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminSessionRow } from "@/lib/types";
import { Logo } from "../Logo";
import { LoadingScreen } from "../StatusScreens";
import { apiFetch, UnauthorizedError } from "./api";
import { AuthScreen } from "./AuthScreen";
import { NewSessionForm } from "./NewSessionForm";
import { SessionCard } from "./SessionCard";
import { ConfirmDialog } from "../ConfirmDialog";
import { inputClass } from "../auth/AuthShell";

type Account = { email: string | null; guest: boolean; emailVerified: boolean; verificationRequired: boolean };
type Auth = { kind: "checking" } | { kind: "signed_out" } | ({ kind: "signed_in" } & Account);
type Me = { user: { email: string | null; guest: boolean; emailVerified: boolean }; verificationRequired: boolean };

export function AdminApp() {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });

  /** Reads the signed-in account (after load, sign-in, guest start or saving a guest). */
  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return setAuth({ kind: "signed_out" });
      const me = (await res.json()) as Me;
      setAuth({ kind: "signed_in", ...me.user, verificationRequired: me.verificationRequired });
    } catch {
      setAuth({ kind: "signed_out" });
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadMe);
  }, [loadMe]);

  const signOut = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* the cookie is cleared server-side when reachable; show the sign-in screen regardless */
    }
    setAuth({ kind: "signed_out" });
  }, []);

  const expired = useCallback(() => setAuth({ kind: "signed_out" }), []);

  if (auth.kind === "checking") return <LoadingScreen label="Checking your sign-in" />;
  if (auth.kind === "signed_out") return <AuthScreen onSignedIn={() => void loadMe()} />;
  return (
    <Console
      // Remount (and reload the list) when the account changes, e.g. a guest saving their account.
      key={`${auth.email ?? "guest"}:${auth.guest}`}
      account={auth}
      onVerified={() => setAuth({ ...auth, emailVerified: true })}
      onAccountChanged={() => void loadMe()}
      onSignOut={signOut}
      onExpired={expired}
    />
  );
}

function Console({
  account,
  onVerified,
  onAccountChanged,
  onSignOut,
  onExpired,
}: {
  account: Account;
  onVerified: () => void;
  onAccountChanged: () => void;
  onSignOut: () => void;
  onExpired: () => void;
}) {
  const { email, guest, emailVerified, verificationRequired } = account;
  const mustVerify = !guest && verificationRequired && !emailVerified;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [sessions, setSessions] = useState<AdminSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      try {
        return await apiFetch(path, init);
      } catch (err) {
        if (err instanceof UnauthorizedError) onExpired();
        throw err;
      }
    },
    [onExpired],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await call("/api/admin/sessions");
      const body = (await res.json()) as { sessions: AdminSessionRow[] };
      setSessions(body.sessions);
      setError(null);
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) setError((err as Error).message);
    }
  }, [call]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-20 pt-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-3 text-sm">
          {guest ? (
            <span className="rounded-full border-2 border-ink bg-sun px-3 py-1 font-bold">Guest</span>
          ) : (
            <span className="hidden font-semibold text-ink-soft sm:inline">{email}</span>
          )}
          <button
            type="button"
            onClick={guest ? () => setConfirmLeave(true) : onSignOut}
            className="rounded-full border-2 border-ink bg-white px-4 py-1.5 font-bold"
          >
            Log out
          </button>
        </div>
      </header>

      {guest && <GuestBanner onSaved={onAccountChanged} />}
      {mustVerify && email && <VerifyBanner email={email} onVerified={onVerified} />}
      {confirmLeave && (
        <ConfirmDialog
          title="Log out of the guest account?"
          body="Guest accounts have no password, so you won't be able to log back in. Your presentations keep running until they expire. Save your account first to keep access."
          confirmLabel="Log out anyway"
          danger
          onConfirm={() => {
            setConfirmLeave(false);
            onSignOut();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <NewSessionForm call={call} onCreated={refresh} locked={mustVerify} />

        <section aria-labelledby="sessions-h">
          <div className="flex items-baseline justify-between">
            <h2 id="sessions-h" className="font-display text-3xl font-extrabold">
              Your presentations
            </h2>
            <button type="button" onClick={() => void refresh()} className="text-sm font-bold underline underline-offset-4">
              Refresh
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 rounded-xl border-2 border-ink bg-sun px-4 py-2 font-semibold">
              {error}
            </p>
          )}
          {sessions === null && !error && <p className="mt-4 text-ink-soft">Loading…</p>}
          {sessions?.length === 0 && (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-ink/30 p-6 text-ink-soft">
              Nothing here yet. Build a presentation with the form; it appears here with its links and QR code.
            </p>
          )}
          <div className="mt-4 flex flex-col gap-6">
            {sessions?.map((s) => <SessionCard key={s.code} session={s} call={call} onChanged={refresh} />)}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Shown until the email is verified. Notices verification done in another tab by itself. */
function VerifyBanner({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok && ((await res.json()) as Me).user.emailVerified) onVerified();
      } catch {
        /* try again next tick */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [onVerified]);

  async function resend() {
    setBusy(true);
    setNote(null);
    try {
      const res = await apiFetch("/api/auth/resend-verification", { method: "POST" });
      const body = (await res.json()) as { alreadyVerified?: boolean };
      if (body.alreadyVerified) onVerified();
      else setNote("Sent. Check your inbox (and spam).");
    } catch (err) {
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="slab mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-sun px-5 py-4">
      <div>
        <p className="font-display text-xl font-extrabold">Verify your email to start creating presentations</p>
        <p className="text-sm font-medium">
          We sent a link to <strong className="break-all">{email}</strong>. This page unlocks by itself once you click it.
        </p>
        {note && <p className="mt-1 text-sm font-bold">{note}</p>}
      </div>
      <button type="button" onClick={resend} disabled={busy} className="key rounded-xl bg-white px-4 py-2 font-bold">
        {busy ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}

/** Guest accounts: explains the 3-day limit and lets the presenter save the account. */
function GuestBanner({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/auth/upgrade", { method: "POST", body: JSON.stringify({ email, password }) });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="status" className="slab mt-6 rounded-2xl bg-sun px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xl font-extrabold">You&rsquo;re using a guest account</p>
          <p className="text-sm font-medium">
            Votes and results save live, and stay available for 3 days after you create each presentation. Then they&rsquo;re deleted.
            Guests can run up to 3 presentations.
          </p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="key rounded-xl bg-white px-4 py-2 font-bold">
            Save account
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
          <label className="block text-sm font-semibold">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={`${inputClass} bg-white text-base`} />
          </label>
          <label className="block text-sm font-semibold">
            Password <span className="font-normal">(10+ characters)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              maxLength={128}
              className={`${inputClass} bg-white text-base`}
            />
          </label>
          <button type="submit" disabled={busy || !email.includes("@") || password.length < 10} className="key rounded-xl bg-violet px-4 py-3 font-bold text-white">
            {busy ? "Saving…" : "Save and keep everything"}
          </button>
          {error && <p className="text-sm font-bold text-[#a3122f] sm:col-span-3">{error}</p>}
        </form>
      )}
    </div>
  );
}
