import type { Metadata } from "next";
import { DashboardApp } from "@/components/DashboardApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Live results · LiveRate" };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: PageProps<"/s/[code]/dashboard">) {
  const { code } = await params;
  return <DashboardApp code={normalizeCode(code)} />;
}
