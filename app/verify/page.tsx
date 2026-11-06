import type { Metadata } from "next";
import { VerifyEmail } from "@/components/auth/VerifyEmail";

export const metadata: Metadata = { title: "Verify email · LiveRate", robots: { index: false }, referrer: "no-referrer" };

export default function VerifyPage() {
  return <VerifyEmail />;
}
