import Link from "next/link";
import { ProductBrand } from "./product-brand";

const copy = {
  it: {
    home:"Homepage", language:"English", kicker:"SMART STEEL SALES · VISION 2027",
    title:"Costruiamo insieme il futuro dell’acciaio.",
    intro:"Un ecosistema digitale per connettere conoscenza tecnica, aziende e processi commerciali. Progettato per la filiera siderurgica, con l’intelligenza artificiale al servizio delle persone.",
    primary:"Scopri come partecipare", secondary:"Esplora gli strumenti", tools:"La base del progetto",
    product:[["Steel Knowledge","Norme, materiali e strumenti di calcolo per il lavoro quotidiano."],["Steel Network","Scoperta e conoscenza delle aziende della filiera."],["Commerciale","Distinte, richieste di offerta e memoria commerciale privata."]],
    future:"La direzione che stiamo costruendo", futureNote:"Visione di sviluppo: non tutte le funzionalità sono disponibili oggi.",
    vision:[["AI","Interpretare le richieste, con fonti e calcoli verificabili."],["Visual","Trasformare la conversazione in oggetti di lavoro comprensibili."],["Super Steel Buyer","Evolvere verso il sourcing assistito e, in prospettiva, il marketplace industriale."]],
    community:"Partecipa alla costruzione del progetto", communityNote:"Due percorsi distinti, senza impegni finanziari o commerciali.",
    partner:"Aziende e Founding Partners", partnerText:"Confrontiamoci sulle esigenze della tua azienda e sul futuro programma di accesso anticipato.", partnerCta:"Parliamo della tua azienda",
    investor:"Investitori", investorText:"Privati, imprenditori, gruppi industriali e fondi: scopri la strategia e il percorso riservato.", investorCta:"Informazioni per investitori",
    note:"Il programma Founding Partners è in preparazione. Il contatto non è una prenotazione, un abbonamento o un’offerta di investimento. Nessun pagamento richiesto.",
    privacy:"Privacy", mailSubject:"Interesse Founding Partners — Smart Steel Sales",
  },
  en: {
    home:"Home", language:"Italiano", kicker:"SMART STEEL SALES · VISION 2027",
    title:"Build the future of steel with us.",
    intro:"A digital ecosystem connecting technical knowledge, companies and commercial workflows. Designed for the steel supply chain, with artificial intelligence supporting people.",
    primary:"Explore ways to participate", secondary:"Explore our tools", tools:"The foundations of the project",
    product:[["Steel Knowledge","Standards, materials and calculation tools for everyday work."],["Steel Network","Discover and understand companies across the supply chain."],["Commercial workflows","Bills of materials, enquiries and private commercial memory."]],
    future:"The direction we are building", futureNote:"Product vision: not all capabilities are available today.",
    vision:[["AI","Interpret enquiries with verifiable sources and calculations."],["Visual","Turn conversations into understandable working objects."],["Super Steel Buyer","Evolve towards assisted sourcing and, eventually, an industrial marketplace."]],
    community:"Help shape the project", communityNote:"Two separate paths, without financial or commercial commitments.",
    partner:"Companies and Founding Partners", partnerText:"Discuss your company’s needs and our planned early access programme.", partnerCta:"Tell us about your company",
    investor:"Investors", investorText:"Individuals, entrepreneurs, industrial groups and funds: explore our strategy and confidential investor pathway.", investorCta:"Investor information",
    note:"The Founding Partners programme is in preparation. Contacting us is not a reservation, subscription or investment offer. No payment is requested.",
    privacy:"Privacy", mailSubject:"Founding Partners interest — Smart Steel Sales",
  },
} as const;

export function PublicProjectPage({locale}:{locale:"it"|"en"}) {
  const c=copy[locale], en=locale==="en";
  const home=en?"/en":"/";
  const investor=en?"/en/investors":"/investitori";
  const knowledge=en?"/en/knowledge":"/knowledge";
  const partnerHref="mailto:hello@smartsteelsales.com?subject="+encodeURIComponent(c.mailSubject);
  return (
    <main lang={locale} className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]" data-testid="mkt9b-public-project">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <ProductBrand href={home} compact />
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-[var(--brand-deep)]">
            <Link href={home} className="inline-flex min-h-11 items-center">{c.home}</Link>
            <Link href={en?"/progetto":"/en/project"} hrefLang={en?"it":"en"} className="inline-flex min-h-11 items-center">{c.language}</Link>
          </nav>
        </div>
      </header>
      <section className="relative isolate overflow-hidden bg-[var(--brand-deep)] text-white">
        <svg aria-hidden="true" viewBox="0 0 400 220" fill="none" stroke="currentColor" className="pointer-events-none absolute right-0 top-0 -z-10 w-3/4 opacity-20 sm:w-1/2">
          {[0,1,2,3,4,5,6].map(i=><g key={i} transform={`translate(${i*44} ${i%2*34})`}><path d="M10 125 L95 76 L95 23 L10 72 Z M10 72 L40 89 L125 40 L95 23 M40 89 L40 142 L125 93 L125 40 M10 125 L40 142"/><path d="M19 77 L31 84 L31 123 L19 116 Z"/></g>)}
        </svg>
        <div className="mx-auto max-w-[1160px] px-4 py-14 sm:px-6 sm:py-24">
          <p className="text-xs font-bold tracking-widest text-white">{c.kicker}</p>
          <h1 className="mt-5 max-w-3xl break-words text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{c.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white sm:text-lg">{c.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#partecipare" className="inline-flex min-h-12 items-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-[var(--brand-deep)]">{c.primary}</a>
            <Link href={knowledge} className="inline-flex min-h-12 items-center rounded-xl border border-white/50 px-5 py-3 text-sm font-semibold text-white">{c.secondary}</Link>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1160px] space-y-12 px-4 py-12 sm:px-6">
        <section aria-labelledby="project-tools">
          <h2 id="project-tools" className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.tools}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{c.product.map(([title,body])=><article key={title} className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-5"><h3 className="font-semibold text-[var(--brand-deep)]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p></article>)}</div>
        </section>
        <section aria-labelledby="project-vision" className="rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-8">
          <h2 id="project-vision" className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.future}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{c.futureNote}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">{c.vision.map(([title,body],i)=><article key={title} className="min-w-0 border-t-2 border-[var(--brand-primary)] pt-4"><p className="text-xs font-bold text-[var(--brand-deep)]">0{i+1}</p><h3 className="mt-2 text-xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p></article>)}</div>
        </section>
        <section id="partecipare" aria-labelledby="project-community" className="scroll-mt-8">
          <h2 id="project-community" className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.community}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{c.communityNote}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <article className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-7"><h3 className="text-xl font-semibold text-[var(--brand-deep)]">{c.partner}</h3><p className="mt-3 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{c.partnerText}</p><a href={partnerHref} className="public-primary-cta mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-bold">{c.partnerCta}</a></article>
            <article className="flex min-w-0 flex-col rounded-2xl border border-[var(--border)] bg-white p-5 sm:p-7"><h3 className="text-xl font-semibold text-[var(--brand-deep)]">{c.investor}</h3><p className="mt-3 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{c.investorText}</p><Link href={investor} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--brand-primary)] px-4 py-3 text-center text-sm font-bold text-[var(--brand-deep)]">{c.investorCta}</Link></article>
          </div>
          <p className="mt-4 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">{c.note} <Link href="/privacy" className="underline">{c.privacy}</Link></p>
        </section>
      </div>
    </main>
  );
}
