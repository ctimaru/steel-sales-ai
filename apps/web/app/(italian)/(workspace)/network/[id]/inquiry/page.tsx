import { redirect } from "next/navigation";

/** NET-UX LOT1B — founder decision (2 Nov 2026): requests are sent only from the
 * RFQ Hub. The per-company inquiry composer is retired; old links open the profile. */
export default async function RetiredNetworkInquiryComposePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect("/network/" + encodeURIComponent(id));
}
