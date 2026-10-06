import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
import { PublicNetworkRoleExplorer } from "@/components/public-network-role-explorer";
import { PublicCompanyLookup } from "@/components/public-company-lookup";
import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Smart Steel Sales — Il business network dell'acciaio",
  description:
    "Scuola, calcolo pesi, Crea distinta e verifica della tua azienda per chi lavora con acciaio e tubi. Il Network completo è un prodotto privato per aziende registrate.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Smart Steel Sales — Il business network dell'acciaio",
    description:
      "Scuola, strumenti buyer e company lookup pubblico; Network completo riservato alle aziende registrate.",
    url: absoluteUrl("/"),
    type: "website",
  },
};

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


export default async function PublicHomePage() {
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

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  }

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

      <header className="border-b border-[#dce2df] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/" />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigazione pubblica">
            <Link
              href="/knowledge"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Scuola
            </Link>
            <Link
              href="/knowledge/tubes?source=home&surface=header#calcolatore-pesi"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Calcolo pesi
            </Link>
            <Link
              href="/distinta"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Crea distinta
            </Link>
            <Link
              href="/azienda"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Trova azienda
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/knowledge/tubes?source=home&surface=quick_actions#calcolatore-pesi"
              className="hidden rounded-lg px-2 py-2 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35] sm:inline-flex md:hidden"
            >
              Calcolo pesi
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-[#d7dfdb] bg-white px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
            >
              Accedi
            </Link>
            <Link
              href="/register"
              className="platform-primary hidden rounded-lg px-4 py-2 text-sm font-semibold sm:inline-flex"
            >
              Registra azienda
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#244d43] bg-[#123d34] text-white">
        <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
            Smart Steel Sales · Utile anche senza account
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-[3.35rem]">
            Il business network dell’acciaio,
            <span className="block text-[#a9cbbf]">con strumenti che usi davvero.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#d8e5e0]">
            Calcola il peso dei tubi, crea una distinta da inviare ai fornitori, approfondisci norme e gradi oppure
            verifica se la tua azienda è già presente. Il Network completo resta privato per le aziende registrate.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/knowledge/tubes?source=home&surface=hero#calcolatore-pesi"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#438d7a] bg-[#438d7a] px-5 text-sm font-bold text-white hover:border-[#2d7967] hover:bg-[#2d7967]"
            >
              Calcolo pesi
            </Link>
            <Link
              href="/distinta"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/20 bg-transparent px-5 text-sm font-semibold text-white hover:bg-white/[0.08]"
            >
              Crea distinta
            </Link>
            <Link
              href="/azienda"
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#c6d8d1] hover:text-white"
            >
              Trova o rivendica la tua azienda
            </Link>
            <Link
              href="/knowledge"
              className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#c6d8d1] hover:text-white"
            >
              Apri Scuola →
            </Link>
          </div>
        </div>
      </section>

      <PublicNetworkRoleExplorer />

      <section className="border-b border-[#dce2df] bg-white">
        <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Scuola</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#1d2824]">
                Prima utilità, poi prodotto.
              </h2>
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
              Se il profilo è già presente puoi capire subito se è rivendicabile e continuare la registrazione senza creare duplicati.
            </p>
          </div>

          <div className="mt-6">
            <PublicCompanyLookup />
          </div>

          <p className="mt-4 max-w-3xl text-xs leading-5 text-[#718078]">
            La ricerca pubblica serve solo a riconoscere l&apos;identità aziendale. Non apre la directory Network
            e non espone dati commerciali, prezzi, email, offerte o ordini.
          </p>
        </div>
      </section>

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
            <Link href="/privacy" className="font-semibold hover:text-[#173f35]">Privacy</Link>
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
