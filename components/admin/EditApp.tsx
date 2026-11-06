"use client";

import { useEffect, useState } from "react";
import type { SessionPayload } from "@/lib/types";
import { Logo } from "../Logo";
import { LoadingScreen } from "../StatusScreens";
import { apiFetch, ApiError, UnauthorizedError } from "./api";
import { PresentationForm } from "./PresentationForm";

type Loaded = { session: SessionPayload; counts: Record<string, number>; scaleLocked: boolean };
type State = { kind: "loading" } | { kind: "signed_out" } | { kind: "missing" } | { kind: "error"; message: string } | ({ kind: "ready" } & Loaded);

/** Edit an existing presentation (owner only). Opened from the console or the results screen. */
export function EditApp({ code, backTo }: { code: string; backTo: "results" | "console" }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const back = backTo === "results" ? `/s/${code}/dashboard` : "/admin";

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/admin/sessions/${code}`)
      .then(async (res) => {
        const body = (await res.json()) as Loaded;
        if (!cancelled) setState({ kind: "ready", ...body });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) setState({ kind: "signed_out" });
        else if (err instanceof ApiError && err.status === 404) setState({ kind: "missing" });
        else setState({ kind: "error", message: (err as Error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.kind === "loading") return <LoadingScreen label="Opening your presentation" />;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-5">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <a href={back} className="text-sm font-semibold underline underline-offset-4">
          {backTo === "results" ? "Back to results" : "Back to your presentations"}
        </a>
      </header>

      <div className="mt-8">
        {state.kind === "ready" && (
          <PresentationForm
            call={apiFetch}
            mode={{ kind: "edit", code, session: state.session, counts: state.counts, scaleLocked: state.scaleLocked }}
            onDone={() => window.location.assign(back)}
            onCancel={() => window.location.assign(back)}
          />
        )}
        {state.kind === "signed_out" && (
          <Message title="Log in to edit this presentation">
            Only the person who made a presentation can change it.{" "}
            <a href="/admin" className="font-semibold underline underline-offset-4">
              Log in
            </a>
            , then come back to this page.
          </Message>
        )}
        {state.kind === "missing" && (
          <Message title="We couldn't find this presentation">
            It may have been deleted, or it belongs to a different account.{" "}
            <a href="/admin" className="font-semibold underline underline-offset-4">
              See your presentations
            </a>
            .
          </Message>
        )}
        {state.kind === "error" && <Message title="Something went wrong">{state.message}</Message>}
      </div>
    </div>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="slab rounded-xl bg-white p-6">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-2 text-ink-soft">{children}</p>
    </section>
  );
}
