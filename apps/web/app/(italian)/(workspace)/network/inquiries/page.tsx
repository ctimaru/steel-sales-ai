import { redirect } from "next/navigation";

/** NET-UX LOT1B — founder decision (2 Nov 2026): requests to companies are sent
 * only from the RFQ Hub, where a sales user chooses the recipients. The Network
 * inquiry inbox is retired from the interface; stored inquiries are untouched. */
export default function RetiredNetworkInquiriesPage() {
  redirect("/network");
}
