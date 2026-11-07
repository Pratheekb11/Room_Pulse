"use client";

import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { useClientValue } from "../useClientValue";
import { dashboardUrl, shortUrl, voterUrl } from "@/lib/site";
import type { AdminSessionRow } from "@/lib/types";
import { ConfirmDialog } from "../ConfirmDialog";

type Call = (path: string, init?: RequestInit) => Promise<Response>;
type Pending = "toggle" | "reset" | "recalc" | "delete" | "summary" | "raw" | null;

function CopyLink({ label, url, newTab }: { label: string; url: string; newTab?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is still visible to select */
    }
  }
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-ink-soft">{label}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <a
          href={url}
          target={newTab ? "_blank" : undefined}
          rel={newTab ? "noopener noreferrer" : undefined}
          className="min-w-0 truncate font-semibold underline decoration-primary decoration-2 underline-offset-4"
        >
          {shortUrl(url)}
        </a>
        <button type="button" onClick={copy} className="shrink-0 rounded-lg border border-line-strong px-2 py-0.5 text-xs font-bold">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function SessionCard({ session: s, call, onChanged }: { session: AdminSessionRow; call: Call; onChanged: () => Promise<void> }) {
  const voter = useClientValue(() => voterUrl(s.code));
  const dash = useClientValue(() => dashboardUrl(s.code, s.dashboardKey));
  const urls = voter && dash ? { voter, dash } : null;
  const [pending, setPending] = useState<Pending>(null);
  const [dialog, setDialog] = useState<"reset" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDetailsElement>(null);

  // The "More" menu closes when you tap outside it or press Escape.
  useEffect(() => {
    const close = (e: Event) => {
      const d = more.current;
      if (!d?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  async function run(kind: Exclude<Pending, null>, fn: () => Promise<void>, done?: string) {
    setPending(kind);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const base = `/api/admin/sessions/${s.code}`;

  const toggle = () =>
    run("toggle", async () => {
      await call(base, { method: "PATCH", body: JSON.stringify({ isOpen: !s.isOpen }) });
    });

  const reset = () =>
    run("reset", async () => {
      await call(`${base}/reset`, { method: "POST" });
      setDialog(null);
    }, "All answers cleared.");

  const recalc = () =>
    run("recalc", async () => {
      await call(`${base}/recalculate`, { method: "POST" });
    }, "Totals recounted. Everything matches the saved answers.");

  const remove = () =>
    run("delete", async () => {
      await call(base, { method: "DELETE" });
      setDialog(null);
    });

  const exportCsv = (type: "summary" | "raw") =>
    run(type, async () => {
      const res = await call(`${base}/export?type=${type}`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `liverate-${s.code}-${type}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    });

  function downloadPng() {
    const canvas = canvasWrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `liverate-${s.code}-qr.png`;
    a.click();
  }

  const created = new Date(s.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const btn = "key rounded-lg px-3 py-1.5 text-sm font-bold";

  const menuItem = "block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-canvas disabled:opacity-40";

  return (
    <article id={`card-${s.code}`} className="slab scroll-mt-6 rounded-xl bg-white p-5" aria-labelledby={`s-${s.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`s-${s.code}`} className="font-display text-2xl leading-tight break-words">
            {s.title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            {s.focusCount} {s.focusCount === 1 ? "question" : "questions"}. {s.voterCount} {s.voterCount === 1 ? "person has" : "people have"} answered. Made{" "}
            {created}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.expiresAt && (
            <span className="rounded-full bg-sun px-3 py-0.5 text-sm font-semibold" title={new Date(s.expiresAt).toLocaleString()}>
              Deleted in {timeLeft(s.expiresAt)}
            </span>
          )}
          <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${s.isOpen ? "bg-mint" : "bg-ink text-white"}`}>
            {s.isOpen ? "Voting open" : "Voting closed"}
          </span>
        </div>
      </div>

      {/* relative: on phones the More menu spans this row, so it can't run off the screen edge */}
      <div className="relative mt-4 flex flex-wrap items-center gap-2.5">
        {urls && (
          <a href={urls.dash} target="_blank" rel="noopener noreferrer" className="key rounded-lg bg-primary px-5 py-2.5 font-semibold text-white">
            Present
          </a>
        )}
        <a href={`/admin/edit/${s.code}`} className={`${btn} bg-white`}>
          Edit questions
        </a>
        <button type="button" onClick={toggle} disabled={pending !== null} className={`${btn} bg-white`}>
          {pending === "toggle" ? "Saving…" : s.isOpen ? "Close voting" : "Reopen voting"}
        </button>
        <details ref={more} className="md:relative">
          <summary className={`${btn} cursor-pointer list-none bg-white [&::-webkit-details-marker]:hidden`}>More</summary>
          {/* Picking an item closes the menu */}
          <div
            onClick={() => {
              if (more.current) more.current.open = false;
            }}
            className="absolute inset-x-0 z-20 mt-1 rounded-lg border border-line-strong bg-white p-1 md:right-auto md:left-0 md:w-64"
          >
            <button type="button" onClick={() => exportCsv("summary")} disabled={pending !== null} className={menuItem}>
              {pending === "summary" ? "Downloading…" : "Download results (CSV)"}
            </button>
            <button type="button" onClick={() => exportCsv("raw")} disabled={pending !== null} className={menuItem}>
              {pending === "raw" ? "Downloading…" : "Download every answer (CSV)"}
            </button>
            <button type="button" onClick={downloadPng} className={menuItem}>
              Download QR code (PNG)
            </button>
            <button type="button" onClick={recalc} disabled={pending !== null || s.isOpen} className={menuItem}>
              {pending === "recalc" ? "Recounting…" : "Recount totals"}
              <span className="block text-xs font-normal text-ink-soft">{s.isOpen ? "Close voting first." : "Rebuilds every total from the saved answers."}</span>
            </button>
            <button type="button" onClick={() => setDialog("reset")} disabled={pending !== null} className={menuItem}>
              Clear all answers
            </button>
            <button type="button" onClick={() => setDialog("delete")} disabled={pending !== null} className={`${menuItem} text-error`}>
              Delete presentation
            </button>
          </div>
        </details>
      </div>

      <div className="mt-5 grid gap-5 border-t border-line pt-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="rounded-lg border border-line-strong bg-white p-2 self-start justify-self-start">
          {urls && <QRCodeSVG value={urls.voter} size={104} marginSize={0} fgColor="#26251e" title={`QR code for ${urls.voter}`} />}
        </div>
        <div ref={canvasWrap} className="hidden" aria-hidden>
          {urls && <QRCodeCanvas value={urls.voter} size={1024} marginSize={4} fgColor="#26251e" />}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {urls && (
            <>
              <CopyLink label={`Link for your audience (code ${s.code})`} url={urls.voter} />
              <CopyLink label="Results screen link (keep it private)" url={urls.dash} newTab />
            </>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mt-3 text-sm font-semibold text-success">
          {notice}
        </p>
      )}

      {dialog === "reset" && (
        <ConfirmDialog
          title="Clear all answers?"
          body={`This deletes every answer in “${s.title}” for good. Your questions and links stay the same.`}
          confirmLabel="Clear all answers"
          typeToConfirm="RESET"
          danger
          busy={pending === "reset"}
          onConfirm={reset}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete this presentation?"
          body={`“${s.title}” and all of its answers will be deleted for good. Its links stop working.`}
          confirmLabel="Delete presentation"
          danger
          busy={pending === "delete"}
          onConfirm={remove}
          onCancel={() => setDialog(null)}
        />
      )}
    </article>
  );
}

/** "2 days 5 h", "5 h", "under an hour". */
function timeLeft(iso: string): string {
  const hours = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 3_600_000));
  if (hours < 1) return "under an hour";
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return d ? `${d} ${d === 1 ? "day" : "days"}${h ? ` ${h} h` : ""}` : `${h} h`;
}
