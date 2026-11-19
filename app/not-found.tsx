import type { Viewport } from "next";
import { CenteredMessage } from "@/components/StatusScreens";

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

// The site's own screens are Quiet (app/globals.css, `:root:has(.quiet)`): the browser bar matches.
export const viewport: Viewport = { themeColor: "#131314" };

export default function NotFound() {
  return (
    <div className="quiet contents">
      <CenteredMessage title="Page not found" body="This page doesn't exist. Check the link, or go back to the home page." />
    </div>
  );
}
