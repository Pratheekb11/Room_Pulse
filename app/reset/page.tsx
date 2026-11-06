import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/ResetForm";

// No referrer: the reset token must never leak to another site.
export const metadata: Metadata = { title: "Choose a new password · LiveRate", robots: { index: false }, referrer: "no-referrer" };

export default function ResetPage() {
  return <ResetForm />;
}
