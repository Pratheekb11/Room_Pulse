import { ACTIVITIES } from "@/lib/activities";
import { topicColor } from "@/lib/colors";
import { TEMPLATES } from "@/lib/templates";

export type StartChoice = "blank" | "templates" | "activities" | "ai";

/**
 * "How do you want to start?": big tiles for Write your own, a template, a team activity and (accounts with AI)
 * Write with AI. Shared by the builder and the "See how it works" walkthrough, so the walkthrough always shows it.
 */
export function StartChoices({ ai, onPick }: { ai: boolean; onPick: (choice: StartChoice) => void }) {
  const tiles: { id: StartChoice; label: string; sub: string; icon: string }[] = [
    { id: "blank", label: "Write your own", sub: "Begin with an empty question", icon: "M5 19l3.5-.8L18.3 8.4a1.8 1.8 0 0 0-2.6-2.6L5.9 15.6zM14 7.5l2.5 2.5" },
    { id: "templates", label: "Pick a template", sub: `${TEMPLATES.length} ready-made: retro, standup, feedback…`, icon: "M4 5h16v14H4zM4 10h16M10 10v9" },
    { id: "activities", label: "Team activity", sub: `${ACTIVITIES.length} activities for the room and online`, icon: "M12 21v-6M12 15c-4 0-7-2.5-7-6a7 7 0 0 1 14 0c0 3.5-3 6-7 6zM9 9.5h.01M15 9.5h.01" },
    ...(ai
      ? [{ id: "ai" as const, label: "Write with AI", sub: "Say what it’s for; AI drafts the questions", icon: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" }]
      : []),
  ];
  return (
    <div className={`mt-3 grid grid-cols-1 gap-3 ${ai ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
      {tiles.map((t, n) => (
        <button
          key={t.id}
          type="button"
          data-start={t.id}
          onClick={() => onPick(t.id)}
          className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white px-3 py-5 text-center transition-[border-color,transform] duration-150 hover:border-ink active:scale-[0.98] max-sm:min-h-0 max-sm:flex-row max-sm:justify-start max-sm:text-left"
        >
          <svg viewBox="0 0 24 24" className="h-9 w-9 shrink-0" fill="none" stroke="currentColor" style={{ color: topicColor(n) }} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={t.icon} />
          </svg>
          <span>
            <span className="block text-lg font-bold">{t.label}</span>
            <span className="block text-sm text-ink-soft">{t.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
