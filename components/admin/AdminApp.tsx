"use client";

import { GUEST_DAYS, GUEST_PRESENTATION_LIMIT } from "@/lib/guest-rules";
import { useCallback, useEffect, useState } from "react";
import type { AdminSessionRow } from "@/lib/types";
import { Logo } from "../Logo";
import { LoadingScreen } from "../StatusScreens";
import { apiFetch, UnauthorizedError } from "./api";
import { AuthScreen } from "./AuthScreen";
import { PresentationForm } from "./PresentationForm";
import { SessionCard } from "./SessionCard";
import { ConfirmDialog } from "../ConfirmDialog";
import { inputClass } from "../auth/AuthShell";
import { codeSeen, markCodeSeen, readGuestCode, rememberGuestCode } from "./guestCode";
import { GuestCodeCard } from "./GuestCodeCard";
import { useClientValue } from "../useClientValue";
import { Words } from "@/components/home/Words";

type Account = { email: string | null; guest: boolean; emailVerified: boolean; verificationRequired: boolean };
type Auth = { kind: "checking" } | { kind: "signed_out" } | ({ kind: "signed_in" } & Account);
type Me = { user: { email: string | null; guest: boolean; emailVerified: boolean }; verificationRequired: boolean };

export function AdminApp({ startActivity: linked }: { startActivity?: string } = {}) {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });
  // An activity from the home page's links: used once, then forgotten (so saving a guest account doesn't reopen it).
  const [startActivity, setStartActivity] = useState(linked);

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
      rememberGuestCode(null);
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
      startActivity={startActivity}
      onActivityStarted={() => {
        setStartActivity(undefined);
        // a refresh keeps the draft, not the link
        if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
      }}
    />
  );
}

