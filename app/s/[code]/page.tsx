import { VoteApp } from "@/components/VoteApp";
import { normalizeCode } from "@/lib/code";
import { getSession } from "@/lib/queries";
import { codeSchema } from "@/lib/validation";
import type { SessionPayload } from "@/lib/types";

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default async function VotePage({ params }: PageProps<"/s/[code]">) {
  const code = normalizeCode((await params).code);
  // The questions come with the page, so a phone doesn't wait for a second request before it can vote.
  // If the database is slow or the code is unknown, the client loads them itself as before.
  let initial: SessionPayload | null = null;
  if (codeSchema.safeParse(code).success) {
    try {
      initial = await getSession(code);
    } catch {
      initial = null;
    }
  }
  return <VoteApp code={code} initial={initial} />;
}
