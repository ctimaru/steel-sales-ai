import { PublicHomeNavigation } from "@/components/public-home-navigation";
import { PublicCinematicHero } from "@/components/public-cinematic-hero";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { PublicNetworkRoleExplorer } from "@/components/public-network-role-explorer";
import { DeferredPublicCompanyLookup } from "@/components/deferred-public-company-lookup";
import { PublicIntelligencePillars } from "@/components/public-intelligence-showcase";
import { PublicRegistrationTrust } from "@/components/public-registration-trust";
import { PublicContactSection } from "@/components/public-contact-section";
import { PublicPageLanguageSelector } from "@/components/calculator-page-language-selector";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Smart Steel Sales — Super Intelligence Ready per l’acciaio",
  description:
    "Intelligence commerciale per l’acciaio: distinte, RFQ multi-fornitore, confronto offerte, Scuola e Network privato per aziende registrate.",
  alternates: {
    canonical: absoluteUrl("/"),
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
    title: "Smart Steel Sales — Super Intelligence Ready per l’acciaio",
    description:
      "Strumenti pubblici, RFQ Hub e Network privato: più chiarezza per chi compra e vende acciaio.",
    url: absoluteUrl("/"),
    type: "website",
    locale: "it_IT",
  },
};

export const dynamic = "force-static";

const publicTools = [
  {
    label: "Calcolo pesi",
    description: "kg/m, peso barra e tonnellaggio.",
    href: "/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi",
  },
  {
    label: "Crea distinta",
    description: "Target €/t, €/m e copia pronta per l'email.",
    href: "/distinta",
  },
  {
    label: "Norme",
    description: "Standard, prodotti e riferimenti.",
    href: "/knowledge/norme",
  },
  {
    label: "Gradi",
    description: "Materiali, designazioni e collegamenti.",
    href: "/knowledge/gradi",
  },
] as const;


export default function PublicHomePage() {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Smart Steel Sales",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    description:
      "Piattaforma B2B per il settore acciaio e tubo con Scuola pubblica, company lookup e prodotti privati per aziende registrate.",
  };

  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Smart Steel Sales",
    url: absoluteUrl("/"),
  };

  return (
    <main className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
      />

      <header className="border-b border-[#234536] bg-[#071713] text-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          <div className="hidden min-w-0 sm:block">
            <ProductBrand href="/" inverse />
          </div>
          <div className="min-w-0 sm:hidden">
            <ProductBrand href="/" compact showDescriptor={false} markOnly />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <PublicPageLanguageSelector locale="it" surface="home"/>
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl px-2.5 text-sm font-semibold text-[#d0e7d9] hover:bg-[#193a2c] hover:text-white sm:px-3">
              Accedi
            </Link>
            <Link href="/register" className="platform-primary inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-3 text-xs font-semibold sm:px-4 sm:text-sm">
              <span className="sm:hidden">Registrati</span>
              <span className="hidden sm:inline">Registra azienda</span>
            </Link>
          </div>
        </div>

        <PublicHomeNavigation locale="it" theme="dark" />
      </header>

      <PublicCinematicHero locale="it" />

      <PublicNetworkRoleExplorer />

      <PublicIntelligencePillars />

      <section className="border-b border-[#dce2df] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Strumenti pubblici · senza account</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#1d2824]">
                Prima utilità, poi prodotto.
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#52615b]">
                Calcola, consulta o prepara una distinta. Puoi iniziare subito, senza registrarti.
              </p>
            </div>

            <div className="grid flex-1 gap-px overflow-hidden rounded-xl border border-[#dce2df] bg-[#dce2df] sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-4">
              {publicTools.map((tool) => (
                <Link
                  key={tool.label}
                  href={tool.href}
                  className="bg-white px-4 py-3.5 transition hover:bg-[#f7faf8]"
                >
                  <p className="text-sm font-semibold text-[#173f35]">{tool.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#66736e]">{tool.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="aziende" className="bg-[#f2f4f3]">
        <div className="mx-auto max-w-[920px] px-4 py-11 sm:px-6 sm:py-14 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">La tua azienda</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-[2rem]">
              Cercala per nome o Partita IVA.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Verifica se il profilo è rivendicabile. Se la tua azienda non compare, puoi comunque avviare una nuova richiesta di registrazione.
            </p>
          </div>

          <div className="mt-6">
            <DeferredPublicCompanyLookup />
          </div>

          <p className="mt-4 max-w-3xl text-xs leading-5 text-[#718078]">
            La ricerca pubblica serve solo a riconoscere l&apos;identità aziendale. Non apre la directory Network
            e non espone dati commerciali, prezzi, email, offerte o ordini.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl border border-[#b9c9c2] bg-white px-4 text-sm font-bold text-[#123b34] hover:border-[#1f6b5a] hover:bg-[#edf5f1]">
              Non trovi la tua azienda? Registrala →
            </Link>
            <Link href="/company-data" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#315c74] underline decoration-[#b8d2c8] underline-offset-4 hover:text-[#123b34]">
              Come gestiamo i dati aziendali
            </Link>
          </div>
        </div>
      </section>

      <PublicRegistrationTrust />

      <PublicContactSection locale="it" />

      <footer className="bg-[#f2f4f3]">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-4 px-4 py-6 text-xs text-[#718078] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi"
              className="font-semibold hover:text-[#173f35]"
            >
              Calcolo pesi
            </Link>
            <Link href="/knowledge" className="font-semibold hover:text-[#173f35]">Scuola</Link>
            <Link href="/distinta" className="font-semibold hover:text-[#173f35]">Crea distinta</Link>
            <Link href="/login" className="font-semibold hover:text-[#173f35]">Accedi</Link>
            <Link href="/register" className="font-semibold hover:text-[#173f35]">Registra azienda</Link>
                        <Link href="/investitori" className="font-semibold hover:text-[#173f35]">Investitori</Link>
            <a href="https://www.linkedin.com/company/smart-steel-sales" target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-[#173f35]">LinkedIn ↗</a>
            <a href="mailto:hello@smartsteelsales.com" className="font-semibold hover:text-[#173f35]">hello@smartsteelsales.com</a>
<Link href="/privacy" className="font-semibold hover:text-[#173f35]">Privacy</Link>
            <Link href="/company-data" className="font-semibold hover:text-[#173f35]">Dati aziendali</Link>
            <Link href="/cookies" className="font-semibold hover:text-[#173f35]">Cookie</Link>
            <Link href="/terms" className="font-semibold hover:text-[#173f35]">Termini</Link>
            <Link href="/legal" className="font-semibold hover:text-[#173f35]">Informazioni legali</Link>
          </div>
          <span>Smart Steel Sales · Built for the steel & tube industry.</span>
        </div>
      </footer>
    </main>
  );
}
