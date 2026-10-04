import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { PublicCompanyLookup } from "@/components/public-company-lookup";
import { publicIndexRobots } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Trova e rivendica la tua azienda",
  description:
    "Cerca la tua azienda per ragione sociale o Partita IVA e verifica se il profilo Smart Steel Sales è rivendicabile. Il Network completo resta privato.",
  alternates: {
    canonical: absoluteUrl("/azienda"),
  },
  robots: publicIndexRobots,
  openGraph: {
    title: "Trova la tua azienda · Smart Steel Sales",
    description:
      "Lookup pubblico minimale per verificare identità e claim della propria azienda, senza esporre il Network.",
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
          <ProductBrand href="/" />
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

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-[#7e8da1]">
          <Link href="/" className="hover:text-[#1a5144]">Smart Steel Sales</Link>
          <span className="mx-2">/</span>
          <span>Trova la tua azienda</span>
        </nav>

        <section className="mt-6 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div className="pt-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Company lookup · pubblico
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-[#1d2824] sm:text-5xl">
              Trova la tua azienda e verifica se puoi rivendicarla.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#66736e]">
              Smart Steel Sales usa una ricerca pubblica minimale per riconoscere l&apos;identità
              aziendale e avviare il claim. Non è una directory: prodotti, capability, mercati,
              contatti e filtri del Network restano riservati alle aziende abilitate.
            </p>

            <div className="mt-7 space-y-3">
              {[
                ["01", "Cerca", "Ragione sociale o Partita IVA."],
                ["02", "Verifica", "Controlla se il profilo è claimable, in verifica o già rivendicato."],
                ["03", "Rivendica", "Prosegui nel flusso governato di registrazione e verifica."],
              ].map(([step, title, body]) => (
                <div key={step} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf5f2] text-xs font-bold text-[#173f35]">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1d2824]">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[#66736e]">{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-[#dce2df] bg-white p-5">
              <p className="text-sm font-semibold text-[#1d2824]">
                Sei arrivato dalla Scuola?
              </p>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">
                Norme, gradi, pesi e dimensioni restano liberamente consultabili. Il claim serve
                a collegare il valore pubblico alla tua identità aziendale senza aprire il Network.
              </p>
              <Link
                href="/knowledge"
                className="mt-3 inline-flex text-xs font-semibold text-[#1a5144] underline decoration-[#b8d2c8] underline-offset-4"
              >
                Torna alla Scuola →
              </Link>
            </div>
          </div>

          <PublicCompanyLookup />
        </section>
      </div>
    </main>
  );
}
