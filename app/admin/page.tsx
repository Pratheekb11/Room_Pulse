import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/AdminApp";
import { WarmUp } from "@/components/WarmUp";
import { aiAvailable } from "@/lib/ai";

export const metadata: Metadata = { title: "Your presentations · LiveRate", robots: { index: false } };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <>
      <WarmUp />
      <AdminApp siteAi={aiAvailable()} />
    </>
  );
}
