import type { Metadata } from "next";
import { DashboardApp } from "@/components/DashboardApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Live results · LiveRate" };

/** Live results on voters' phones, when the presenter shares them. */
// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default async function AudienceResultsPage({ params }: PageProps<"/s/[code]/results">) {
  const { code } = await params;
  return <DashboardApp code={normalizeCode(code)} audience />;
}
