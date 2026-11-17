import { HomeCinematicTools } from "@/components/home-cinematic-tools";
import { PublicHomeHeader } from "@/components/public-home-header";
import { PublicCinematicHero } from "@/components/public-cinematic-hero";
import { HomeFloatingTools } from "@/components/home-floating-tools";
import { PublicSteelGeometryProof } from "@/components/public-steel-geometry-proof";
import cineStyles from "@/components/public-cinematic-continuity.module.css";
import mobilePolish from "@/components/home-mobile-polish.module.css";
import type { Metadata } from "next";
import Link from "next/link";

import { PublicNetworkRoleExplorer } from "@/components/public-network-role-explorer";
import { DeferredPublicCompanyLookup } from "@/components/deferred-public-company-lookup";
import { PublicIntelligencePillars } from "@/components/public-intelligence-showcase";
import { PublicRegistrationTrust } from "@/components/public-registration-trust";
import { PublicContactSection } from "@/components/public-contact-section";
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
// HOME-NETPRO-PUBLIC1: regenerate at most hourly so the Network totals stay fresh.
export const revalidate = 3600;

// HOME-MOBILE-B6: rendered inside the geometry section (the former separate tools shelf).
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


// HOME-MOBILE-A4: 44px tap targets in a two-column grid on phones; inline row from sm.
const footerLink = "inline-flex min-h-11 items-center font-semibold hover:text-[#173f35] sm:min-h-0";

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
    <main className={`${mobilePolish.home} min-h-screen bg-[#f2f4f3] text-[#1d2824]`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
      />

      <PublicHomeHeader locale="it" />

      <PublicCinematicHero locale="it" />

      <HomeFloatingTools locale="it" />

      <PublicNetworkRoleExplorer />

      <PublicIntelligencePillars />

      <HomeCinematicTools locale="it" />

      <PublicSteelGeometryProof locale="it" tools={publicTools} />


      <section id="aziende" className={cineStyles.companySection}>
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

          <div className={`${cineStyles.companyLookup} mt-6`}>
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
          <div className="grid grid-cols-2 gap-x-4 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
            <Link
              href="/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi"
              className={footerLink}
            >
              Calcolo pesi
            </Link>
            <Link href="/knowledge" className={footerLink}>Scuola</Link>
            <Link href="/distinta" className={footerLink}>Crea distinta</Link>
            <Link href="/login" className={footerLink}>Accedi</Link>
            <Link href="/register" className={footerLink}>Registra azienda</Link>
            <Link href="/investitori" className={footerLink}>Investitori</Link>
            <a href="https://www.linkedin.com/company/smart-steel-sales" target="_blank" rel="noopener noreferrer" className={footerLink}>LinkedIn ↗</a>
            <a href="mailto:hello@smartsteelsales.com" className={`${footerLink} max-sm:col-span-2`}>hello@smartsteelsales.com</a>
            <Link href="/privacy" className={footerLink}>Privacy</Link>
            <Link href="/company-data" className={footerLink}>Dati aziendali</Link>
            <Link href="/cookies" className={footerLink}>Cookie</Link>
            <Link href="/terms" className={footerLink}>Termini</Link>
            <Link href="/legal" className={footerLink}>Informazioni legali</Link>
          </div>
          <span>Smart Steel Sales · Built for the steel & tube industry.</span>
        </div>
      </footer>
    </main>
  );
}
