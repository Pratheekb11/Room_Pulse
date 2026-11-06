import type { Metadata } from "next";
import { EditApp } from "@/components/admin/EditApp";
import { normalizeCode } from "@/lib/code";

export const metadata: Metadata = { title: "Edit presentation · LiveRate", robots: { index: false } };

export default async function EditPage({ params, searchParams }: PageProps<"/admin/edit/[code]">) {
  const { code } = await params;
  const { back } = await searchParams;
  return <EditApp code={normalizeCode(code)} backTo={back === "results" ? "results" : "console"} />;
}
