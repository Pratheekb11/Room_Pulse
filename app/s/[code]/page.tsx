import { VoteApp } from "@/components/VoteApp";
import { normalizeCode } from "@/lib/code";

export default async function VotePage({ params }: PageProps<"/s/[code]">) {
  const { code } = await params;
  return <VoteApp code={normalizeCode(code)} />;
}
