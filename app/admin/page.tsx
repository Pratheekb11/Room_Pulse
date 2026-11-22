import type { Metadata, Viewport } from "next";
import { AdminApp } from "@/components/admin/AdminApp";
import { WarmUp } from "@/components/WarmUp";
import { ACTIVITIES } from "@/lib/activities";

export const metadata: Metadata = { title: "Your presentations · LiveRate", robots: { index: false } };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

// `?activity=<id>` (the home page's activity links) opens the builder with that activity ready to go.
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ activity?: string | string[] }> }) {
  const { activity } = await searchParams;
  const startActivity = ACTIVITIES.find((a) => a.id === activity)?.id;
  return (
    <div className="quiet contents">
      <WarmUp />
      <AdminApp startActivity={startActivity} />
    </div>
  );
}
