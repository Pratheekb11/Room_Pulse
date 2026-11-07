"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useClientValue } from "./useClientValue";
import { CountUp } from "./CountUp";
import { avg, cellKey, indexCells, sumAggs, topicHistograms } from "@/lib/stats";
import { voterUrl } from "@/lib/site";
import { readDashboardKey } from "@/lib/dashboard-key";
import type { ResultsPayload, SessionPayload } from "@/lib/types";
import { Breakdown } from "./Breakdown";
import { ExecSummary } from "./ExecSummary";
import { FocusOverview } from "./FocusOverview";
import { TopicDistribution } from "./TopicDistribution";
import { groupByFocus } from "@/lib/focus";
import { numberStats, pollTally, rankTally, wordWeights } from "@/lib/answers";
import { RankList, RankPlaces } from "./results/RankResults";
import { NumberHistogram, NumberSummary } from "./results/NumberResults";
import { TextSpotlight, TextWall } from "./results/TextResults";
import { PollBars, PollColumns, PollPie } from "./PollResults";
import { WordCloud, WordList } from "./WordCloud";
import { CHARTS, isChartFor } from "@/lib/charts";
import { ScoreLegend } from "./Donut";
import { Heatmap } from "./Heatmap";
import { LiveBadge } from "./LiveBadge";
import { Logo } from "./Logo";
import { OverallBars, type BarDatum } from "./OverallBars";
import { QrPanel } from "./QrPanel";
import { CenteredMessage, LoadingScreen } from "./StatusScreens";
import { useResultsPoll } from "./useResultsPoll";
import { useSession } from "./useSession";

type View = "heatmap" | "ranking" | "breakdown" | "summary";
type Sort = "order" | "overall";

const VIEWS: { id: View; label: string; key: string }[] = [
  { id: "heatmap", label: "Colour grid", key: "1" },
  { id: "ranking", label: "Ranking", key: "2" },
  { id: "breakdown", label: "Score spread", key: "3" },
  { id: "summary", label: "Summary", key: "4" },
];

export function DashboardApp({ code }: { code: string }) {
  // undefined until the browser has read the link's #k=… part
  const key = useClientValue(() => readDashboardKey(code));
  const poll = useResultsPoll(code, key ?? null, key !== undefined);
  // Reload the questions whenever the presenter edits them.
  const session = useSession(code, poll.data?.revision);

  if (session.kind === "not_found")
    return <CenteredMessage title="Presentation not found" body={`There's no presentation with the code “${code}”. It may have been deleted.`} />;
  if (poll.notFound)
    return (
      <CenteredMessage
        title="These results are private"
        body="Open the results screen from your presentations, or use the private results link you copied there. The audience link doesn't show results."
      />
    );
  if (session.kind === "error")
    return <CenteredMessage title="No connection" body="Check your internet. We'll keep trying on our own." link={false} />;
  if (session.kind === "loading") return <LoadingScreen label="Loading results" />;
  return <Stage code={code} info={session.data} results={poll.data} lastOkAt={poll.lastOkAt} flash={poll.flash} />;
}

