"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useClientValue } from "./useClientValue";
import { avg, cellKey, indexCells, sumAggs, topicHistograms } from "@/lib/stats";
import { voterUrl } from "@/lib/site";
import type { ResultsPayload, SessionPayload } from "@/lib/types";
import { Breakdown } from "./Breakdown";
import { ScoreLegend } from "./Donut";
import { Heatmap } from "./Heatmap";
import { LiveBadge } from "./LiveBadge";
import { Logo } from "./Logo";
import { OverallBars, type BarDatum } from "./OverallBars";
import { QrPanel } from "./QrPanel";
import { CenteredMessage, LoadingScreen } from "./StatusScreens";
import { useResultsPoll } from "./useResultsPoll";
import { useSession } from "./useSession";

type View = "heatmap" | "ranking" | "breakdown";
type Sort = "order" | "overall";

const VIEWS: { id: View; label: string; key: string }[] = [
  { id: "heatmap", label: "Heatmap", key: "1" },
  { id: "ranking", label: "Ranking", key: "2" },
  { id: "breakdown", label: "Breakdown", key: "3" },
];

export function DashboardApp({ code }: { code: string }) {
  const session = useSession(code);
  const poll = useResultsPoll(code);

  if (session.kind === "not_found" || poll.notFound)
    return <CenteredMessage title="Session not found" body={`There's no session with the code “${code}”.`} />;
  if (session.kind === "error")
    return <CenteredMessage title="Can't reach the server" body="Trying again automatically…" link={false} />;
  if (session.kind === "loading") return <LoadingScreen label="Loading dashboard" />;
  return <Stage code={code} info={session.data} results={poll.data} lastOkAt={poll.lastOkAt} flash={poll.flash} />;
}

const EMPTY: ResultsPayload = { isOpen: true, voterCount: 0, cells: [], dist: [] };

