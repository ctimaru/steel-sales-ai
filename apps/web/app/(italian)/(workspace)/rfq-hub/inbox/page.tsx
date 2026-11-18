import { redirect } from "next/navigation";

import { rfqHubHref } from "@/lib/rfq-hub-rows";

// RFQHUB1 (founder decision, 18 Nov 2026): «Inbox e risposte» is the
// «Da gestire» filter of Centro RFQ. Old links from emails and notifications
// land there.
export const dynamic = "force-dynamic";

export default function RfqHubInboxRedirect() {
  redirect(rfqHubHref("da-gestire"));
}
