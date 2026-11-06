"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell, primaryButton } from "./AuthShell";
import { useLinkToken } from "./useLinkToken";

type State = "checking" | "verified" | "invalid" | "error";

export function VerifyEmail() {
  const token = useLinkToken();
  const [result, setState] = useState<State | null>(null);
  const state: State = result ?? (token === null ? "invalid" : "checking");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((res) => !cancelled && setState(res.ok ? "verified" : res.status === 400 ? "invalid" : "error"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "checking") return <AuthShell title="Verifying…"><p className="text-center text-lg">One moment.</p></AuthShell>;
  if (state === "verified")
    return (
      <AuthShell title="Email verified 🎉">
        <p className="text-lg">You&rsquo;re all set to create presentations.</p>
        <Link href="/admin" className={`${primaryButton} block text-center`}>
          Open the console
        </Link>
      </AuthShell>
    );
  return (
    <AuthShell title={state === "invalid" ? "This link doesn't work" : "Something went wrong"}>
      <p className="text-lg">
        {state === "invalid"
          ? "Verification links work once and expire after 24 hours. Log in and send yourself a new one."
          : "We couldn't reach the server. Check your connection and open the link again."}
      </p>
      <Link href="/admin" className={`${primaryButton} block text-center`}>
        Go to log in
      </Link>
    </AuthShell>
  );
}
