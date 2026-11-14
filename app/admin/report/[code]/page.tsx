import type { Metadata } from "next";
import { ReportApp } from "@/components/admin/ReportApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Report · LiveRate", robots: { index: false } };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: PageProps<"/admin/report/[code]">) {
  const { code } = await params;
  const { print } = await searchParams;
  return <ReportApp code={normalizeCode(code)} autoPrint={print === "1"} />;
}