function Console({
  account,
  onVerified,
  onAccountChanged,
  onSignOut,
  onExpired,
  startActivity,
  onActivityStarted,
}: {
  account: Account;
  startActivity?: string;
  onActivityStarted?: () => void;
  onVerified: () => void;
  onAccountChanged: () => void;
  onSignOut: () => void;
  onExpired: () => void;
}) {
  const { email, guest, emailVerified, verificationRequired } = account;
  const mustVerify = !guest && verificationRequired && !emailVerified;
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Guests start building straight away; their code shows once something is saved, and again before they leave.
  const guestCode = useClientValue(readGuestCode);
  const [showCode, setShowCode] = useState(false);
  const [sessions, setSessions] = useState<AdminSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The form shows by itself until there's a presentation; after that it opens on request.
  // An activity link opens it straight away, even with presentations already made.
  const [formOpen, setFormOpen] = useState(Boolean(startActivity));
  // Guests who try an account-only feature (AI insights) get the save-account form opened for them.
  const [saveOpen, setSaveOpen] = useState(false);
  // AI controls only show once the site has a Gemini key.
  const [aiAvailable, setAiAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/ai/questions", { cache: "no-store", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { available?: boolean } | null) => {
        if (!cancelled) setAiAvailable(body?.available === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const askForAccount = useCallback(() => {
    setSaveOpen(true);
    requestAnimationFrame(() => document.getElementById("save-account")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, []);

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
        <div className="flex items-center gap-2 text-[15px] whitespace-nowrap">
          {guest ? (
            <span className="flex h-10 items-center rounded-lg border border-line-strong bg-sun px-3.5 font-semibold">Guest</span>
          ) : (
            <span className="hidden font-semibold text-ink-soft sm:inline">{email}</span>
          )}
          <button
            type="button"
            onClick={guest ? () => setConfirmLeave(true) : onSignOut}
            className="flex h-10 items-center rounded-lg border border-line-strong bg-white px-3.5 font-semibold hover:bg-line-soft"
          >
            Log out
          </button>
        </div>
      </header>

      {guest && <GuestBanner onSaved={onAccountChanged} open={saveOpen} setOpen={setSaveOpen} />}
      {mustVerify && email && <VerifyBanner email={email} onVerified={onVerified} />}
      {confirmLeave &&
        (guestCode ? (
          <GuestCodeCard
            code={guestCode}
            title="Before you go: your guest code"
            body="Type it on any phone or computer to get back to your presentations. They keep working while you're logged out."
            primary="Log out"
            danger
            onPrimary={() => {
              setConfirmLeave(false);
              onSignOut();
            }}
            secondary="Stay"
            onSecondary={() => setConfirmLeave(false)}
          />
        ) : (
          <ConfirmDialog
            title="Log out of the guest account?"
            body="To get back in later, on any device, you need your guest code. Your presentations keep working while you're logged out."
            confirmLabel="Log out"
            danger
            onConfirm={() => {
              setConfirmLeave(false);
              onSignOut();
            }}
            onCancel={() => setConfirmLeave(false)}
          />
        ))}
      {showCode && guestCode && (
        <GuestCodeCard
          code={guestCode}
          title={<>Saved. Here&rsquo;s your guest code</>}
          primary="I've saved it"
          onPrimary={() => {
            markCodeSeen();
            setShowCode(false);
          }}
        />
      )}

      {sessions === null && !error && <p className="mt-8 text-ink-soft">Loading your presentations…</p>}
      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-line-strong bg-sun px-4 py-2 font-semibold">
          {error}
        </p>
      )}

      {sessions !== null && (sessions.length === 0 || formOpen) && (
        <div className="mt-8">
          {sessions.length === 0 && (
            <p className="mb-4 text-ink-soft">Write your questions below. When you&rsquo;re done you&rsquo;ll get a QR code to show your audience.</p>
          )}
          <PresentationForm
            call={call}
            mode={{ kind: "create" }}
            onCancel={sessions.length ? () => setFormOpen(false) : undefined}
            onDone={async (code) => {
              await refresh();
              setFormOpen(false);
              if (guest && guestCode && !codeSeen()) setShowCode(true);
              // Take the presenter straight to what they just made.
              requestAnimationFrame(() => document.getElementById(`card-${code}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
            }}
            locked={mustVerify}
            guest={guest}
            aiAvailable={aiAvailable}
            onNeedAccount={askForAccount}
            startActivity={startActivity}
            onActivityStarted={onActivityStarted}
          />
        </div>
      )}

      {sessions !== null && sessions.length > 0 && !formOpen && (
        <section aria-labelledby="sessions-h" className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="sessions-h" className="font-display text-3xl">
              <Words text="Your presentations" />
            </h2>
            <button type="button" onClick={() => setFormOpen(true)} disabled={mustVerify} className="key rounded-lg bg-ink px-4 py-2.5 font-semibold text-white">
              + New presentation
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
            {sessions.map((s, i) => (
              <div key={s.code} className="enter min-w-0" style={{ "--i": i + 2 } as React.CSSProperties}>
                <SessionCard session={s} call={call} onChanged={refresh} guest={guest} aiAvailable={aiAvailable} onNeedAccount={askForAccount} />
              </div>
            ))}
          </div>
        </section>
      )}
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
    <div role="status" className="slab mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sun px-5 py-4">
      <div>
        <p className="font-display text-xl font-semibold">Confirm your email address to start making presentations</p>
        <p className="text-sm font-medium">
          We sent a link to <strong className="break-all">{email}</strong>. This page unlocks by itself once you click it.
        </p>
        {note && <p className="mt-1 text-sm font-bold">{note}</p>}
      </div>
      <button type="button" onClick={resend} disabled={busy} className="key rounded-lg bg-white px-4 py-2 font-bold">
        {busy ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}

/** Guest accounts: explains the 3-day limit and lets the presenter save the account. */
function GuestBanner({ onSaved, open, setOpen }: { onSaved: () => void; open: boolean; setOpen: (open: boolean) => void }) {
  const guestCode = useClientValue(readGuestCode);
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
      rememberGuestCode(null);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="save-account" role="status" className="mt-6 scroll-mt-6 rounded-xl bg-sun px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <p>
            <strong>Guest account.</strong> Presentations are deleted after {GUEST_DAYS} days.
            {guestCode && (
              <>
                {" "}
                Your guest code is <strong className="font-mono whitespace-nowrap">{guestCode}</strong>.
              </>
            )}
          </p>
          <details className="mt-0.5">
            <summary className="cursor-pointer text-ink-soft underline underline-offset-4">What does this mean?</summary>
            <p className="mt-1 max-w-2xl text-ink-soft">
              You can have up to {GUEST_PRESENTATION_LIMIT} presentations, and each is deleted {GUEST_DAYS} days after you make it, with all its answers. Closing the browser logs you out; to get back in,
              choose &ldquo;Have a guest code?&rdquo; and type your guest code, on this or any other device. Save your account to keep everything.
            </p>
          </details>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="key rounded-lg bg-white px-4 py-2 text-sm font-semibold">
            Save my account
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
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
          <button type="submit" disabled={busy || !email.includes("@") || password.length < 10} className="key rounded-lg bg-primary px-4 py-3 font-bold text-white">
            {busy ? "Saving…" : "Save and keep everything"}
          </button>
          {error && <p className="text-sm font-bold text-error sm:col-span-3">{error}</p>}
        </form>
      )}
    </div>
  );
}
