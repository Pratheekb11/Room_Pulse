// Names on team activities (sessions.named): who picked each option, who said each word.
// Team building isn't fun anonymously, so a presentation made from a team activity asks each
// person for a name once and shows it beside their answers. Other presentations stay anonymous.
import type { ResultsPayload } from "./types";

/** The names of the people who gave one answer (an option's id, or a word), in the order they answered. */
export function namesFor(r: Pick<ResultsPayload, "who">, focusId: string, key: string): string[] {
  return r.who?.find((w) => w.focusId === focusId && w.key === key)?.names ?? [];
}

/** Whether any answer to this question has a name on it yet. */
export function hasNames(r: Pick<ResultsPayload, "who">, focusId: string): boolean {
  return (r.who ?? []).some((w) => w.focusId === focusId && w.names.length > 0);
}

/** The line under the phone's header: who will see what. */
export function privacyLine({ named, boards }: { named: boolean; boards: boolean }): string {
  if (named) return "Saved as you tap. This is a team activity: your answers show your name.";
  if (boards) return "Saved as you tap. Answers on a board show your name. The rest are anonymous.";
  return "Saved as you tap. Your answers are anonymous.";
}

/** The report's footer: who can be told apart in it. */
export function reportPrivacy({ named, boards }: { named: boolean; boards: boolean }): string {
  if (named) return "This was a team activity: answers show people's names.";
  if (boards) return "Answers on a board show their writer's name; the rest are anonymous.";
  return "Answers are anonymous.";
}
