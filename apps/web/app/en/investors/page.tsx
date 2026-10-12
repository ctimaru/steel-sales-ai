import type { Metadata } from "next";
import { InvestorOpportunityPage } from "@/components/investor-opportunity-page";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Invest in Smart Steel Sales | Steel Supply Chain Software",
  description: "Discover Smart Steel Sales, a B2B SteelTech platform for RFQs, procurement and commercial intelligence. Contact us to request access to the confidential Business Plan.",
  alternates: { canonical: absoluteUrl("/en/investors"), languages: { it: absoluteUrl("/investitori"), en: absoluteUrl("/en/investors"), "x-default": absoluteUrl("/en/investors") } },
  openGraph: { title: "Smart Steel Sales — For investors", description: "B2B procurement and intelligence for the steel industry.", url: absoluteUrl("/en/investors"), type: "website" },
};
export default function InvestorPage() {
  const contact = "mailto:hello@smartsteelsales.com?subject=" + encodeURIComponent("Business Plan request — Smart Steel Sales");
  return <InvestorOpportunityPage locale="en" contactHref={contact} />;
}
