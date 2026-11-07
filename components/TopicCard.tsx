import type { NamedItem, SessionInfo } from "@/lib/types";
import type { SaveStatus } from "@/lib/vote-queue";
import { cellKey } from "@/lib/stats";
import { readableOn } from "@/lib/colors";
import { RatingRow } from "./RatingRow";

interface Props {
  topic: NamedItem & { description?: string | null };
  index: number;
  total: number;
  color: string;
  criteria: NamedItem[];
  session: SessionInfo;
  ratings: Record<string, number>;
  statuses: Record<string, SaveStatus>;
  disabled: boolean;
  onRate: (topicId: string, criterionId: string, score: number) => void;
}

export function TopicCard(p: Props) {
  const rated = p.criteria.filter((c) => p.ratings[cellKey(p.topic.id, c.id)] !== undefined).length;
  const complete = rated === p.criteria.length;
  const fg = readableOn(p.color);

  return (
    <section aria-labelledby={`topic-${p.topic.id}`} className="slab overflow-hidden rounded-xl bg-white">
      <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-4" style={{ backgroundColor: p.color, color: fg }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold opacity-80">
            Item {p.index + 1} of {p.total}
          </p>
          <h2 id={`topic-${p.topic.id}`} className="font-display text-2xl font-semibold leading-tight break-words">
            {p.topic.name}
          </h2>
          {p.topic.description && <p className="mt-1 text-[15px] leading-snug opacity-90 break-words">{p.topic.description}</p>}
        </div>
        <span
          className="mt-1 shrink-0 rounded-full border px-2.5 py-0.5 text-sm font-medium"
          style={{ borderColor: fg }}
          aria-label={`${rated} of ${p.criteria.length} rated`}
        >
          {complete ? "Done ✓" : `${rated}/${p.criteria.length}`}
        </span>
      </header>
      <div className="divide-y-2 divide-dashed divide-line px-5 py-2">
        {p.criteria.map((c) => {
          const key = cellKey(p.topic.id, c.id);
          return (
            <RatingRow
              key={c.id}
              topicName={p.topic.name}
              criterionName={c.name}
              scaleMax={p.session.scaleMax}
              lowLabel={p.session.lowLabel}
              highLabel={p.session.highLabel}
              value={p.ratings[key]}
              status={p.statuses[key]}
              disabled={p.disabled}
              color={p.color}
              onRate={(score) => p.onRate(p.topic.id, c.id, score)}
            />
          );
        })}
      </div>
    </section>
  );
}