function Stage({
  code,
  info,
  results,
  lastOkAt,
  flash,
}: {
  code: string;
  info: SessionPayload;
  results: ResultsPayload | null;
  lastOkAt: number | null;
  flash: Record<string, number>;
}) {
  const { session, topics, criteria } = info;
  const r = results ?? { ...EMPTY, isOpen: session.isOpen };
  // Stage only renders in the browser (after the session loads), so reading the URL here is safe.
  const [view, setView] = useState<View>(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    return VIEWS.some((x) => x.id === v) ? (v as View) : "heatmap";
  });
  const [sort, setSort] = useState<Sort>("order");
  const [showQr, setShowQr] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const joinUrl = useClientValue(() => voterUrl(code));

  const cells = useMemo(() => indexCells(r.cells), [r.cells]);
  const histograms = useMemo(() => topicHistograms(r.dist, session.scaleMax), [r.dist, session.scaleMax]);

  const overall: BarDatum[] = useMemo(
    () =>
      topics.map((t, index) => {
        const agg = sumAggs(criteria.map((c) => cells.get(cellKey(t.id, c.id))));
        return { id: t.id, name: t.name, value: avg(agg), n: agg.n, index };
      }),
    [topics, criteria, cells],
  );

  const byOverall = useMemo(
    () => [...overall].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.index - b.index),
    [overall],
  );
  const sortedBars = sort === "overall" ? byOverall : overall;
  const sortedTopics = sortedBars.map((d) => topics[d.index]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* fullscreen refused (iframe, browser policy): ignore */
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Presenter shortcuts: 1/2/3 switch views, Q toggles the QR code.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v) setView(v.id);
      else if (e.key.toLowerCase() === "q") setShowQr((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const voters = r.voterCount;

  return (
    <div className="flex min-h-dvh flex-col gap-[clamp(0.75rem,1.6vh,1.5rem)] px-[clamp(1rem,2.2vw,2.75rem)] py-[clamp(0.75rem,2vh,1.75rem)]">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <Logo />
          <h1 className="font-display mt-2 text-[clamp(2rem,3.6vw,4.2rem)] font-extrabold leading-[0.98] tracking-tight break-words">
            {session.title}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <LiveBadge lastOkAt={lastOkAt} />
            <span className="rounded-full border-2 border-ink bg-white px-3.5 py-1 text-lg font-bold tabular-nums">
              {voters} {voters === 1 ? "person" : "people"} voted
            </span>
            <span
              className={`rounded-full border-2 border-ink px-3.5 py-1 text-lg font-bold ${
                r.isOpen ? "bg-mint text-ink" : "bg-ink text-white"
              }`}
            >
              {r.isOpen ? "Open" : "Closed"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm font-semibold">
            <div role="tablist" aria-label="Chart" className="flex rounded-full border-2 border-ink bg-white p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  type="button"
                  aria-selected={view === v.id}
                  title={`Shortcut: ${v.key}`}
                  onClick={() => setView(v.id)}
                  className={`rounded-full px-3 py-1 ${view === v.id ? "bg-ink text-white" : "hover:bg-canvas"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {view === "heatmap" && (
              <label className="flex items-center gap-1.5 rounded-full border-2 border-ink bg-white py-0.5 pl-3 pr-1">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-full bg-transparent px-1 py-0.5 font-semibold"
                >
                  <option value="order">Topic order</option>
                  <option value="overall">Overall (high → low)</option>
                </select>
              </label>
            )}
            <button
              type="button"
              aria-pressed={showQr}
              title="Shortcut: Q"
              onClick={() => setShowQr((s) => !s)}
              className={`rounded-full border-2 border-ink px-3 py-1 ${showQr ? "bg-sun" : "bg-white"}`}
            >
              {showQr ? "Hide QR" : "Show QR"}
            </button>
            <button type="button" onClick={toggleFullscreen} className="rounded-full border-2 border-ink bg-white px-3 py-1">
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-[clamp(0.75rem,1.6vw,2rem)]">
        <main className="min-w-0 flex-1">
          {topics.length === 0 || criteria.length === 0 ? (
            <p className="text-xl text-ink-soft">This session has no topics or criteria.</p>
          ) : view === "heatmap" ? (
            <div className="flex flex-col gap-[clamp(0.75rem,2vh,1.75rem)]">
              <section className="slab rounded-[28px] bg-white p-[clamp(0.75rem,1.3vw,1.5rem)]">
                <Heatmap
                  topics={sortedTopics}
                  criteria={criteria}
                  cells={cells}
                  scaleMax={session.scaleMax}
                  flash={flash}
                />
              </section>
              <section className="slab rounded-[28px] bg-white p-[clamp(0.75rem,1.3vw,1.5rem)]">
                <h2 className="font-display mb-3 text-[clamp(1.1rem,1.5vw,1.7rem)] font-extrabold">Overall by topic</h2>
                <OverallBars data={sortedBars} scaleMax={session.scaleMax} />
              </section>
            </div>
          ) : view === "ranking" ? (
            <section className="slab rounded-[28px] bg-white p-[clamp(1rem,2vw,2.25rem)]">
              <h2 className="font-display mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.4rem,2.2vw,2.5rem)] font-extrabold">
                Top rated topics
              </h2>
              <OverallBars data={byOverall} scaleMax={session.scaleMax} size="large" ranked />
            </section>
          ) : (
            <div className="flex flex-col gap-3">
              <Breakdown
                topics={topics.map((item, index) => ({ item, index }))}
                criteria={criteria}
                cells={cells}
                histograms={histograms}
                scaleMax={session.scaleMax}
              />
              <ScoreLegend scaleMax={session.scaleMax} lowLabel={session.lowLabel} highLabel={session.highLabel} />
            </div>
          )}
          {voters === 0 && (
            <p className="mt-4 text-center text-[clamp(1rem,1.4vw,1.5rem)] font-semibold text-ink-soft">
              Waiting for the first rating. Scan the QR code to start.
            </p>
          )}
        </main>

        {showQr && joinUrl && (
          <div className="w-[clamp(15rem,22vw,22rem)] shrink-0">
            <QrPanel url={joinUrl} code={code} />
          </div>
        )}
      </div>
    </div>
  );
}
