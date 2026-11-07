import type { Metadata } from "next";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export const metadata: Metadata = { title: "Verify email · LiveRate", robots: { index: false }, referrer: "no-referrer" };

// Rendered per request: the page carries this request's CSP nonce (proxy.ts).
export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return <VerifyEmail />;
}
