import type { Metadata, Viewport } from "next";
import { ReportApp } from "@/components/admin/ReportApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Report · LiveRate", robots: { index: false } };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

export default async function ReportPage({ params, searchParams }: PageProps<"/admin/report/[code]">) {
  const { code } = await params;
  const { print } = await searchParams;
  return (
    <div className="quiet contents">
      <ReportApp code={normalizeCode(code)} autoPrint={print === "1"} />
    </div>
  );
}
