"use client";

import { useEffect, useState } from "react";
import { Logo } from "../Logo";
import { Picture } from "../Picture";
import { CenteredMessage, LoadingScreen } from "../StatusScreens";
import { isOverdue, pointCounts, sortPoints, statusLabel } from "@/lib/points";
import type { Report, ReportRow, ReportSection } from "@/lib/report";
import type { OpenPoint } from "@/lib/types";

type State = { kind: "loading" } | { kind: "ready"; report: Report } | { kind: "signin" } | { kind: "missing" } | { kind: "error" };

const longDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (ymd: string) => new Date(`${ymd}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * The owner's report: every question's results with a short analysis, what needs attention, the AI
 * summary and the open point list. "Save as PDF" opens the browser's print window, which saves it as
 * a PDF (real text, any language, pictures included). With `autoPrint` that window opens by itself.
 */
export function ReportApp({ code, autoPrint }: { code: string; autoPrint: boolean }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/sessions/${encodeURIComponent(code)}/report`, { cache: "no-store", credentials: "same-origin" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) return setState({ kind: "signin" });
        if (res.status === 404) return setState({ kind: "missing" });
        if (!res.ok) return setState({ kind: "error" });
        setState({ kind: "ready", report: (await res.json()) as Report });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const report = state.kind === "ready" ? state.report : null;
  // The PDF takes its file name from the page title.
  useEffect(() => {
    if (report) document.title = `${report.title} · LiveRate report`;
  }, [report]);

  // Arriving from "Download report (PDF)": open the print window once every picture has loaded.
  useEffect(() => {
    if (!report || !autoPrint) return;
    let cancelled = false;
    const pictures = Array.from(document.images).filter((img) => !img.complete);
    const loaded = pictures.map((img) => new Promise<void>((done) => ["load", "error"].forEach((e) => img.addEventListener(e, () => done(), { once: true }))));
    const giveUp = new Promise<void>((done) => setTimeout(done, 4000));
    void Promise.race([Promise.all(loaded), giveUp]).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, [report, autoPrint]);

  if (state.kind === "loading") return <LoadingScreen label="Making the report" />;
  if (state.kind === "signin") return <CenteredMessage title="Sign in to see this report" body="Reports are for the presenter. Open your presentations, sign in, and choose “Download report (PDF)” again." />;
  if (state.kind === "missing") return <CenteredMessage title="Presentation not found" body="It may have been deleted, or it belongs to another account." />;
  if (state.kind === "error" || !report) return <CenteredMessage title="We couldn't make the report" body="Check your internet and reload the page." link={false} />;

  const counts = pointCounts(report.points);
  return (
    <div className="min-h-dvh bg-canvas px-3 py-4 text-ink sm:px-6 sm:py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[52rem] flex-wrap items-center justify-between gap-3">
        <a href="/admin" className="rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-bold">
          ← Your presentations
        </a>
        <div className="flex flex-wrap items-center gap-3">
          <p className="max-w-[26rem] text-sm text-ink-soft">In the print window, choose “Save as PDF” as the printer.</p>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-ink px-4 py-2 font-bold text-white">
            Save as PDF
          </button>
        </div>
      </div>

      <article className="report slab mx-auto max-w-[52rem] rounded-xl bg-white p-5 sm:p-10">
        <header className="report-keep border-b-2 border-ink pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Logo />
            <p className="text-sm text-ink-soft">Report · {report.generatedAt ? longDate(report.generatedAt) : ""}</p>
          </div>
          <h1 className="font-display mt-4 text-3xl font-semibold leading-tight break-words sm:text-4xl">{report.title}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="People took part" value={String(report.people)} />
            <Stat label="Questions" value={String(report.sections.length)} />
            <Stat label="Voting" value={report.isOpen ? "Open" : "Closed"} />
            <Stat label="Open points to do" value={report.points.length ? `${counts.active} of ${report.points.length}` : "None"} />
          </dl>
        </header>

        <section className="mt-6" aria-labelledby="findings-h">
          <h2 id="findings-h" className="font-display text-2xl font-semibold">
            Key findings
          </h2>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
            {report.findings.map((f, i) => (
              <li key={i} className="report-keep break-words">
                {f}
              </li>
            ))}
          </ul>
        </section>

        {report.attention.length > 0 && (
          <section className="report-keep mt-6 rounded-xl border border-line-strong bg-sun/40 p-4" aria-labelledby="attention-h">
            <h2 id="attention-h" className="font-display text-xl font-semibold">
              Needs attention
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {report.attention.map((a) => (
                <li key={a.title + a.reason} className="break-words">
                  <span className="font-bold">{a.title}.</span> <span className="text-ink-soft">{a.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.ai && (
          <section className="mt-6 rounded-xl border border-dashed border-line-strong p-4" aria-labelledby="ai-h">
            <h2 id="ai-h" className="text-sm font-bold text-ink-soft">
              AI summary
            </h2>
            <p className="font-display mt-1 text-2xl font-semibold leading-tight break-words">{report.ai.headline}</p>
            <p className="mt-2 leading-relaxed break-words">{report.ai.summary}</p>
            {report.ai.actions.length > 0 && (
              <>
                <h3 className="mt-3 font-bold">Suggested next steps</h3>
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                  {report.ai.actions.map((a) => (
                    <li key={a} className="break-words">
                      {a}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-3 text-xs text-ink-soft">
              Written by AI (Google Gemini) from {report.ai.people} {report.ai.people === 1 ? "person's" : "people's"} answers on {longDate(report.ai.at)}. It can get things
              wrong, so check before you act on it.
            </p>
          </section>
        )}

        {report.sections.map((s) => (
          <Section key={s.focusId} s={s} people={report.people} />
        ))}

        {report.leaderboard.length > 0 && (
          <section className="mt-8" aria-labelledby="board-h">
            <h2 id="board-h" className="font-display text-2xl font-semibold">
              Quiz leaderboard
            </h2>
            <ol className="mt-2">
              {report.leaderboard.map((p, i) => (
                <li key={`${p.nickname}-${i}`} className="report-keep grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-line py-1.5">
                  <span className="font-display font-semibold tabular-nums">{i + 1}</span>
                  <span className="min-w-0 font-semibold break-words">{p.nickname}</span>
                  <span className="text-right tabular-nums">
                    {p.points.toLocaleString("en-US")} points · {p.correct} right
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-8" aria-labelledby="points-h">
          <h2 id="points-h" className="font-display text-2xl font-semibold">
            Open points
          </h2>
          {report.points.length === 0 ? (
            <p className="mt-1 text-ink-soft">No open points were raised or added.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-soft tabular-nums">
                {counts.open} open · {counts.doing} in progress · {counts.closed} closed
              </p>
              <ol className="mt-2 flex flex-col gap-2">
                {sortPoints(report.points).map((p) => (
                  <Point key={p.id} p={p} today={(report.generatedAt ?? "").slice(0, 10)} />
                ))}
              </ol>
            </>
          )}
        </section>

        <footer className="mt-8 border-t border-line pt-3 text-xs text-ink-soft">
          Made with LiveRate. Answers are anonymous. Hidden answers and hidden questions are left out of this report.
        </footer>
      </article>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line-strong p-3">
      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ s, people }: { s: ReportSection; people: number }) {
  return (
    <section className="mt-8" aria-labelledby={`q-${s.focusId}`}>
      <div className="report-keep">
        <p className="text-sm font-bold text-ink-soft">
          Question {s.index} · {s.kindLabel}
          {s.people !== null && people > 0 ? ` · ${s.people} of ${people} ${people === 1 ? "person" : "people"} answered${s.share !== null ? ` (${s.share}%)` : ""}` : ""}
        </p>
        <h2 id={`q-${s.focusId}`} className="font-display text-2xl font-semibold leading-tight break-words">
          {s.name}
        </h2>
        {s.description && <p className="mt-1 text-ink-soft break-words">{s.description}</p>}
        {s.imageId && <Picture id={s.imageId} alt={`Picture for: ${s.name}`} eager className="mt-2 block max-h-56 max-w-full rounded-lg border border-line-strong" />}
        <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-canvas p-3 print:border print:border-line-strong">
          {s.highlights.map((h, i) => (
            <li key={i} className="font-semibold break-words">
              {h}
            </li>
          ))}
          {s.insight && (
            <li className="mt-1 border-t border-line pt-1.5 break-words">
              <span className="mr-1.5 text-xs font-bold text-ink-soft">AI insight</span>
              {s.insight}
            </li>
          )}
        </ul>
      </div>

      {s.rows.length > 0 && (
        <ol className="mt-2">
          {s.rows.map((r, i) => (
            <Row key={`${r.name}-${i}`} r={r} />
          ))}
        </ol>
      )}
      {s.texts.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {s.texts.map((t, i) => (
            <li key={i} className="report-keep rounded-lg border border-line-strong px-3 py-2 break-words">
              {t}
            </li>
          ))}
        </ul>
      )}
      {s.note && <p className="mt-2 text-xs text-ink-soft">{s.note}</p>}
    </section>
  );
}

function Row({ r }: { r: ReportRow }) {
  return (
    <li className="report-keep grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-line py-2">
      <div className="flex min-w-0 items-center gap-3">
        {r.imageId && <Picture id={r.imageId} alt="" eager className="h-12 w-12 shrink-0 rounded-lg border border-line-strong" />}
        <div className="min-w-0">
          <p className="font-semibold break-words">
            {r.name}
            {r.tag && <span className="ml-2 rounded-full bg-sun px-2 py-0.5 text-xs font-bold whitespace-nowrap text-ink">{r.tag}</span>}
          </p>
          {r.description && <p className="text-sm text-ink-soft break-words">{r.description}</p>}
          {r.detail && <p className="text-xs text-ink-soft break-words">{r.detail}</p>}
        </div>
      </div>
      <p className="font-display text-right text-xl font-semibold tabular-nums">{r.value}</p>
      {r.pct !== null && (
        <div className="col-span-2 h-2 overflow-hidden rounded-full bg-canvas print:border print:border-line" aria-hidden>
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} />
        </div>
      )}
    </li>
  );
}

function Point({ p, today }: { p: OpenPoint; today: string }) {
  const overdue = today ? isOverdue(p, today) : false;
  const chip = p.status === "closed" ? "bg-mint" : p.status === "doing" ? "bg-sun" : "border border-line-strong bg-white";
  return (
    <li className="report-keep rounded-lg border border-line-strong p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-[1_1_14rem] font-semibold break-words">
          <span className="text-ink-soft tabular-nums">#{p.number}</span> {p.title}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-ink ${chip}`}>{statusLabel(p.status)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft break-words">
        Assigned to: <span className="font-semibold text-ink">{p.assignee ?? "nobody yet"}</span>
        {p.due ? ` · Due ${day(p.due)}${overdue ? " (overdue)" : ""}` : ""}
        {p.raisedBy ? ` · Raised by ${p.raisedBy}` : p.source === "audience" ? " · Raised from a phone" : ""}
        {p.question ? ` · ${p.question}` : ""}
      </p>
      {p.note && <p className="mt-1.5 rounded bg-canvas px-2 py-1 text-sm break-words print:border print:border-line">{p.note}</p>}
    </li>
  );
}
