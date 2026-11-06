"use client";

import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
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

  return (
    <article className="slab rounded-xl bg-white p-5" aria-labelledby={`s-${s.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`s-${s.code}`} className="font-display text-2xl font-semibold leading-tight break-words">
            {s.title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Code <span className="font-bold text-ink">{s.code}</span>, made {created}. {s.focusCount} {s.focusCount === 1 ? "question" : "questions"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.expiresAt && (
            <span className="rounded-full border border-line-strong bg-sun px-3 py-0.5 text-sm font-bold" title={new Date(s.expiresAt).toLocaleString()}>
              Deleted in {timeLeft(s.expiresAt)}
            </span>
          )}
          <span className={`rounded-full border border-line-strong px-3 py-0.5 text-sm font-bold ${s.isOpen ? "bg-mint" : "bg-ink text-white"}`}>
            {s.isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-lg border border-line-strong bg-white p-2">
            {urls && <QRCodeSVG value={urls.voter} size={128} marginSize={0} fgColor="#26251e" title={`QR code for ${urls.voter}`} />}
          </div>
          <div ref={canvasWrap} className="hidden" aria-hidden>
            {urls && <QRCodeCanvas value={urls.voter} size={1024} marginSize={4} fgColor="#26251e" />}
          </div>
          <button type="button" onClick={downloadPng} className="text-xs font-bold underline underline-offset-4">
            Download PNG
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {urls && (
            <>
              <CopyLink label="Link for your audience" url={urls.voter} />
              <CopyLink label="Your results screen (keep this link private)" url={urls.dash} newTab />
            </>
          )}
          <p className="font-display text-lg font-bold">
            {s.voterCount} {s.voterCount === 1 ? "person has" : "people have"} answered
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <a href={`/admin/edit/${s.code}`} className={`${btn} bg-white`}>
          Edit questions
        </a>
        <button type="button" onClick={toggle} disabled={pending !== null} className={`${btn} ${s.isOpen ? "bg-sun" : "bg-mint"}`}>
          {pending === "toggle" ? "Saving…" : s.isOpen ? "Close voting" : "Reopen voting"}
        </button>
        <button type="button" onClick={() => exportCsv("summary")} disabled={pending !== null} className={`${btn} bg-white`}>
          {pending === "summary" ? "Downloading…" : "Download results (CSV)"}
        </button>
        <button type="button" onClick={() => exportCsv("raw")} disabled={pending !== null} className={`${btn} bg-white`}>
          {pending === "raw" ? "Downloading…" : "Download every answer (CSV)"}
        </button>
        <button
          type="button"
          onClick={recalc}
          disabled={pending !== null || s.isOpen}
          title={s.isOpen ? "Close voting first" : "Recounts every total from the saved answers"}
          className={`${btn} bg-white`}
        >
          {pending === "recalc" ? "Recounting…" : "Recount totals"}
        </button>
        <button type="button" onClick={() => setDialog("reset")} disabled={pending !== null} className={`${btn} bg-white`}>
          Clear all answers
        </button>
        <button type="button" onClick={() => setDialog("delete")} disabled={pending !== null} className={`${btn} bg-white text-error`}>
          Delete presentation
        </button>
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
