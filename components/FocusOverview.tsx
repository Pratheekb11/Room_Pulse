import { scaleColor, topicColor } from "@/lib/colors";
import { summarizeFocus, type FocusGroup } from "@/lib/focus";
import { avg, cellKey, fmt1, sumAggs, type Agg } from "@/lib/stats";
import { pollTally, wordWeights } from "@/lib/answers";
import type { NamedItem, PollCount, WordCount } from "@/lib/types";

interface Props {
  groups: FocusGroup[];
  criteria: NamedItem[];
  cells: Map<string, Agg>;
  scaleMax: number;
  polls: PollCount[];
  words: WordCount[];
  onOpen: (index: number) => void;
}

const KIND_LABEL = { rating: "Rating", poll: "Poll", words: "Word cloud" } as const;

/** One card per focus topic; click to drill into its per-topic breakdown. */
export function FocusOverview({ groups, criteria, cells, scaleMax, polls, words, onOpen }: Props) {
  const cols = groups.length <= 2 ? groups.length : groups.length <= 4 ? 2 : groups.length <= 6 ? 3 : 4;
  return (
    <div className="grid gap-[clamp(0.75rem,1.4vw,1.5rem)]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {groups.map((g, i) => {
        if (g.kind !== "rating") {
          const tally = g.kind === "poll" ? pollTally(g.topics.map((t) => t.item), polls, g.focus.id) : null;
          const cloud = g.kind === "words" ? wordWeights(words, g.focus.id) : [];
          const count = tally ? tally.total : cloud.reduce((s, w) => s + w.n, 0);
          return (
            <button
              key={g.focus.id}
              type="button"
              onClick={() => onOpen(i)}
              className="slab group flex flex-col rounded-[26px] bg-white p-[clamp(1rem,1.4vw,1.6rem)] text-left transition-transform hover:-translate-y-1"
            >
              <p className="text-[clamp(0.8rem,0.9vw,1rem)] font-semibold text-ink-soft">{KIND_LABEL[g.kind]}</p>
              <h2 className="font-display text-[clamp(1.3rem,1.9vw,2.2rem)] font-extrabold leading-tight break-words">{g.focus.name}</h2>
              {tally && (
                <ol className="mt-4 flex flex-col gap-2">
                  {[...tally.rows].sort((a, b) => b.n - a.n).slice(0, 3).map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-[42%] truncate text-[clamp(0.85rem,1vw,1.15rem)] font-semibold" title={r.name}>
                        {r.name}
                      </span>
                      <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#ebe7fb]">
                        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${r.pct}%`, backgroundColor: topicColor(r.index) }} />
                      </span>
                      <span className="font-display w-[4ch] text-right font-extrabold tabular-nums">{r.pct}%</span>
                    </li>
                  ))}
                </ol>
              )}
              {g.kind === "words" && (
                <ul className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {cloud.slice(0, 8).map((w, j) => (
                    <li key={w.word} className="font-display font-extrabold" style={{ fontSize: `${0.95 + w.weight * 0.9}rem`, color: topicColor(j) === "#FFB81F" ? "#c98a00" : topicColor(j) }}>
                      {w.word}
                    </li>
                  ))}
                  {cloud.length === 0 && <li className="text-ink-soft">No answers yet</li>}
                </ul>
              )}
              <span className="mt-auto flex items-center justify-between pt-4 text-[clamp(0.8rem,0.95vw,1.05rem)] font-bold">
                <span className="text-ink-soft">
                  {count} {g.kind === "poll" ? "votes" : "answers"}
                </span>
                <span className="rounded-full bg-ink px-3 py-1 text-white group-hover:bg-violet">See results</span>
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
            className="slab group flex flex-col rounded-[26px] bg-white p-[clamp(1rem,1.4vw,1.6rem)] text-left transition-transform hover:-translate-y-1"
            aria-label={`Open ${g.focus.name}: overall ${fmt1(s.average)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[clamp(0.8rem,0.9vw,1rem)] font-semibold text-ink-soft">
                  Rating, {g.topics.length} {g.topics.length === 1 ? "topic" : "topics"}
                </p>
                <h2 className="font-display text-[clamp(1.3rem,1.9vw,2.2rem)] font-extrabold leading-tight break-words">{g.focus.name}</h2>
              </div>
              <span
                className="font-display flex aspect-square w-[clamp(3.6rem,5vw,5.4rem)] shrink-0 items-center justify-center rounded-full border-2 border-ink text-[clamp(1.3rem,2vw,2.3rem)] font-extrabold"
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
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#ebe7fb]">
                    <span
                      className="block h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${r.value === null ? 0 : (r.value / scaleMax) * 100}%`, backgroundColor: topicColor(r.index) }}
                    />
                  </span>
                  <span className="font-display w-[3ch] text-right font-extrabold tabular-nums">{fmt1(r.value)}</span>
                </li>
              ))}
            </ol>

            <span className="mt-auto flex items-center justify-between pt-4 text-[clamp(0.8rem,0.95vw,1.05rem)] font-bold">
              <span className="text-ink-soft">{s.n} ratings</span>
              <span className="rounded-full bg-ink px-3 py-1 text-white group-hover:bg-violet">See breakdown</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
