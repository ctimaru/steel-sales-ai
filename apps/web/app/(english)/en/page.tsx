import { PublicHomeHeader } from "@/components/public-home-header";
import { PublicCinematicHero } from "@/components/public-cinematic-hero";
import { HomeFloatingTools } from "@/components/home-floating-tools";
import { PublicCinematicAccessBand, PublicSteelGeometryProof } from "@/components/public-steel-geometry-proof";
import cineStyles from "@/components/public-cinematic-continuity.module.css";
import type { Metadata } from "next";
import Link from "next/link";

import { PublicContactSection } from "@/components/public-contact-section";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Smart Steel Sales — Commercial Intelligence for Steel & Tubes",
  description:
    "Super Intelligence Ready: B2B commercial intelligence for the steel and tube industry. Organize technical enquiries, compare supplier quotations and explore steel knowledge.",
  alternates: {
    canonical: absoluteUrl("/en"),
    languages: {
      it: absoluteUrl("/"),
      en: absoluteUrl("/en"),
      de: absoluteUrl("/de"),
      fr: absoluteUrl("/fr"),
      es: absoluteUrl("/es"),
      "x-default": absoluteUrl("/"),
    },
  },
  openGraph: {
    title: "Smart Steel Sales — Commercial Intelligence for Steel & Tubes",
    description:
      "A more connected steel supply chain: RFQ workflows, supplier quotations, public knowledge and a governed B2B network.",
    url: absoluteUrl("/en"),
    type: "website",
    locale: "en_US",
  },
};

const workflows = [
  {
    index: "01",
    title: "Build a technical enquiry",
    description:
      "Prepare steel and tube requirements with grades, standards, dimensions and quantities in a structured bill of materials.",
  },
  {
    index: "02",
    title: "Request and compare quotations",
    description:
      "Bring multi-supplier RFQs, clarification rounds and comparable offers into one governed purchasing workflow.",
  },
  {
    index: "03",
    title: "Develop trusted business relationships",
    description:
      "Discover the supply chain and connect companies while keeping private commercial information separate.",
  },
] as const;

const roles = [
  { title: "Producers", description: "Steel mills and tube manufacturers." },
  { title: "Distributors", description: "Stockholders, wholesalers and steel traders." },
  { title: "Processors", description: "Steel service centres, fabricators and subcontractors." },
  { title: "Industrial buyers", description: "Companies sourcing and using steel and tubes." },
] as const;

export default function EnglishHomePage() {
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Smart Steel Sales — Commercial Intelligence for Steel & Tubes",
    inLanguage: "en",
    url: absoluteUrl("/en"),
    isPartOf: {
      "@type": "WebSite",
      name: "Smart Steel Sales",
      url: absoluteUrl("/"),
    },
  };

  return (
    <main lang="en" className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />

      <PublicHomeHeader locale="en" />

      <PublicCinematicHero locale="en" />

      <HomeFloatingTools locale="en" />

      <section className={cineStyles.enWorkflow} aria-labelledby="en-workflows">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Purpose-built for B2B</p>
          <h2 id="en-workflows" className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-[#123b34]">From a steel requirement to a better-informed decision.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {workflows.map((item) => (
              <article key={item.index} className={`${cineStyles.enWorkflowCard} border p-6`}>
                <span className="text-xs font-extrabold text-[#1f6b5a]">{item.index}</span>
                <h3 className="mt-3 text-lg font-bold text-[#123b34]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#52615b]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PublicSteelGeometryProof locale="en" />

      <section className={cineStyles.enNetwork} aria-labelledby="en-network-heading">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">The steel supply chain</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 id="en-network-heading" className="max-w-2xl text-3xl font-semibold tracking-tight text-[#123b34]">One network, four business profiles.</h2>
            <Link href="/en/network" className="text-sm font-bold text-[#1f6b5a] underline underline-offset-4">Explore the Network →</Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((role) => (
              <article key={role.title} className={`${cineStyles.enNetworkCard} border px-5 py-6`}>
                <h3 className="font-bold text-[#123b34]">{role.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#52615b]">{role.description}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-[#66736e]">
            Public company discovery and private company workspaces have separate access controls. Commercial data is not part of public search.
          </p>
        </div>
      </section>

      <section className={cineStyles.enKnowledge} aria-labelledby="en-knowledge-heading">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Open knowledge</p>
            <h2 id="en-knowledge-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#123b34]">Technical knowledge should be easier to find.</h2>
            <p className="mt-3 text-sm leading-7 text-[#52615b]">Explore standards, steel grades, tube shapes and theoretical weights. Public tools support early research without disclosing private RFQs or prices.</p>
          </div>
          <Link href="/en/knowledge" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-[#b9c9c2] bg-white px-6 text-sm font-bold text-[#123b34] hover:bg-[#edf5f1]">Explore Steel Knowledge →</Link>
        </div>
      </section>

      <PublicCinematicAccessBand locale="en" />

      <PublicContactSection locale="en" />

      <footer className="bg-[#f2f4f3]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-6 text-xs text-[#52615b] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/en/knowledge" className="font-semibold hover:text-[#173f35]">Knowledge</Link>
            <Link href="/en/network" className="font-semibold hover:text-[#173f35]">Network</Link>
            <Link href="/en/knowledge/tubes" className="font-semibold hover:text-[#173f35]">Weight calculator</Link>
            <Link href="/en/distinta" className="font-semibold hover:text-[#173f35]">RFQ builder</Link>
                        <Link href="/en/investors" className="font-semibold hover:text-[#173f35]">Investors</Link>
            <a href="https://www.linkedin.com/company/smart-steel-sales" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[#173f35]">LinkedIn ↗</a>
            <a href="mailto:hello@smartsteelsales.com" className="font-semibold hover:text-[#173f35]">hello@smartsteelsales.com</a>
<Link href="/privacy" hrefLang="it" className="font-semibold hover:text-[#173f35]">Privacy (IT)</Link>
            <Link href="/terms" hrefLang="it" className="font-semibold hover:text-[#173f35]">Terms (IT)</Link>
            <Link href="/" hrefLang="it" className="font-semibold hover:text-[#173f35]">Italiano</Link>
          </div>
          <span>Smart Steel Sales · Built for the steel &amp; tube industry.</span>
        </div>
      </footer>
    </main>
  );
}
