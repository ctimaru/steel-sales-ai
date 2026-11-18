import { redirect } from "next/navigation";

import { rfqHubHref } from "@/lib/rfq-hub-rows";

// RFQHUB1: legacy /marketplace/inbox lands on Centro RFQ «Da gestire».
export const dynamic = "force-dynamic";

export default function LegacyProcurementInboxRedirect() {
  redirect(rfqHubHref("da-gestire"));
}
