import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Investire in Smart Steel Sales | SteelTech B2B e Procurement Intelligence",
  description: "Scopri Smart Steel Sales, piattaforma SteelTech B2B per RFQ, procurement e intelligence commerciale nella filiera dell'acciaio. Contattaci per richiedere il Business Plan riservato.",
  alternates: { canonical: absoluteUrl("/investitori"), languages: { it: absoluteUrl("/investitori"), en: absoluteUrl("/en/investors"), "x-default": absoluteUrl("/en/investors") } },
  openGraph: { title: "Smart Steel Sales — Opportunità per investitori", description: "Procurement e intelligence B2B per il mercato dell'acciaio.", url: absoluteUrl("/investitori"), type: "website" },
};
export default function InvestorPage() {
  const contact = "mailto:hello@smartsteelsales.com?subject=" + encodeURIComponent("Richiesta accesso Business Plan — Smart Steel Sales");
  return <main lang="it" className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dce5e0] pb-5">
        <Link href="/" className="font-semibold text-[#123b34]">← Smart Steel Sales</Link>
        <Link href="/en/investors" hrefLang="en" className="text-sm font-semibold text-[#315d50]">English ↗</Link>
      </header>
      <section className="py-12 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#276e58]">Startup · SteelTech · B2B SaaS</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#123b34] sm:text-5xl">Investire nell’intelligence commerciale per l’industria dell’acciaio.</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#52615b]">Smart Steel Sales sviluppa una piattaforma B2B che collega scoperta delle aziende, strumenti tecnici, richieste di offerta e workflow di procurement. Il nostro obiettivo è rendere i processi commerciali dell’acciaio più organizzati, verificabili ed efficienti.</p>
      </section>
      <section aria-labelledby="thesis" className="grid gap-4 border-t border-[#dce5e0] py-10 sm:grid-cols-3">
        <h2 id="thesis" className="sr-only">Tesi di investimento</h2>
        <article className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h3 className="font-semibold text-[#123b34]">Il problema</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">RFQ, documenti e relazioni commerciali sono spesso frammentati tra email, file e sistemi separati.</p></article>
        <article className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h3 className="font-semibold text-[#123b34]">La soluzione</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">Uno spazio di lavoro privato con strumenti tecnici pubblici, flussi RFQ multi-fornitore e Network settoriale.</p></article>
        <article className="rounded-2xl border border-[#dce5e0] bg-white p-5"><h3 className="font-semibold text-[#123b34]">La direzione</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">Partiamo dalla filiera italiana con un prodotto progettato per espandersi ad altri mercati europei.</p></article>
      </section>
      <section aria-labelledby="investor-contact" className="rounded-2xl bg-[#123b34] p-6 text-white sm:p-10">
        <h2 id="investor-contact" className="text-2xl font-semibold">Vuoi investire o valutare il nostro Business Plan?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#dbeae4]">Il Business Plan e i materiali riservati non sono pubblici. Scrivici indicando nome, organizzazione e interesse: valuteremo individualmente le richieste di accesso. Nessuna registrazione obbligatoria.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={contact} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#123b34]">Richiedi accesso al Business Plan ↗</a>
          <a href="https://www.linkedin.com/company/smart-steel-sales" rel="noopener noreferrer" target="_blank" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#91b4a5] px-5 text-sm font-semibold">LinkedIn ↗</a>
        </div>
        <p className="mt-5 text-xs text-[#dbeae4]">Contatto diretto: hello@smartsteelsales.com · Non raccogliamo richieste attraverso form pubblici.</p>
      </section>
      <footer className="flex flex-wrap justify-between gap-3 py-8 text-xs text-[#52615b]"><span>Smart Steel Sales · hello@smartsteelsales.com</span><Link href="/privacy">Privacy</Link></footer>
    </div>
  </main>;
}
