"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminSessionRow } from "@/lib/types";
import { Logo } from "../Logo";
import { LoadingScreen } from "../StatusScreens";
import { apiFetch, UnauthorizedError } from "./api";
import { AuthScreen } from "./AuthScreen";
import { NewSessionForm } from "./NewSessionForm";
import { SessionCard } from "./SessionCard";

type Auth = { kind: "checking" } | { kind: "signed_out" } | { kind: "signed_in"; email: string };

export function AdminApp() {
  const [auth, setAuth] = useState<Auth>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) setAuth({ kind: "signed_in", email: ((await res.json()) as { user: { email: string } }).user.email });
        else setAuth({ kind: "signed_out" });
      })
      .catch(() => !cancelled && setAuth({ kind: "signed_out" }));
    return () => {
      cancelled = true;
    };
  }, []);

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
  if (auth.kind === "signed_out") return <AuthScreen onSignedIn={(email) => setAuth({ kind: "signed_in", email })} />;
  return <Console email={auth.email} onSignOut={signOut} onExpired={expired} />;
}

function Console({ email, onSignOut, onExpired }: { email: string; onSignOut: () => void; onExpired: () => void }) {
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
          <span className="hidden font-semibold text-ink-soft sm:inline">{email}</span>
          <button type="button" onClick={onSignOut} className="rounded-full border-2 border-ink bg-white px-4 py-1.5 font-bold">
            Log out
          </button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <NewSessionForm call={call} onCreated={refresh} />

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
