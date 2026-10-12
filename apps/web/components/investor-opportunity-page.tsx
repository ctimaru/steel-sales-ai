import Link from "next/link";

type Locale = "it" | "en";

const sourceWorld = "https://worldsteel.org/data/annual-production-steel-data/";
const sourceEurope = "https://www.eurofer.eu/assets/european-steel-in-figures-2026/Steel-in-Figures-SIF-Final_printer.pdf";
const linkedIn = "https://www.linkedin.com/company/smart-steel-sales";

const copy = {
  it: {
    back: "Torna alla homepage", switch: "English",
    eyebrow: "Smart Steel Sales · SteelTech · B2B SaaS",
    title: "Investire nell’infrastruttura digitale della filiera dell’acciaio.",
    intro: "Un settore industriale essenziale, molte relazioni commerciali e processi ancora frammentati. Smart Steel Sales sta costruendo un livello operativo per aiutare produttori, commercianti, terzisti e utilizzatori a scoprirsi, creare RFQ, confrontare offerte e gestire conoscenza commerciale privata.",
    subtitle: "L’opportunità: modernizzare il lavoro commerciale, non vendere acciaio.",
    marketTitle: "Un’industria di grande scala. Un software verticale da costruire.",
    marketText: "I dati misurano la dimensione dell’industria siderurgica e il suo impatto economico: non rappresentano il mercato indirizzabile del software Smart Steel Sales, né ricavi o transazioni già acquisiti.",
    market: [
      { value: "1,85 mld t", label: "Produzione mondiale di acciaio grezzo nel 2025", source: "worldsteel", href: sourceWorld },
      { value: "125,8 mln t", label: "Produzione di acciaio grezzo UE nel 2025", source: "EUROFER", href: sourceEurope },
      { value: "€152 mld", label: "Valore aggiunto economico attribuito alla filiera siderurgica europea", source: "EUROFER", href: sourceEurope },
      { value: "20,7 mln t", label: "Produzione di acciaio grezzo in Italia nel 2025", source: "worldsteel", href: sourceWorld },
    ],
    howTitle: "Perché il problema merita attenzione",
    how: [
      { title: "Un processo ancora frammentato", body: "Specifiche tecniche, distinte, richieste di offerta e follow-up viaggiano tra email, fogli di calcolo e applicazioni separate. Questo aumenta il lavoro manuale e rende difficile ricostruire le decisioni." },
      { title: "L’utilità prima della rete", body: "Gli strumenti pubblici di calcolo e conoscenza offrono un primo valore. All’interno del workspace aziendale, il flusso RFQ e la memoria commerciale possono incentivare un utilizzo ripetuto." },
      { title: "Dalla richiesta alla relazione", body: "Il Network di aziende e le richieste multi-fornitore creano la possibilità di collegare domanda, offerte e storico commerciale. L’effetto rete è una tesi da validare sul campo, non un risultato già dimostrato." },
    ],
    modelTitle: "Un modello SaaS verticale con possibilità di espansione",
    modelText: "La strategia parte dall’Italia e da bisogni molto concreti: commercianti che gestiscono offerte e aziende che inviano RFQ. Il modello in valutazione combina strumenti pubblici, accesso gratuito controllato e funzionalità professionali a pagamento. Pricing, conversione, dimensione del mercato software (TAM/SAM/SOM) e metriche di adozione devono essere validati con il pilot e non vengono presentati qui come dati acquisiti.",
    steps: ["Italia: avvio focalizzato nella filiera acciaio e tubi", "Prodotto: workflow RFQ, procurement e memoria commerciale", "Europa: possibile espansione dopo la validazione del modello"],
    thesis: "Un’opportunità per investitori che conoscono B2B SaaS, vertical software, procurement e industria.",
    ctaTitle: "Vuoi esplorare il potenziale di Smart Steel Sales?",
    ctaText: "Cerchiamo un confronto con business angel, VC e partner strategici interessati alla digitalizzazione industriale. Richiedi il Business Plan riservato per approfondire strategia, ipotesi economiche, roadmap, rischi e obiettivi del progetto.",
    ctaButton: "Richiedi accesso al Business Plan", linkedin: "Profilo LinkedIn",
    contactHint: "Apriremo il tuo programma di posta. Indica nome, organizzazione e interesse; valutiamo individualmente le richieste. Nessun documento riservato viene pubblicato sul sito.",
    sourcesTitle: "Fonti e metodologia",
    sourcesText: "Produzione: dati 2025. Valore aggiunto: stima EUROFER 2026 dell’impatto economico del settore europeo. Questi valori non sono ricavi della piattaforma, né un TAM software calcolato.",
    disclaimer: "Informazioni descrittive: questa pagina non costituisce un’offerta pubblica di investimento.",
    privacy: "Privacy",
  },
  en: {
    back: "Back to homepage", switch: "Italiano",
    eyebrow: "Smart Steel Sales · SteelTech · B2B SaaS",
    title: "Invest in the digital infrastructure of the steel supply chain.",
    intro: "A strategically important industry, complex B2B relationships and fragmented commercial workflows. Smart Steel Sales is building an operational layer to help producers, traders, processors and industrial buyers discover one another, manage RFQs, compare quotations and retain private commercial knowledge.",
    subtitle: "The opportunity: digitize commercial work, not sell steel.",
    marketTitle: "An industrial market at scale. A vertical software opportunity to validate.",
    marketText: "The figures describe the steel industry's physical output and economic footprint. They are not Smart Steel Sales' software addressable market, company revenue or processed transaction volume.",
    market: [
      { value: "1.85bn t", label: "Global crude steel production in 2025", source: "worldsteel", href: sourceWorld },
      { value: "125.8m t", label: "EU crude steel production in 2025", source: "EUROFER", href: sourceEurope },
      { value: "€152bn", label: "Economic value added attributed to Europe's steel industry and its wider impact", source: "EUROFER", href: sourceEurope },
      { value: "20.7m t", label: "Italian crude steel production in 2025", source: "worldsteel", href: sourceWorld },
    ],
    howTitle: "Why this problem deserves attention",
    how: [
      { title: "Fragmented by default", body: "Technical specifications, bills of materials, supplier enquiries and follow-ups often live across email, spreadsheets and disconnected software. That creates repetitive work and weak visibility into commercial decisions." },
      { title: "Utility before network effects", body: "Public technical tools offer value before sign-up. Inside each company's private workspace, RFQ workflows and commercial memory can support repeated daily use." },
      { title: "From transactions to relationships", body: "Company discovery and multi-supplier RFQs could connect demand, quotations and commercial history over time. Network effects are a hypothesis we aim to validate, not an established outcome." },
    ],
    modelTitle: "A vertical SaaS model with room to expand",
    modelText: "Our Italy-first strategy starts with tangible problems: steel traders managing offers and buyers raising RFQs. The evolving model combines public utilities, controlled free access and potential paid professional capabilities. Pricing, conversion, software TAM/SAM/SOM and adoption remain subject to pilot validation; we do not present them as proven metrics.",
    steps: ["Italy: focused steel and tube industry entry", "Product: RFQ, procurement and commercial memory workflows", "Europe: potential expansion after product-market validation"],
    thesis: "Built for conversations with investors who understand vertical SaaS, procurement software and industrial markets.",
    ctaTitle: "Interested in exploring the Smart Steel Sales opportunity?",
    ctaText: "We welcome conversations with angels, venture capital firms and strategic partners interested in industrial software. Request access to our confidential Business Plan to examine the strategy, financial assumptions, roadmap, risks and milestones.",
    ctaButton: "Request Business Plan access", linkedin: "Visit our LinkedIn",
    contactHint: "This opens your email app. Include your name, organization and interest; we review requests individually. No confidential document is hosted publicly.",
    sourcesTitle: "Sources and scope",
    sourcesText: "Production refers to 2025. EUROFER's 2026 publication provides the European economic value-added estimate. These are industry context figures, not company revenues or a calculated software TAM.",
    disclaimer: "Informational content only; this page is not a public securities offering.",
    privacy: "Privacy",
  },
} as const;

