import type { Activity } from "@/lib/activities";

/**
 * A presentation made from a team activity: the host's "how to run it" steps on the results screen,
 * folded away until asked for, so they never get in the way of the board.
 */
export function HowToRun({ activity }: { activity: Activity }) {
  return (
    <details className="no-print mb-3 rounded-xl border border-line bg-white px-3 py-2 text-[clamp(0.85rem,0.95vw,1.05rem)]">
      <summary className="cursor-pointer font-semibold">
        How to run it: {activity.label}
      </summary>
      <ol className="mt-2 mb-1 max-w-[70ch] list-decimal space-y-1 pl-5">
        {activity.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
