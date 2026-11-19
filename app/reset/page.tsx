import type { Metadata, Viewport } from "next";
import { ResetForm } from "@/components/auth/ResetForm";

// No referrer: the reset token must never leak to another site.
export const metadata: Metadata = { title: "Choose a new password · LiveRate", robots: { index: false }, referrer: "no-referrer" };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

export default function ResetPage() {
  return (
    <div className="quiet contents">
      <ResetForm />
    </div>
  );
}
