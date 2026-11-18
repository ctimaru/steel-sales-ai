import { redirect } from "next/navigation";

import { rfqHubHref } from "@/lib/rfq-hub-rows";

// RFQHUB1 (founder decision, 18 Nov 2026): the Distinte list lives inside
// Centro RFQ (one row per Distinta with its request). Detail pages under
// /rfq-hub/distinte/[id] stay. Old links keep search, archive and page.
export const dynamic = "force-dynamic";

export default async function RfqSavedDistinteRedirect({
  searchParams,
}: { searchParams: Promise<{ page?: string; q?: string; view?: string }> }) {
  const { page, q, view } = await searchParams;
  const pageNumber = typeof page === "string" && /^[1-9]\d{0,3}$/.test(page) ? Number(page) : 1;
  redirect(rfqHubHref(view === "archived" ? "archiviate" : "attive", typeof q === "string" ? q.trim().slice(0, 80) : "", pageNumber));
}
