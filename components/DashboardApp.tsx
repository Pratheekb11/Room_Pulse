"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useClientValue } from "./useClientValue";
import { indexCells, topicHistograms } from "@/lib/stats";
import { defaultSort, isItemSort, ITEM_SORTS, rateItems, sortItems, type ItemSort } from "@/lib/rank-items";
import { voterUrl } from "@/lib/site";
import { readDashboardKey } from "@/lib/dashboard-key";
import type { ResultsPayload, SessionPayload } from "@/lib/types";
import { Breakdown } from "./Breakdown";
import { ExecSummary } from "./ExecSummary";
import { FocusOverview } from "./FocusOverview";
import { ResultsHeatmap } from "./ResultsHeatmap";
import { heatRows } from "@/lib/heat";
import { TopicDistribution } from "./TopicDistribution";
import { resultGroups } from "@/lib/focus";
import { numberStats, pollTally, rankTally, wordWeights } from "@/lib/answers";
import { RankList, RankPlaces } from "./results/RankResults";
import { NumberHistogram, NumberSummary } from "./results/NumberResults";
import { TextAnswers } from "./results/TextResults";
import { AiInsights } from "./results/AiInsights";
import { QaList } from "./results/QaResults";
import { Leaderboard, QuizStage } from "./results/QuizResults";
import { PollBars, PollColumns, PollPie } from "./PollResults";
import { WordCloud, WordList } from "./WordCloud";
import { CHARTS, isChartFor } from "@/lib/charts";
import { ScoreLegend } from "./Donut";
import { Heatmap } from "./Heatmap";
import { QuestionDescription, QuestionTabs, ResultCard, ScreenHeader, VotingPills } from "./ScreenChrome";
import { LiveBadge } from "./LiveBadge";
import { OverallBars, type BarDatum } from "./OverallBars";
import { QrPanel } from "./QrPanel";
import { CenteredMessage, LoadingScreen } from "./StatusScreens";
import { useResultsPoll } from "./useResultsPoll";
import { useSession } from "./useSession";
import { useDocumentTheme } from "./useDocumentTheme";
import { FitToScreen } from "./FitToScreen";
import { OpenPoints, useOpenPoints } from "./results/OpenPoints";
import { readJSON, writeJSON } from "@/lib/storage";

type View = "heatmap" | "ranking" | "breakdown" | "summary";

const VIEWS: { id: View; label: string; key: string }[] = [
  { id: "heatmap", label: "Colour grid", key: "1" },
  { id: "ranking", label: "Ranking", key: "2" },
  { id: "breakdown", label: "Score spread", key: "3" },
  { id: "summary", label: "Summary", key: "4" },
];

/** The presenter's results screen; with `audience`, the read-only copy on voters' phones. */
export function DashboardApp({ code, audience = false }: { code: string; audience?: boolean }) {
  // undefined until the browser has read the link's #k=… part
  const key = useClientValue(() => readDashboardKey(code));
  const poll = useResultsPoll(code, audience ? null : (key ?? null), audience || key !== undefined, audience);
  // Reload the questions whenever the presenter edits them.
  const session = useSession(code, poll.data?.revision);
  useDocumentTheme(session.kind === "ready" ? session.data.session.theme : undefined);

  if (session.kind === "not_found")
    return <CenteredMessage title="Presentation not found" body={`There's no presentation with the code “${code}”. It may have been deleted.`} />;
  if (poll.notFound && audience)
    return (
      <CenteredMessage
        title="Results aren't shared right now"
        body="The presenter shows results on the big screen. If they share them with phones, they'll appear here."
      />
    );
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
  return <Stage code={code} info={session.data} results={poll.data} lastOkAt={poll.lastOkAt} flash={poll.flash} audience={audience} />;
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
  questions: [],
  quizCounts: [],
  quizRevealed: [],
  leaderboard: [],
  quiz: null,
  revision: 0,
};

