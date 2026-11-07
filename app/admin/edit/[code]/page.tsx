import type { Metadata } from "next";
import { EditApp } from "@/components/admin/EditApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Edit presentation · LiveRate", robots: { index: false } };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default async function EditPage({ params, searchParams }: PageProps<"/admin/edit/[code]">) {
  const { code } = await params;
  const { back } = await searchParams;
  return <EditApp code={normalizeCode(code)} backTo={back === "results" ? "results" : "console"} />;
}
