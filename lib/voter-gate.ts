import "server-only";
import { json } from "./http";
import { limited, MAX_VOTERS_PER_PRESENTATION } from "./limits";
import { addVoter, getVoterState } from "./queries";

/**
 * Checks before any answer is saved (votes, picks, words, Q&A, quiz): the client's request limit,
 * then, for a voter id this presentation hasn't seen, the client's new-voter limit and the
 * presentation's voter cap. Returns a response to send instead, or null to go ahead.
 * Unknown or closed presentations go ahead, so the route reports them as it always has.
 */
export async function admitVoter(req: Request, code: string, voterId: string): Promise<Response | null> {
  const busy = await limited(req, "answer");
  if (busy) return busy;
  const state = await getVoterState(code, voterId);
  if (!state || !state.isOpen || state.known) return null;
  const tooManyNew = await limited(req, "newVoter");
  if (tooManyNew) return tooManyNew;
  return (await addVoter(code, voterId, MAX_VOTERS_PER_PRESENTATION)) ? null : json({ error: "full" }, 403);
}
