import type { Metadata, Viewport } from "next";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Reset password · LiveRate", robots: { index: false } };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

export default function ForgotPage() {
  return (
    <div className="quiet contents">
      <ForgotForm />
    </div>
  );
}
