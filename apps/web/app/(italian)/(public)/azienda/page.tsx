import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { PublicCompanyLookup } from "@/components/public-company-lookup";
import { publicIndexRobots } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rivendica il profilo della tua azienda",
  description:
    "Trova la tua azienda e richiedi gratuitamente la gestione del profilo su Smart Steel Sales. Aggiorna descrizione, prodotti e lavorazioni per il Network dell’acciaio.",
  alternates: {
    canonical: absoluteUrl("/azienda"),
  },
  robots: publicIndexRobots,
  openGraph: {
    title: "Rivendica il profilo della tua azienda · Smart Steel Sales",
    description:
      "La tua azienda, raccontata da te. Cerca il profilo, richiedine la gestione e aggiorna i dati condivisi nel Network dell’acciaio.",
    url: absoluteUrl("/azienda"),
    type: "website",
  },
};

export default function PublicCompanyAcquisitionPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Smart Steel Sales",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Trova la tua azienda",
        item: absoluteUrl("/azienda"),
      },
    ],
  };

  return (
    <main className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <header className="border-b border-[#dce2df] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/" showDescriptor={false} />
          <nav className="flex items-center gap-2" aria-label="Navigazione pubblica">
            <Link
              href="/knowledge"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35] sm:inline-flex"
            >
              Scuola
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
            >
              Accedi
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs font-medium text-[#66736e]">
          <Link href="/" className="hover:text-[#1a5144]">Smart Steel Sales</Link>
          <span className="mx-2">/</span>
          <span>Trova la tua azienda</span>
        </nav>

        <section aria-labelledby="company-claim-title" className="mt-5 rounded-[28px] bg-[#123b34] p-4 sm:p-7 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:p-10">
          <div className="px-1 pb-5 pt-2 sm:px-2 sm:pb-7 lg:p-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b9d8c9]">
              Il tuo profilo aziendale
            </p>
            <h1 id="company-claim-title" className="mt-3 max-w-xl text-[1.75rem] font-semibold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-5xl">
              Rivendica il profilo della tua azienda.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#d6e5de] sm:text-base sm:leading-7">
              Aggiorna descrizione, prodotti e lavorazioni. Presenta ciò che fa la tua
              azienda alle altre imprese del Network dell&apos;acciaio.
            </p>
            <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-[#d6e5de] sm:mt-6 sm:text-sm">
              <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-[#b9d8c9]" aria-hidden="true">
                <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Rivendicazione e gestione del profilo gratuite.
            </p>
          </div>

          <PublicCompanyLookup />
        </section>

        <section aria-labelledby="company-claim-steps" className="py-9 sm:py-12">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">Dalla ricerca al tuo profilo</p>
            <h2 id="company-claim-steps" className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
              La tua azienda, raccontata da te.
            </h2>
          </div>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3 sm:gap-7">
            {[
              ["01", "Trova la tua azienda", "Cerca per ragione sociale o Partita IVA e seleziona il profilo corretto. Se non lo trovi, puoi richiederne uno nuovo."],
              ["02", "Richiedi la gestione", "Crea un account, conferma l’email e completa la richiesta. Verifichiamo che tu possa rappresentare l’azienda prima di abilitare le modifiche."],
              ["03", "Aggiorna il profilo", "Quando la richiesta è approvata, gestisci descrizione, prodotti, lavorazioni e contatti dall’area Profilo aziendale."],
            ].map(([step, title, body]) => (
              <li key={step} className="flex gap-3 border-t border-[#d7dfdb] pt-4 sm:block">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e4eee9] text-xs font-semibold text-[#173f35]">
                  {step}
                </span>
                <div className="sm:mt-3">
                  <h3 className="text-base font-semibold text-[#1d2824]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5d6a65]">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="company-profile-visibility" className="grid gap-6 rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">Una scheda, più valore</p>
            <h2 id="company-profile-visibility" className="mt-2 text-xl font-semibold tracking-tight text-[#1d2824]">
              I dati che aggiorni diventano la tua presentazione nel Network.
            </h2>
          </div>
          <div className="space-y-3 text-sm leading-6 text-[#5d6a65]">
            <p>
              Il profilo pubblicato è visibile alle aziende registrate con accesso al Network.
              Dall&apos;area di gestione puoi controllare la scheda e aggiornare le informazioni
              condivise, con gli stati di pubblicazione sempre distinti dalle bozze.
            </p>
            <p>
              La rivendicazione ti permette di gestire il profilo; la spunta di azienda verificata
              segue una verifica separata. I servizi Network PRO restano una scelta a parte.
            </p>
          </div>
        </section>

        <footer className="flex flex-col gap-3 py-7 text-xs leading-5 text-[#66736e] sm:flex-row sm:items-center sm:justify-between">
          <p>Norme, gradi, pesi e dimensioni sono disponibili nella Scuola.</p>
          <Link
            href="/knowledge"
            className="inline-flex font-semibold text-[#1a5144] underline decoration-[#b8d2c8] underline-offset-4"
          >
            Esplora la Scuola →
          </Link>
        </footer>
      </div>
    </main>
  );
}
