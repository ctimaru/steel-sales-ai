import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { PublicContactSection } from "@/components/public-contact-section";
import { PublicLanguageSwitch } from "@/components/public-language-switch";
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

      <header className="border-b border-[#dce5e0] bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/en" compact />
          <nav aria-label="English public navigation" className="hidden items-center gap-2 lg:flex">
            <Link href="/en/network" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Network</Link>
            <Link href="/en/knowledge" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Knowledge</Link>
            <Link href="/en/knowledge/tubes" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Weight calculator</Link>
            <Link href="/en/distinta" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">RFQ builder</Link>
            <Link href="#get-in-touch" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3]">Contact</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <PublicLanguageSwitch locale="en" italianHref="/" englishHref="/en" />
            <Link href="/register" hrefLang="it" className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-bold sm:px-4 sm:text-sm">
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Register company</span>
            </Link>
          </div>
        </div>
        <nav aria-label="English mobile navigation" className="flex gap-1 overflow-x-auto border-t border-[#edf1ee] px-4 py-1.5 lg:hidden">
          <Link href="/en/network" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Network</Link>
          <Link href="/en/knowledge" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Knowledge</Link>
          <Link href="/en/knowledge/tubes" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Weight calculator</Link>
          <Link href="/en/distinta" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">RFQ builder</Link>
          <Link href="#get-in-touch" className="inline-flex min-h-10 shrink-0 items-center px-3 text-xs font-semibold text-[#52615b]">Get in touch</Link>
        </nav>
      </header>

      <section className="relative overflow-hidden border-b border-[#dce5e0] bg-[#f6f8f7]" aria-labelledby="en-hero">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-56 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(31,107,90,0.12),transparent_68%)]" />
        <div className="relative mx-auto grid max-w-[1180px] gap-10 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:px-8 lg:py-20">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex min-h-8 items-center rounded-full border border-[#b9d7cb] bg-[#e6f3ed] px-3 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#123b34] sm:text-[11px]">Super Intelligence Ready</span>
              <span className="text-xs font-medium text-[#52615b]">Built for steel &amp; tube businesses</span>
            </div>
            <h1 id="en-hero" className="mt-6 max-w-[700px] text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#123b34] sm:text-[3.3rem] lg:text-[3.65rem]">
              Intelligence that connects <span className="block text-[#315c74]">the steel industry.</span>
            </h1>
            <p className="mt-5 max-w-[590px] text-base leading-7 text-[#475569] sm:text-lg sm:leading-8">
              Technical bills of materials, multi-supplier enquiries, quote comparison and supply-chain relationships, brought together for companies buying and selling steel.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" hrefLang="it" className="platform-primary inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-sm font-bold">
                Register your company <span aria-hidden="true" className="ml-2">→</span>
              </Link>
              <Link href="#get-in-touch" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#b9c9c2] bg-white px-6 text-sm font-bold text-[#123b34] hover:bg-[#edf5f1]">Get in touch</Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#52615b]">
              Company registration and the full workspace currently use an Italian-language interface. Access is subject to review.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#dbe6df] pt-5 text-xs font-semibold text-[#1f6b5a]">
              <Link href="/en/knowledge" className="underline underline-offset-4">Steel Knowledge</Link>
              <Link href="/en/network" className="underline underline-offset-4">Explore the Network</Link>
              <Link href="/en/knowledge/standards" className="underline underline-offset-4">Steel standards</Link>
              <Link href="/en/knowledge/grades" className="underline underline-offset-4">Steel grades</Link>
              <Link href="/en/knowledge/tubes" className="underline underline-offset-4">Calculate tube weight</Link>
              <Link href="/en/distinta" className="underline underline-offset-4">Create an RFQ bill</Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-[#d7e2db] bg-white p-5 shadow-[0_24px_64px_rgba(18,59,52,0.1)] sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5eeea] pb-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#1f6b5a]">Platform preview</p>
                <p className="mt-1 text-lg font-bold text-[#123b34]">Commercial cockpit</p>
              </div>
              <span className="rounded-full bg-[#e6f3ed] px-3 py-1.5 text-[10px] font-bold text-[#1f6b5a]">RFQ workflows</span>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["01", "Prepare requirements", "Specifications, grades & quantities"],
                ["02", "Manage supplier quotations", "Clarifications & comparable offers"],
                ["03", "Support purchasing decisions", "Traceable RFQ-to-order process"],
              ].map(([number, title, detail]) => (
                <div key={number} className="flex items-center gap-3 rounded-xl border border-[#e2ebe5] bg-[#f8faf8] p-3.5">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e6f3ed] text-xs font-extrabold text-[#1f6b5a]">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#123b34]">{title}</p>
                    <p className="mt-0.5 text-xs text-[#66736e]">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[#718078]">Illustrative preview. Product features are being prepared for controlled adoption.</p>
          </div>
        </div>
      </section>

      <section className="bg-white" aria-labelledby="en-workflows">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Purpose-built for B2B</p>
          <h2 id="en-workflows" className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-[#123b34]">From a steel requirement to a better-informed decision.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {workflows.map((item) => (
              <article key={item.index} className="rounded-2xl border border-[#dce5e0] bg-[#f8faf8] p-6">
                <span className="text-xs font-extrabold text-[#1f6b5a]">{item.index}</span>
                <h3 className="mt-3 text-lg font-bold text-[#123b34]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#52615b]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f4f3]" aria-labelledby="en-network-heading">
        <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">The steel supply chain</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 id="en-network-heading" className="max-w-2xl text-3xl font-semibold tracking-tight text-[#123b34]">One network, four business profiles.</h2>
            <Link href="/en/network" className="text-sm font-bold text-[#1f6b5a] underline underline-offset-4">Explore the Network →</Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((role) => (
              <article key={role.title} className="rounded-xl border border-[#dce5e0] bg-white px-5 py-6">
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

      <section className="bg-white" aria-labelledby="en-knowledge-heading">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Open knowledge</p>
            <h2 id="en-knowledge-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#123b34]">Technical knowledge should be easier to find.</h2>
            <p className="mt-3 text-sm leading-7 text-[#52615b]">Explore standards, steel grades, tube shapes and theoretical weights. Public tools support early research without disclosing private RFQs or prices.</p>
          </div>
          <Link href="/en/knowledge" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl border border-[#b9c9c2] bg-white px-6 text-sm font-bold text-[#123b34] hover:bg-[#edf5f1]">Explore Steel Knowledge →</Link>
        </div>
      </section>

      <PublicContactSection locale="en" />

      <footer className="bg-[#f2f4f3]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-6 text-xs text-[#52615b] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/en/knowledge" className="font-semibold hover:text-[#173f35]">Knowledge</Link>
            <Link href="/en/network" className="font-semibold hover:text-[#173f35]">Network</Link>
            <Link href="/en/knowledge/tubes" className="font-semibold hover:text-[#173f35]">Weight calculator</Link>
            <Link href="/en/distinta" className="font-semibold hover:text-[#173f35]">RFQ builder</Link>
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
