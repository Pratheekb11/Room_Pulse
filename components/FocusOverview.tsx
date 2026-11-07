import { scaleColor, topicColor, topicInk } from "@/lib/colors";
import { summarizeFocus, type FocusGroup } from "@/lib/focus";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "@/lib/stats";
import { formatNumber, numberStats, pollTally, qaOrder, rankTally, wordWeights } from "@/lib/answers";
import { kindLabel } from "@/lib/kinds";
import type { NamedItem, ResultsPayload } from "@/lib/types";

interface Props {
  groups: FocusGroup[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  scaleMax: number;
  results: ResultsPayload;
  onOpen: (index: number) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Bars for the top 3 of a list (poll, pick several, ranking). */
function TopBars({ rows }: { rows: { id: string; name: string; index: number; pct: number; label: string }[] }) {
  return (
    <ol className="mt-4 flex flex-col gap-2">
      {rows.slice(0, 3).map((r) => (
        <li key={r.id} className="flex items-center gap-2">
          <span className="w-[42%] truncate text-[clamp(0.85rem,1vw,1.15rem)] font-semibold" title={r.name}>
            {r.name}
          </span>
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#efeee8]">
            <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${r.pct}%`, backgroundColor: topicColor(r.index) }} />
          </span>
          <span className="font-display w-[4ch] text-right font-semibold tabular-nums">{r.label}</span>
        </li>
      ))}
    </ol>
  );
}

/** One card per question; click to see its details. */
export function FocusOverview({ groups, criteria, cells, scaleMax, results, onOpen }: Props) {
  const { polls, words } = results;
  const cols = groups.length <= 2 ? groups.length : groups.length <= 4 ? 2 : groups.length <= 6 ? 3 : 4;
  return (
    // One card per row on phones, at most 2 on tablets, the full count on wide screens.
    <div
      className="grid grid-cols-1 gap-[clamp(0.75rem,1.4vw,1.5rem)] sm:[grid-template-columns:var(--cols-sm)] lg:[grid-template-columns:var(--cols)]"
      style={{
        ["--cols-sm" as string]: `repeat(${Math.min(cols, 2)}, minmax(0, 1fr))`,
        ["--cols" as string]: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {groups.map((g, i) => {
        if (g.kind !== "rating") {
          const options = g.topics.map((t) => t.item);
          const people = results.respondents.find((x) => x.focusId === g.focus.id)?.n ?? 0;
          const tally = g.kind === "poll" || g.kind === "multi" ? pollTally(options, polls, g.focus.id, g.kind === "multi" ? people : undefined) : null;
          const ranked = g.kind === "rank" ? rankTally(options, results.ranks, g.focus.id) : null;
          const stats = g.kind === "number" ? numberStats(results.numbers, g.focus.id, g.min ?? 0, g.max ?? 100) : null;
          const texts = g.kind === "text" ? results.texts.filter((t) => t.focusId === g.focus.id) : [];
          const cloud = g.kind === "words" ? wordWeights(words, g.focus.id) : [];
          const asked = g.kind === "qa" ? qaOrder(results.questions, g.focus.id, "top") : [];
          const quizAnswers = g.kind === "quiz" ? results.quizCounts.filter((c) => c.focusId === g.focus.id).reduce((n, c) => n + c.n, 0) : 0;
          const quizLive = g.kind === "quiz" && results.quiz?.focusId === g.focus.id && results.quiz.correctTopicId === null;
          const count =
            g.kind === "poll" && tally ? plural(tally.total, "vote", "votes")
            : g.kind === "words" ? plural(cloud.reduce((s, w) => s + w.n, 0), "answer", "answers")
            : g.kind === "text" ? plural(texts.length, "answer", "answers")
            : g.kind === "qa" ? plural(asked.length, "question", "questions")
            : g.kind === "quiz" ? plural(quizAnswers, "answer", "answers")
            : plural(people, "person", "people");
          return (
            <button
              key={g.focus.id}
              type="button"
              onClick={() => onOpen(i)}
              className="slab group flex flex-col rounded-xl bg-white p-[clamp(1rem,1.4vw,1.6rem)] text-left transition-transform hover:-translate-y-1"
            >
              <p className="text-[clamp(0.8rem,0.9vw,1rem)] font-semibold text-ink-soft">{kindLabel(g.kind)}</p>
              <h2 className="font-display text-[clamp(1.3rem,1.9vw,2.2rem)] font-semibold leading-tight break-words">{g.focus.name}</h2>
              {tally && <TopBars rows={[...tally.rows].sort((a, b) => b.n - a.n).map((r) => ({ ...r, label: `${r.pct}%` }))} />}
              {ranked && (
                <TopBars
                  rows={ranked.rows.map((r, pos) => ({ ...r, pct: r.average === null ? 0 : r.score * 100, label: r.average === null ? "–" : `#${pos + 1}` }))}
                />
              )}
              {stats && (
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[clamp(2rem,3.2vw,3.6rem)] leading-none font-semibold tabular-nums">{formatNumber(stats.mean)}</span>
                  <span className="font-semibold text-ink-soft">{stats.mean === null ? "no answers yet" : `average${g.unit ? ` ${g.unit}` : ""}`}</span>
                </p>
              )}
              {g.kind === "text" && (
                <ul className="mt-4 flex flex-col gap-1.5">
                  {texts.slice(0, 3).map((t) => (
                    <li key={`${t.at}:${t.text}`} className="truncate rounded-lg bg-canvas px-2.5 py-1.5 text-[clamp(0.85rem,1vw,1.15rem)] font-semibold" title={t.text}>
                      {t.text}
                    </li>
                  ))}
                  {texts.length === 0 && <li className="text-ink-soft">No answers yet</li>}
                </ul>
              )}
              {g.kind === "quiz" && (
                <p className="mt-4 text-[clamp(0.95rem,1.1vw,1.25rem)] font-semibold">
                  {quizLive ? (
                    <span className="inline-flex items-center gap-2 text-primary">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden /> Running now
                    </span>
                  ) : quizAnswers > 0 ? (
                    "Played"
                  ) : (
                    <span className="text-ink-soft">Not started yet. Open it to start.</span>
                  )}
                </p>
              )}
              {g.kind === "qa" && (
                <ul className="mt-4 flex flex-col gap-1.5">
                  {asked.slice(0, 3).map((q) => (
                    <li key={q.id} className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5 text-[clamp(0.85rem,1vw,1.15rem)] font-semibold">
                      <span className="shrink-0 tabular-nums text-primary">▲ {q.votes}</span>
                      <span className="truncate" title={q.text}>
                        {q.text}
                      </span>
                    </li>
                  ))}
                  {asked.length === 0 && <li className="text-ink-soft">No questions yet</li>}
                </ul>
              )}
              {g.kind === "words" && (
                <ul className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {cloud.slice(0, 8).map((w, j) => (
                    <li key={w.word} className="font-display font-semibold" style={{ fontSize: `${0.95 + w.weight * 0.9}rem`, color: topicInk(j) }}>
                      {w.word}
                    </li>
                  ))}
                  {cloud.length === 0 && <li className="text-ink-soft">No answers yet</li>}
                </ul>
              )}
              <span className="mt-auto flex items-center justify-between pt-4 text-[clamp(0.8rem,0.95vw,1.05rem)] font-bold">
                <span className="text-ink-soft">{count}</span>
                <span className="rounded-full bg-ink px-3 py-1 text-white group-hover:bg-primary">See results</span>
              </span>
            </button>
          );
        }
        const s = summarizeFocus(g, criteria, cells);
        const badge = s.average === null ? null : scaleColor(s.average, scaleMax);
        const ranked = g.topics
          .map(({ item, index }) => ({
            item,
            index,
            value: avg(sumAggs(criteria.map((c) => cells.get(cellKey(item.id, c.id))))),
          }))
          .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
          .slice(0, 3);
        return (
          <button
            key={g.focus.id || "loose"}
            type="button"
            onClick={() => onOpen(i)}
            className="slab group flex flex-col rounded-xl bg-white p-[clamp(1rem,1.4vw,1.6rem)] text-left transition-transform hover:-translate-y-1"
            aria-label={`Open ${g.focus.name}: overall ${fmt1(s.average)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[clamp(0.8rem,0.9vw,1rem)] font-semibold text-ink-soft">
                  Score items: {g.topics.length} {g.topics.length === 1 ? "item" : "items"}
                </p>
                <h2 className="font-display text-[clamp(1.3rem,1.9vw,2.2rem)] font-semibold leading-tight break-words">{g.focus.name}</h2>
              </div>
              <span
                className="font-display flex aspect-square w-[clamp(3.6rem,5vw,5.4rem)] shrink-0 items-center justify-center rounded-full border border-line-strong text-[clamp(1.3rem,2vw,2.3rem)] font-semibold"
                style={badge ? { backgroundColor: badge.bg, color: badge.fg } : undefined}
              >
                {fmt1(s.average)}
              </span>
            </div>

            <ol className="mt-4 flex flex-col gap-2">
              {ranked.map((r) => (
                <li key={r.item.id} className="flex items-center gap-2">
                  <span className="w-[42%] truncate text-[clamp(0.85rem,1vw,1.15rem)] font-semibold" title={r.item.name}>
                    {r.item.name}
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#efeee8]">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${r.value === null ? 0 : (r.value / scaleMax) * 100}%`, backgroundColor: topicColor(r.index) }}
                    />
                  </span>
                  <span className="font-display w-[3ch] text-right font-semibold tabular-nums">{fmt1(r.value)}</span>
                </li>
              ))}
            </ol>

            <span className="mt-auto flex items-center justify-between pt-4 text-[clamp(0.8rem,0.95vw,1.05rem)] font-bold">
              <span className="text-ink-soft">{s.n} {s.n === 1 ? "score" : "scores"}</span>
              <span className="rounded-full bg-ink px-3 py-1 text-white group-hover:bg-primary">See details</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