const EMPTY: ResultsPayload = {
  isOpen: true,
  voterCount: 0,
  cells: [],
  dist: [],
  polls: [],
  words: [],
  ranks: [],
  numbers: [],
  texts: [],
  respondents: [],
  revision: 0,
};

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
  // Fill in fields an older server version may not send.
  const r: ResultsPayload = { ...EMPTY, isOpen: session.isOpen, ...(results ?? {}) };
  const groups = useMemo(() => groupByFocus(info.focusTopics ?? [], topics), [info.focusTopics, topics]);
  const single = groups.length <= 1;

  // Stage only renders in the browser (after the session loads), so reading the URL here is safe.
  const [urlView] = useState(() => new URLSearchParams(window.location.search).get("view"));
  // Chart picked on the dashboard per focus topic; otherwise the one chosen when building it.
  const [viewByFocus, setViewByFocus] = useState<Record<string, string>>({});
  // null = overview of all focus topics
  const [focusIndex, setFocusIndex] = useState<number | null>(() => {
    const f = Number(new URLSearchParams(window.location.search).get("focus"));
    return single ? 0 : Number.isInteger(f) && f >= 1 && f <= groups.length ? f - 1 : null;
  });
  // Index (within the open focus topic) of the topic shown full screen, or null.
  const [detail, setDetail] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>("order");
  const [showQr, setShowQr] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const joinUrl = useClientValue(() => voterUrl(code));
  const isOwner = useIsOwner(code);

  const cells = useMemo(() => indexCells(r.cells), [r.cells]);
  const histograms = useMemo(() => topicHistograms(r.dist, session.scaleMax), [r.dist, session.scaleMax]);

  const group = focusIndex === null ? null : (groups[focusIndex] ?? null);
  const view = group
    ? (viewByFocus[group.focus.id] ?? (urlView && isChartFor(group.kind, urlView) ? urlView : group.chart))
    : "";
  // Keep the place in the URL so a refresh comes back to the same focus topic and chart.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (focusIndex === null || single) params.delete("focus");
    else params.set("focus", String(focusIndex + 1));
    if (view) params.set("view", view);
    else params.delete("view");
    const qs = params.toString();
    // keep the #k=… part: it's what lets this screen read the results
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [focusIndex, view, single]);

  const groupId = group?.focus.id;
  const groupKind = group?.kind;
  const setView = useCallback(
    (v: string) => {
      if (groupId !== undefined) setViewByFocus((m) => ({ ...m, [groupId]: v }));
    },
    [groupId],
  );
  const focusTopics = useMemo(() => group?.topics ?? [], [group]);

  const overall: BarDatum[] = useMemo(
    () =>
      focusTopics.map(({ item: t, index }) => {
        const agg = sumAggs(criteria.map((c) => cells.get(cellKey(t.id, c.id))));
        return { id: t.id, name: t.name, value: avg(agg), n: agg.n, index };
      }),
    [focusTopics, criteria, cells],
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

  // Presenter shortcuts: 1–5 switch views, ←/→ move between focus topics, Esc = overview, Q = QR.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v && groupKind === "rating") setView(v.id);
      else if (e.key.toLowerCase() === "q") setShowQr((s) => !s);
      else if (!single && e.key === "Escape") setFocusIndex(null);
      else if (!single && e.key === "ArrowRight") setFocusIndex((i) => (i === null ? 0 : Math.min(groups.length - 1, i + 1)));
      else if (!single && e.key === "ArrowLeft") setFocusIndex((i) => (i === null || i === 0 ? null : i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [single, groups.length, setView, groupKind]);

  const voters = r.voterCount;

  return (
    <div className="flex min-h-dvh flex-col gap-[clamp(0.75rem,1.6vh,1.5rem)] px-[clamp(1rem,2.2vw,2.75rem)] py-[clamp(0.75rem,2vh,1.75rem)]">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <Logo />
          <h1 className="font-display mt-2 text-[clamp(2rem,3.6vw,4.2rem)] font-semibold leading-[0.98] tracking-tight break-words">
            {session.title}
          </h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-2.5">
            <LiveBadge lastOkAt={lastOkAt} />
            <span className="rounded-full border border-line-strong bg-white px-3 py-1 text-base font-bold tabular-nums sm:px-3.5 sm:text-lg">
              <CountUp value={voters} /> {voters === 1 ? "person" : "people"} voted
            </span>
            <span
              className={`rounded-full border border-line-strong px-3 py-1 text-base font-bold sm:px-3.5 sm:text-lg ${
                r.isOpen ? "bg-mint text-ink" : "bg-ink text-white"
              }`}
            >
              {r.isOpen ? "Voting open" : "Voting closed"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:justify-end">
            {group && CHARTS[group.kind].length > 1 && (
              <div role="tablist" aria-label="Chart" className="flex max-w-full overflow-x-auto rounded-full border border-line-strong bg-white p-0.5">
                {CHARTS[group.kind].map((c, i) => (
                  <button
                    key={c.id}
                    role="tab"
                    type="button"
                    aria-selected={view === c.id}
                    title={group.kind === "rating" ? `Shortcut: ${i + 1}` : undefined}
                    onClick={() => setView(c.id)}
                    className={`shrink-0 rounded-full px-3 py-1 whitespace-nowrap ${view === c.id ? "bg-ink text-white" : "hover:bg-canvas"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {group?.kind === "rating" && view === "heatmap" && (
              <label className="flex items-center gap-1.5 rounded-full border border-line-strong bg-white py-0.5 pl-3 pr-1">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-full bg-transparent px-1 py-0.5 font-semibold"
                >
                  <option value="order">Your order</option>
                  <option value="overall">Highest score first</option>
                </select>
              </label>
            )}
            <button
              type="button"
              aria-pressed={showQr}
              title="Shortcut: Q"
              onClick={() => setShowQr((s) => !s)}
              className={`rounded-full border border-line-strong px-3 py-1 ${showQr ? "bg-sun" : "bg-white"}`}
            >
              {showQr ? "Hide QR" : "Show QR"}
            </button>
            <button type="button" onClick={toggleFullscreen} className="hidden rounded-full border border-line-strong bg-white px-3 py-1 sm:inline-block">
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
            {isOwner && (
              <a href={`/admin/edit/${code}?back=results`} className="rounded-full border border-line-strong bg-white px-3 py-1 hover:bg-canvas">
                Edit questions
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,1.6vw,2rem)] lg:flex-row">
        <main className="min-w-0 flex-1">
          {!single && (
            <nav aria-label="Questions" className="mb-[clamp(0.6rem,1.4vh,1.25rem)] flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFocusIndex(null)}
                aria-current={focusIndex === null ? "page" : undefined}
                className={`rounded-full border border-line-strong px-4 py-1.5 text-[clamp(0.85rem,1vw,1.1rem)] font-bold ${
                  focusIndex === null ? "bg-ink text-white" : "bg-white"
                }`}
              >
                All questions
              </button>
              {groups.map((g, i) => (
                <button
                  key={g.focus.id || "loose"}
                  type="button"
                  onClick={() => setFocusIndex(i)}
                  aria-current={focusIndex === i ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 text-[clamp(0.85rem,1vw,1.1rem)] font-bold ${
                    focusIndex === i ? "bg-ink text-white" : "bg-white"
                  }`}
                >
                  {g.focus.name}
                </button>
              ))}
            </nav>
          )}

          <div key={`${focusIndex ?? "all"}:${view}`} className="animate-rise">
          {groups.length === 0 ? (
            <p className="text-xl text-ink-soft">This presentation has no questions yet. Use “Edit questions” to add some.</p>
          ) : !group ? (
            <FocusOverview
              groups={groups}
              criteria={criteria}
              cells={cells}
              scaleMax={session.scaleMax}
              results={r}
              onOpen={setFocusIndex}
            />
          ) : group.kind === "poll" ? (
            <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
              <h2 className="font-display mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-tight">
                {group.focus.name}
              </h2>
              {(() => {
                const tally = pollTally(group.topics.map((t) => t.item), r.polls ?? [], group.focus.id);
                if (view === "columns") return <PollColumns tally={tally} />;
                if (view === "pie") return <PollPie tally={tally} hole={false} />;
                if (view === "donut") return <PollPie tally={tally} />;
                return <PollBars tally={tally} />;
              })()}
            </section>
          ) : group.kind === "multi" ? (
            <ResultCard title={group.focus.name}>
              {(() => {
                const people = r.respondents.find((x) => x.focusId === group.focus.id)?.n ?? 0;
                const tally = pollTally(group.topics.map((t) => t.item), r.polls, group.focus.id, people);
                const noun: [string, string] = ["person", "people"];
                return (
                  <>
                    <p className="-mt-2 mb-4 text-[clamp(0.95rem,1.2vw,1.35rem)] font-semibold text-ink-soft">
                      Share of the {people} {people === 1 ? "person" : "people"} who answered
                      {group.maxPicks ? ` (each could pick up to ${group.maxPicks})` : ""}
                    </p>
                    {view === "columns" ? <PollColumns tally={tally} noun={noun} /> : <PollBars tally={tally} noun={noun} />}
                  </>
                );
              })()}
            </ResultCard>
          ) : group.kind === "rank" ? (
            <ResultCard title={group.focus.name}>
              {(() => {
                const tally = rankTally(group.topics.map((t) => t.item), r.ranks, group.focus.id);
                return (
                  <>
                    <p className="-mt-2 mb-4 text-[clamp(0.95rem,1.2vw,1.35rem)] font-semibold text-ink-soft">
                      {tally.people} {tally.people === 1 ? "person" : "people"} put these in order
                    </p>
                    {view === "places" ? <RankPlaces tally={tally} /> : <RankList tally={tally} />}
                  </>
                );
              })()}
            </ResultCard>
          ) : group.kind === "number" ? (
            <ResultCard title={group.focus.name}>
              {(() => {
                const min = group.min ?? 0;
                const max = group.max ?? 100;
                const stats = numberStats(r.numbers, group.focus.id, min, max);
                return view === "summary" ? (
                  <NumberSummary stats={stats} unit={group.unit} />
                ) : (
                  <NumberHistogram stats={stats} min={min} max={max} unit={group.unit} />
                );
              })()}
            </ResultCard>
          ) : group.kind === "text" ? (
            <ResultCard title={group.focus.name}>
              {(() => {
                const answers = r.texts.filter((t) => t.focusId === group.focus.id);
                return view === "spotlight" ? <TextSpotlight answers={answers} /> : <TextWall answers={answers} />;
              })()}
            </ResultCard>
          ) : group.kind === "words" ? (
            <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
              <h2 className="font-display text-center text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-tight">{group.focus.name}</h2>
              {view === "list" ? (
                <WordList words={wordWeights(r.words ?? [], group.focus.id)} />
              ) : (
                <WordCloud words={wordWeights(r.words ?? [], group.focus.id)} />
              )}
            </section>
          ) : view === "heatmap" ? (
            <div className="flex flex-col gap-[clamp(0.75rem,2vh,1.75rem)]">
              <section className="slab rounded-xl bg-white p-[clamp(0.75rem,1.3vw,1.5rem)]">
                <Heatmap
                  topics={sortedTopics}
                  criteria={criteria}
                  cells={cells}
                  scaleMax={session.scaleMax}
                  flash={flash}
                />
              </section>
              <section className="slab rounded-xl bg-white p-[clamp(0.75rem,1.3vw,1.5rem)]">
                <h2 className="font-display mb-3 text-[clamp(1.1rem,1.5vw,1.7rem)] font-semibold">Average score per item</h2>
                <OverallBars data={sortedBars} scaleMax={session.scaleMax} />
              </section>
            </div>
          ) : view === "ranking" ? (
            <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
              <h2 className="font-display mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.4rem,2.2vw,2.5rem)] font-semibold">
                Top rated in {group.focus.name}
              </h2>
              <OverallBars data={byOverall} scaleMax={session.scaleMax} size="large" ranked />
            </section>
          ) : view === "breakdown" ? (
            <div className="flex flex-col gap-3">
              <Breakdown
                topics={focusTopics}
                criteria={criteria}
                cells={cells}
                histograms={histograms}
                scaleMax={session.scaleMax}
                onOpen={setDetail}
              />
              <ScoreLegend scaleMax={session.scaleMax} lowLabel={session.lowLabel} highLabel={session.highLabel} />
            </div>
          ) : (
            <ExecSummary
              topics={focusTopics}
              criteria={criteria}
              cells={cells}
              histograms={histograms}
              scaleMax={session.scaleMax}
              voterCount={voters}
            />
          )}
          </div>
          {voters === 0 && (
            <p className="mt-4 text-center text-[clamp(1rem,1.4vw,1.5rem)] font-semibold text-ink-soft">
              No answers yet. Ask people to scan the QR code.
            </p>
          )}
        </main>

        {showQr && joinUrl && (
          <div className="mx-auto w-full max-w-sm shrink-0 lg:mx-0 lg:w-[clamp(15rem,22vw,22rem)] lg:max-w-none">
            <QrPanel url={joinUrl} code={code} />
          </div>
        )}
      </div>

      {group?.kind === "rating" && detail !== null && focusTopics[detail] && (
        <TopicDistribution
          topics={focusTopics}
          current={detail}
          criteria={criteria}
          cells={cells}
          dist={r.dist}
          scaleMax={session.scaleMax}
          lowLabel={session.lowLabel}
          highLabel={session.highLabel}
          onMove={setDetail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="slab rounded-xl bg-white p-[clamp(1rem,2vw,2.25rem)]">
      <h2 className="font-display mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.6rem,2.6vw,3rem)] font-semibold leading-tight break-words">{title}</h2>
      {children}
    </section>
  );
}

/** True when the signed-in account owns this presentation (it can open the edit form). */
function useIsOwner(code: string): boolean {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/sessions/${encodeURIComponent(code)}`, { cache: "no-store", credentials: "same-origin" })
      .then((res) => {
        if (!cancelled) setOwner(res.ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);
  return owner;
}
