import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Invest in Smart Steel Sales | B2B SteelTech & Procurement Intelligence",
  description: "Discover Smart Steel Sales, a B2B SteelTech platform for RFQs, procurement and commercial intelligence. Contact us to request access to the confidential Business Plan.",
  alternates: { canonical: absoluteUrl("/en/investors"), languages: { it: absoluteUrl("/investitori"), en: absoluteUrl("/en/investors"), "x-default": absoluteUrl("/en/investors") } },
  openGraph: { title: "Smart Steel Sales — For investors", description: "B2B procurement and intelligence for the steel industry.", url: absoluteUrl("/en/investors"), type: "website" },
};
export default function InvestorPage() {
  const contact = "mailto:hello@smartsteelsales.com?subject=" + encodeURIComponent("Business Plan access request — Smart Steel Sales");
  return <main lang="en" className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dce5e0] pb-5">
        <Link href="/en" className="font-semibold text-[#123b34]">← Smart Steel Sales</Link>
        <Link href="/investitori" hrefLang="it" className="text-sm font-semibold text-[#315d50]">Italiano ↗</Link>
      </header>
      <section className="py-12 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#276e58]">Startup · SteelTech · B2B SaaS</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#123b34] sm:text-5xl">Invest in commercial intelligence for the steel industry.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#52615b]">Smart Steel Sales is building a B2B platform connecting company discovery, technical tools, requests for quotation and procurement workflows. Our goal is to make steel-sector commercial processes more organized, verifiable and efficient.</p>
      </section>
      <section aria-labelledby="thesis" className="grid gap-4 border-t border-[#dce5e0] py-10 sm:grid-cols-3">
        <h2 id="thesis" className="sr-only">Investment thesis</h2>
        <article className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h3 className="font-semibold text-[#123b34]">The challenge</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">RFQs, documentation and commercial relationships are often fragmented across emails, files and disconnected systems.</p></article>
        <article className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h3 className="font-semibold text-[#123b34]">Our approach</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">A private company workspace, public technical tools, multi-supplier RFQ workflows and industry network.</p></article>
        <article className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h3 className="font-semibold text-[#123b34]">Our direction</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">We begin in the Italian steel supply chain, designing for future European expansion.</p></article>
      </section>
      <section aria-labelledby="investor-contact" className="rounded-2xl bg-[#123b34] p-6 text-white sm:p-10">
        <h2 id="investor-contact" className="text-2xl font-semibold">Interested in investing or reviewing our Business Plan?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#dbeae4]">Our Business Plan and confidential materials are not public. Email us with your name, organization and investment interest; access requests are reviewed individually. No registration is required.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={contact} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#123b34]">Request Business Plan access ↗</a>
          <a href="https://www.linkedin.com/company/smart-steel-sales" rel="noopener noreferrer" target="_blank" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#91b4a5] px-5 text-sm font-semibold">LinkedIn ↗</a>
        </div>
        <p className="mt-5 text-xs text-[#dbeae4]">Direct email: hello@smartsteelsales.com · No public submission forms are used.</p>
      </section>
      <footer className="flex flex-wrap justify-between gap-3 py-8 text-xs text-[#52615b]"><span>Smart Steel Sales · hello@smartsteelsales.com</span><Link href="/privacy">Privacy</Link></footer>
    </div>
  </main>;
}
