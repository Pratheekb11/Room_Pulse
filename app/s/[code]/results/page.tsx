import type { Metadata } from "next";
import { DashboardApp } from "@/components/DashboardApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Live results · LiveRate" };

/** Live results on voters' phones, when the presenter shares them. */
export default async function AudienceResultsPage({ params }: PageProps<"/s/[code]/results">) {
  const { code } = await params;
  return <DashboardApp code={normalizeCode(code)} audience />;
}
