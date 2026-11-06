"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminSessionRow } from "@/lib/types";
import { Logo } from "../Logo";
import { Shapes } from "../Shapes";
import { useClientValue } from "../useClientValue";
import { adminFetch, readAdminKey, UnauthorizedError, writeAdminKey } from "./api";
import { NewSessionForm } from "./NewSessionForm";
import { SessionCard } from "./SessionCard";

export function AdminApp() {
  // undefined = not read from sessionStorage yet (avoids a hydration mismatch)
  const stored = useClientValue(readAdminKey);
  const [override, setKey] = useState<string | null | undefined>(undefined);
  const key = override !== undefined ? override : stored;

  const logout = useCallback(() => {
    writeAdminKey(null);
    setKey(null);
  }, []);

  if (key === undefined) return null;
  if (!key)
    return (
      <PasswordScreen
        onUnlock={(k) => {
          writeAdminKey(k);
          setKey(k);
        }}
      />
    );
  return <Console adminKey={key} onLogout={logout} />;
}

function PasswordScreen({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(value, "/api/admin/sessions");
      onUnlock(value);
    } catch (err) {
      setError(err instanceof UnauthorizedError ? "That password didn't work." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden px-5 py-5">
      <Shapes variant="quiet" />
      <Logo />
      <form onSubmit={submit} className="slab mx-auto my-auto w-full max-w-sm rounded-[24px] bg-white p-7">
        <h1 className="font-display text-3xl font-extrabold">Presenter console</h1>
        <label htmlFor="pw" className="mt-5 block font-semibold">
          Admin password
        </label>
        <input
          id="pw"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2.5 text-lg"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "pw-error" : undefined}
        />
        {error && (
          <p id="pw-error" role="alert" className="mt-2 text-sm font-semibold text-[#c2193f]">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !value} className="key mt-5 w-full rounded-xl bg-violet py-3 text-lg font-bold text-white">
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}

function Console({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [sessions, setSessions] = useState<AdminSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      try {
        return await adminFetch(adminKey, path, init);
      } catch (err) {
        if (err instanceof UnauthorizedError) onLogout();
        throw err;
      }
    },
    [adminKey, onLogout],
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
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-5">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <button type="button" onClick={onLogout} className="rounded-full border-2 border-ink bg-white px-4 py-1.5 text-sm font-bold">
          Lock
        </button>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <NewSessionForm call={call} onCreated={refresh} />

        <section aria-labelledby="sessions-h">
          <div className="flex items-baseline justify-between">
            <h2 id="sessions-h" className="font-display text-3xl font-extrabold">
              Your sessions
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
          {sessions === null && !error && <p className="mt-4 text-ink-soft">Loading sessions…</p>}
          {sessions?.length === 0 && (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-ink/30 p-6 text-ink-soft">
              No sessions yet. Create one with the form and it shows up here with its links and QR code.
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