function Stage({
  code,
  info,
  results,
  lastOkAt,
  flash,
  audience,
}: {
  code: string;
  info: SessionPayload;
  results: ResultsPayload | null;
  lastOkAt: number | null;
  flash: Record<string, number>;
  /** Voters' phones: no QR, no owner controls, no quiz. */
  audience: boolean;
}) {
  const { session, topics, criteria } = info;
  // Fill in fields an older server version may not send.
  const r: ResultsPayload = { ...EMPTY, isOpen: session.isOpen, ...(results ?? {}) };
  const groups = useMemo(
    () => resultGroups(info.focusTopics ?? [], topics, audience),
    [info.focusTopics, topics, audience],
  );
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
  // Id of the item shown full screen, or null. An id, so live re-sorting never swaps it.
  const [detail, setDetail] = useState<string | null>(null);
  // Score items: the order picked in "Sort" (null = the view's own default), kept in the URL.
  const [pickedSort, setPickedSort] = useState<ItemSort | null>(() => {
    const v = new URLSearchParams(window.location.search).get("sort");
    return isItemSort(v) ? v : null;
  });
  const [showQr, setShowQr] = useState(() => !audience && window.matchMedia("(min-width: 1024px)").matches);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Fit to screen: shrink a question's results so all of them show at once. Remembered on this device.
  const [fit, setFit] = useState(() => !audience && readJSON<boolean>("liverate:fit", false) === true);
  const toggleFit = useCallback(() => {
    setFit((on) => {
      writeJSON("liverate:fit", !on);
      return !on;
    });
  }, []);
  const joinUrl = useClientValue(() => voterUrl(code));
  // Voters on the audience page are never the owner: don't ask (it would cost a request and log a 401).
  const signedInOwner = useIsOwner(code, !audience);
  const isOwner = signedInOwner && !audience;
  const aiOn = useAiOn(code, isOwner);

  const cells = useMemo(() => indexCells(r.cells), [r.cells]);
  const histograms = useMemo(() => topicHistograms(r.dist, session.scaleMax), [r.dist, session.scaleMax]);

  // "All questions": cards, or every question's results as one heatmap.
  const [overviewMode, setOverviewMode] = useState<"cards" | "heatmap">(() =>
    !new URLSearchParams(window.location.search).get("focus") && urlView === "heatmap" ? "heatmap" : "cards",
  );
  // The presenter's open point list, shown in place of the results (kept in the URL as ?points=1).
  const [pointsOpen, setPointsOpen] = useState(() => !audience && new URLSearchParams(window.location.search).get("points") === "1");
  const pointsState = useOpenPoints(code, isOwner, { groups, criteria, cells, histograms, results: r, scaleMax: session.scaleMax });
  const showPoints = pointsOpen && isOwner;
  const group = focusIndex === null ? null : (groups[focusIndex] ?? null);
  const view = group
    ? (viewByFocus[group.focus.id] ?? (urlView && isChartFor(group.kind, urlView) ? urlView : group.chart))
    : overviewMode === "heatmap"
      ? "heatmap"
      : "";
  // Keep the place in the URL so a refresh comes back to the same focus topic and chart.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (focusIndex === null || single) params.delete("focus");
    else params.set("focus", String(focusIndex + 1));
    if (view) params.set("view", view);
    else params.delete("view");
    if (pickedSort) params.set("sort", pickedSort);
    else params.delete("sort");
    if (pointsOpen) params.set("points", "1");
    else params.delete("points");
    const qs = params.toString();
    // keep the #k=… part: it's what lets this screen read the results
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [focusIndex, view, single, pickedSort, pointsOpen]);

  const groupId = group?.focus.id;
  const groupKind = group?.kind;
  const setView = useCallback(
    (v: string) => {
      if (groupId !== undefined) setViewByFocus((m) => ({ ...m, [groupId]: v }));
    },
    [groupId],
  );
  const focusTopics = useMemo(() => group?.topics ?? [], [group]);

  const rated = useMemo(
    () => rateItems(focusTopics, criteria, cells, histograms, session.scaleMax),
    [focusTopics, criteria, cells, histograms, session.scaleMax],
  );
  const sort = pickedSort ?? defaultSort(view);
  const sortedRows = useMemo(() => sortItems(rated, sort), [rated, sort]);
  const sortedBars: BarDatum[] = sortedRows.map((r) => ({
    id: r.item.id,
    name: r.item.name,
    description: r.item.description,
    imageId: r.item.imageId,
    value: r.value,
    n: r.n,
    index: r.index,
    rank: r.rank,
  }));
  const sortedTopics = sortedRows.map((r) => r.item);
  // Score spread opens an item by its place in this list.
  const sortedFocusTopics = sortedRows.map((r) => ({ item: r.item, index: r.index }));
  const detailIndex = detail === null ? -1 : sortedFocusTopics.findIndex((t) => t.item.id === detail);

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

  // Presenter shortcuts: 1–5 switch views, ←/→ move between focus topics, Esc = overview, Q = QR, F = fit to screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      const v = VIEWS.find((x) => x.key === e.key);
      if (v && groupKind === "rating") setView(v.id);
      else if (!audience && e.key.toLowerCase() === "q") setShowQr((s) => !s);
      else if (!audience && e.key.toLowerCase() === "f") toggleFit();
      else if (!single && e.key === "Escape") setFocusIndex(null);
      else if (!single && e.key === "ArrowRight") setFocusIndex((i) => (i === null ? 0 : Math.min(groups.length - 1, i + 1)));
      else if (!single && e.key === "ArrowLeft") setFocusIndex((i) => (i === null || i === 0 ? null : i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [single, groups.length, setView, groupKind, audience, toggleFit]);

  const voters = r.voterCount;
  /** People who answered one question. */
  const peopleIn = (focusId: string) => r.respondents.find((x) => x.focusId === focusId)?.n ?? 0;

  return (
    <div className="flex min-h-dvh flex-col gap-[clamp(0.75rem,1.6vh,1.5rem)] px-[clamp(1rem,2.2vw,2.75rem)] py-[clamp(0.75rem,2vh,1.75rem)]">
      <ScreenHeader
        title={session.title}
        theme={session.theme}
        decor={session.decor}
        status={
          <>
            <LiveBadge lastOkAt={lastOkAt} />
            <VotingPills voters={voters} isOpen={r.isOpen} />
          </>
        }
        controls={
          <>
            {!group && groups.length > 1 && (
              <div role="tablist" aria-label="Show all questions as" className="flex rounded-full border border-line-strong bg-white p-0.5">
                {(
                  [
                    ["cards", "Cards"],
                    ["heatmap", "Heatmap"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={overviewMode === id}
                    onClick={() => setOverviewMode(id)}
                    className={`shrink-0 rounded-full px-3 py-1 whitespace-nowrap ${overviewMode === id ? "bg-ink text-white" : "hover:bg-canvas"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {group && CHARTS[group.kind].length > 1 && (
              <div role="tablist" aria-label="Chart" className="flex max-w-full flex-wrap gap-0.5 rounded-[1.1rem] border border-line-strong bg-white p-0.5">
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
            {group?.kind === "rating" && group.topics.length > 1 && (
              <label className="flex items-center gap-1.5 rounded-full border border-line-strong bg-white py-0.5 pl-3 pr-1">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setPickedSort(e.target.value as ItemSort)}
                  className="rounded-full bg-transparent px-1 py-0.5 font-semibold"
                >
                  {ITEM_SORTS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {audience ? (
              <a href={`/s/${encodeURIComponent(code)}`} className="rounded-full border border-line-strong bg-white px-3 py-1 hover:bg-canvas">
                Back to answering
              </a>
            ) : (
              <button
                type="button"
                aria-pressed={showQr}
                title="Shortcut: Q"
                onClick={() => setShowQr((s) => !s)}
                className={`rounded-full border border-line-strong px-3 py-1 ${showQr ? "bg-sun" : "bg-white"}`}
              >
                {showQr ? "Hide QR" : "Show QR"}
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                aria-pressed={showPoints}
                onClick={() => setPointsOpen((on) => !on)}
                title={pointsState.signals.length ? "The results suggest follow-ups" : "Things to follow up after this session"}
                className={`rounded-full border border-line-strong px-3 py-1 tabular-nums ${showPoints ? "bg-sun" : "bg-white hover:bg-canvas"}`}
              >
                Open points{(r.openPoints ?? 0) > 0 ? ` · ${r.openPoints}` : ""}
                {pointsState.signals.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-white" aria-label={`${pointsState.signals.length} suggested`}>
                    +{pointsState.signals.length}
                  </span>
                )}
              </button>
            )}
            {!audience && (
              <button
                type="button"
                aria-pressed={fit}
                title="Shrink the results so they all show at once, without scrolling. Shortcut: F"
                onClick={toggleFit}
                className={`rounded-full border border-line-strong px-3 py-1 ${fit ? "bg-sun" : "bg-white hover:bg-canvas"}`}
              >
                Fit to screen
              </button>
            )}
            <button type="button" onClick={toggleFullscreen} className="hidden rounded-full border border-line-strong bg-white px-3 py-1 sm:inline-block">
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
            {isOwner && (
              <a href={`/admin/edit/${code}?back=results`} className="rounded-full border border-line-strong bg-white px-3 py-1 hover:bg-canvas">
                Edit questions
              </a>
            )}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-[clamp(0.75rem,1.6vw,2rem)] lg:flex-row">
        <main className="min-w-0 flex-1">
          {showPoints && <OpenPoints code={code} state={pointsState} groups={groups} onClose={() => setPointsOpen(false)} />}
          <div className={showPoints ? "hidden" : undefined}>
          {!single && (
            <QuestionTabs names={groups.map((g) => ({ key: g.focus.id || "loose", name: g.focus.name }))} active={focusIndex} onPick={setFocusIndex} />
          )}

          <FitToScreen on={fit && !showPoints}>
          <div key={`${focusIndex ?? "all"}:${view}`} className="animate-rise">
          <QuestionDescription text={group?.focus.description} image={group?.focus.imageId} question={group?.focus.name} />
          {groups.length === 0 ? (
            <p className="text-xl text-ink-soft">This presentation has no questions yet. Use “Edit questions” to add some.</p>
          ) : !group && overviewMode === "heatmap" ? (
            (() => {
              const heat = heatRows(groups, criteria, cells, r, session.scaleMax);
              return <ResultsHeatmap rows={heat.rows} skipped={heat.skipped} scaleMax={session.scaleMax} onOpen={setFocusIndex} />;
            })()
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
          ) : group.kind === "quiz" ? (
            view === "leaderboard" ? (
              <ResultCard title="Leaderboard">
                <Leaderboard rows={r.leaderboard} />
              </ResultCard>
            ) : (
              (() => {
                const quizzes = groups.map((g, i) => ({ g, i })).filter((x) => x.g.kind === "quiz");
                const after = quizzes.find((x) => focusIndex !== null && x.i > focusIndex);
                return (
                  <QuizStage
                    code={code}
                    focusId={group.focus.id}
                    question={group.focus.name}
                    options={group.topics.map((t) => t.item)}
                    seconds={group.seconds ?? 20}
                    live={r.quiz}
                    receivedAt={lastOkAt}
                    counts={r.quizCounts}
                    revealed={r.quizRevealed.find((x) => x.focusId === group.focus.id)?.topicId ?? null}
                    owner={isOwner}
                    next={after ? { focusId: after.g.focus.id, name: after.g.focus.name } : null}
                    onShowLeaderboard={() => setView("leaderboard")}
                    onNext={(id) => {
                      const i = groups.findIndex((g) => g.focus.id === id);
                      if (i !== -1) setFocusIndex(i);
                    }}
                  />
                );
              })()
            )
          ) : group.kind === "qa" ? (
            <ResultCard title={group.focus.name}>
              {aiOn && <AiInsights code={code} focusId={group.focus.id} kind="qa" questions={r.questions.filter((q) => q.focusId === group.focus.id)} />}
              <QaList code={code} items={r.questions} focusId={group.focus.id} mode={view === "new" ? "new" : "top"} owner={isOwner} />
            </ResultCard>
          ) : group.kind === "text" ? (
            <ResultCard title={group.focus.name}>
              {aiOn && <AiInsights code={code} focusId={group.focus.id} kind="text" />}
              <TextAnswers code={code} answers={r.texts} focusId={group.focus.id} view={view === "spotlight" ? "spotlight" : "wall"} owner={isOwner} />
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
                {sort === "bottom" ? "Bottom rated in" : sort === "top" ? "Top rated in" : "Ranking for"} {group.focus.name}
              </h2>
              <OverallBars data={sortedBars} scaleMax={session.scaleMax} size="large" ranked />
            </section>
          ) : view === "breakdown" ? (
            <div className="flex flex-col gap-3">
              <Breakdown
                topics={sortedFocusTopics}
                criteria={criteria}
                cells={cells}
                histograms={histograms}
                scaleMax={session.scaleMax}
                onOpen={(i) => setDetail(sortedFocusTopics[i]?.item.id ?? null)}
              />
              <ScoreLegend scaleMax={session.scaleMax} lowLabel={session.lowLabel} highLabel={session.highLabel} />
            </div>
          ) : (
            <ExecSummary
              rows={rated}
              sort={sort}
              criteria={criteria}
              cells={cells}
              scaleMax={session.scaleMax}
              voterCount={peopleIn(group.focus.id)}
            />
          )}
          </div>
          </FitToScreen>
          {voters === 0 && (
            <p className="mt-4 text-center text-[clamp(1rem,1.4vw,1.5rem)] font-semibold text-ink-soft">
              No answers yet. Ask people to scan the QR code.
            </p>
          )}
          </div>
        </main>

        {showQr && joinUrl && (
          <div className="mx-auto w-full max-w-sm shrink-0 lg:mx-0 lg:w-[clamp(15rem,22vw,22rem)] lg:max-w-none">
            <QrPanel url={joinUrl} code={code} />
          </div>
        )}
      </div>

      {group?.kind === "rating" && detailIndex !== -1 && (
        <TopicDistribution
          topics={sortedFocusTopics}
          current={detailIndex}
          criteria={criteria}
          cells={cells}
          dist={r.dist}
          scaleMax={session.scaleMax}
          lowLabel={session.lowLabel}
          highLabel={session.highLabel}
          onMove={(i) => setDetail(sortedFocusTopics[i]?.item.id ?? null)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

/** True when the signed-in account owns this presentation (it can open the edit form). */
/** Owner only: AI insights are switched on for this presentation and the site has a Gemini key. */
function useAiOn(code: string, isOwner: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    fetch(`/api/admin/sessions/${encodeURIComponent(code)}/ai`, { cache: "no-store", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { enabled?: boolean; available?: boolean } | null) => {
        if (!cancelled) setOn(Boolean(body?.enabled && body.available));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, isOwner]);
  return isOwner && on;
}

function useIsOwner(code: string, ask: boolean): boolean {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    if (!ask) return;
    let cancelled = false;
    fetch(`/api/admin/sessions/${encodeURIComponent(code)}`, { cache: "no-store", credentials: "same-origin" })
      .then((res) => {
        if (!cancelled) setOwner(res.ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, ask]);
  return ask && owner;
}
