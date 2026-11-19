import type { Metadata, Viewport } from "next";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export const metadata: Metadata = { title: "Verify email · LiveRate", robots: { index: false }, referrer: "no-referrer" };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

export default function VerifyPage() {
  return (
    <div className="quiet contents">
      <VerifyEmail />
    </div>
  );
}
