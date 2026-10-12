import type { Metadata } from "next";
import { InvestorOpportunityPage } from "@/components/investor-opportunity-page";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Investitori Smart Steel Sales | Digitalizzazione della filiera dell’acciaio",
  description: "Scopri Smart Steel Sales, piattaforma SteelTech B2B per RFQ, procurement e intelligence commerciale nella filiera dell'acciaio. Contattaci per richiedere il Business Plan riservato.",
  alternates: { canonical: absoluteUrl("/investitori"), languages: { it: absoluteUrl("/investitori"), en: absoluteUrl("/en/investors"), "x-default": absoluteUrl("/en/investors") } },
  openGraph: { title: "Smart Steel Sales — Opportunità per investitori", description: "Procurement e intelligence B2B per il mercato dell'acciaio.", url: absoluteUrl("/investitori"), type: "website" },
};
export default function InvestorPage() {
  const contact = "mailto:hello@smartsteelsales.com?subject=" + encodeURIComponent("Richiesta Business Plan — Smart Steel Sales");
  return <InvestorOpportunityPage locale="it" contactHref={contact} />;
}