export function InvestorOpportunityPage({ locale, contactHref }: { locale: Locale; contactHref: string }) {
  const c = copy[locale];
  const english = locale === "en";
  return (
    <main lang={locale} className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce5e0] pb-5">
          <Link href={english ? "/en" : "/"} className="text-sm font-bold text-[#123b34] hover:underline">← {c.back}</Link>
          <Link href={english ? "/investitori" : "/en/investors"} hrefLang={english ? "it" : "en"} className="rounded-lg border border-[#cbdcd4] bg-white px-3 py-2 text-sm font-semibold text-[#315d50]">{c.switch} ↗</Link>
        </header>

        <section aria-labelledby="investor-hero" className="py-12 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#276e58]">{c.eyebrow}</p>
          <h1 id="investor-hero" className="mt-4 max-w-[900px] text-4xl font-semibold leading-[1.12] tracking-tight text-[#123b34] sm:text-5xl">{c.title}</h1>
          <p className="mt-6 max-w-[860px] text-base leading-8 text-[#52615b] sm:text-lg">{c.intro}</p>
          <p className="mt-5 text-sm font-semibold text-[#1f6b5a]">{c.subtitle}</p>
        </section>

        <section aria-labelledby="investor-market-title" className="border-t border-[#dce5e0] py-10 sm:py-12">
          <div className="max-w-3xl">
            <h2 id="investor-market-title" className="text-2xl font-semibold tracking-tight text-[#123b34] sm:text-3xl">{c.marketTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-[#52615b]">{c.marketText}</p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.market.map((metric) => (
              <article key={metric.value} className="rounded-2xl border border-[#dce5e0] bg-white p-5">
                <p className="text-2xl font-bold tabular-nums tracking-tight text-[#123b34]">{metric.value}</p>
                <p className="mt-2 text-sm leading-6 text-[#52615b]">{metric.label}</p>
                <a href={metric.href} rel="noopener noreferrer" target="_blank" className="mt-4 inline-flex min-h-10 items-center text-xs font-semibold text-[#315c74] underline underline-offset-4 hover:text-[#123b34]">{metric.source} ↗</a>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="investor-why-title" className="border-t border-[#dce5e0] py-10 sm:py-12">
          <h2 id="investor-why-title" className="text-2xl font-semibold tracking-tight text-[#123b34] sm:text-3xl">{c.howTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {c.how.map((item, index) => (
              <article key={item.title} className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-6">
                <p className="text-xs font-bold text-[#1f6b5a]">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-[#123b34]">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#52615b]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="investor-model-title" className="rounded-2xl border border-[#cfe2d8] bg-[#eaf4ef] p-6 sm:p-8">
          <h2 id="investor-model-title" className="text-2xl font-semibold text-[#123b34]">{c.modelTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#43564f]">{c.modelText}</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {c.steps.map((step, index) => <li key={step} className="rounded-xl border border-[#cfe2d8] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#123b34]">{index + 1}. {step}</li>)}
          </ol>
        </section>

        <section aria-labelledby="investor-contact" className="mt-9 rounded-2xl bg-[#123b34] p-6 text-white sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#b4e0d0]">{c.thesis}</p>
          <h2 id="investor-contact" className="mt-3 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">{c.ctaTitle}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#dbeae4] sm:text-base">{c.ctaText}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a href={contactHref} aria-label={c.ctaButton} className="investor-plan-cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white bg-white px-5 py-3 text-center text-sm font-bold shadow-sm transition hover:bg-[#e6f3ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto">
              <span className="investor-plan-cta-label">{c.ctaButton}</span><span aria-hidden="true">↗</span>
            </a>
            <a href={linkedIn} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#91b4a5] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#235247] sm:w-auto">{c.linkedin} ↗</a>
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[#cbded5]">{c.contactHint}</p>
          <a href="mailto:hello@smartsteelsales.com" className="mt-1 inline-flex min-h-10 items-center text-xs font-semibold text-white underline underline-offset-4">hello@smartsteelsales.com</a>
        </section>

        <aside aria-label={c.sourcesTitle} className="mt-8 text-xs leading-6 text-[#52615b]">
          <h2 className="font-semibold text-[#123b34]">{c.sourcesTitle}</h2>
          <p>{c.sourcesText}</p>
          <p className="mt-2">{c.disclaimer}</p>
        </aside>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dce5e0] py-8 text-xs text-[#52615b]">
          <span>Smart Steel Sales · hello@smartsteelsales.com</span>
          <Link href="/privacy" className="underline underline-offset-4">{c.privacy}</Link>
        </footer>
      </div>
    </main>
  );
}
