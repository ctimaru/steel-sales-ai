import type { Metadata } from "next";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import { PublicNetworkRoleExplorer } from "@/components/public-network-role-explorer";
import { DeferredPublicCompanyLookup } from "@/components/deferred-public-company-lookup";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Smart Steel Sales — Super Intelligence Ready per l’acciaio",
  description:
    "Intelligence commerciale per l’acciaio: distinte, RFQ multi-fornitore, confronto offerte, Scuola e Network privato per aziende registrate.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Smart Steel Sales — Super Intelligence Ready per l’acciaio",
    description:
      "Strumenti pubblici, RFQ Hub e Network privato: più chiarezza per chi compra e vende acciaio.",
    url: absoluteUrl("/"),
    type: "website",
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

      <header className="border-b border-[#dce5e0] bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <div className="hidden min-w-0 sm:block">
            <ProductBrand href="/" />
          </div>
          <div className="min-w-0 sm:hidden">
            <ProductBrand href="/" compact showDescriptor={false} />
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigazione pubblica">
            <Link href="#network" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Network
            </Link>
            <Link href="/knowledge" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Scuola
            </Link>
            <Link href="/knowledge/tubes?source=home&surface=header#calcolatore-pesi" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Calcolo pesi
            </Link>
            <Link href="/distinta" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Crea distinta
            </Link>
            <Link href="/azienda" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">
              Trova azienda
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-xl px-2.5 text-sm font-semibold text-[#36574c] hover:bg-[#f2f4f3] sm:px-3">
              Accedi
            </Link>
            <Link href="/register" className="platform-primary inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-3 text-xs font-semibold sm:px-4 sm:text-sm">
              <span className="sm:hidden">Registrati</span>
              <span className="hidden sm:inline">Registra azienda</span>
            </Link>
          </div>
        </div>

        <nav className="border-t border-[#edf1ee] lg:hidden" aria-label="Navigazione pubblica mobile">
          <div className="mx-auto flex max-w-[1180px] items-center gap-1 overflow-x-auto px-3 py-1.5 sm:px-5">
            <Link href="#network" className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">Network</Link>
            <Link href="/distinta" className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">Crea distinta</Link>
            <Link href="/knowledge" className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">Scuola</Link>
            <Link href="/knowledge/tubes?source=home&surface=header#calcolatore-pesi" className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">Calcolo pesi</Link>
            <Link href="/azienda" className="inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]">Trova azienda</Link>
          </div>
        </nav>
      </header>

      <section aria-labelledby="home-hero-title" className="relative isolate overflow-hidden border-b border-[#dce5e0] bg-[#f6f8f7]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-56 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(31,107,90,0.12),transparent_68%)]" />
        <div className="relative mx-auto grid max-w-[1180px] gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center lg:gap-12 lg:px-8 lg:py-20">
          <div className="max-w-[660px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#b9d7cb] bg-[#e6f3ed] px-3 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#123b34] sm:text-[11px]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#1f6b5a]" />
                Super Intelligence Ready
              </span>
              <span className="text-xs font-medium text-[#52615b]">Intelligence per l’industria steel &amp; tube</span>
            </div>

            <h1 id="home-hero-title" className="mt-6 max-w-[700px] text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#123b34] sm:text-[3.3rem] lg:text-[3.65rem]">
              L’intelligenza che connette
              <span className="block text-[#315c74]">il business dell’acciaio.</span>
            </h1>
            <p className="mt-5 max-w-[590px] text-base leading-7 text-[#475569] sm:text-lg sm:leading-8">
              Distinte tecniche, richieste d’offerta multi-fornitore, confronto delle offerte e relazioni di filiera: un ambiente progettato per chi acquista e vende acciaio.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/register" className="platform-primary inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-sm font-bold shadow-[0_8px_20px_rgba(18,59,52,0.10)]">
                Registra la tua azienda
                <span aria-hidden="true" className="ml-2">→</span>
              </Link>
              <Link href="/distinta" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#b9c9c2] bg-white px-6 text-sm font-bold text-[#123b34] hover:border-[#1f6b5a] hover:bg-[#edf5f1]">
                Crea distinta gratis
              </Link>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#52615b]">
              Strumenti pubblici senza account. Le funzioni aziendali richiedono registrazione e approvazione.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#dbe6df] pt-5 text-xs font-semibold text-[#1f6b5a]">
              <span className="font-medium text-[#52615b]">Utile anche senza account</span>
              <Link href="/knowledge/tubes?source=home&surface=hero#calcolatore-pesi" className="underline decoration-[#a9c8bb] underline-offset-4 hover:text-[#123b34]">Calcolo pesi</Link>
              <Link href="/knowledge" className="underline decoration-[#a9c8bb] underline-offset-4 hover:text-[#123b34]">Apri Scuola</Link>
              <Link href="/azienda" className="underline decoration-[#a9c8bb] underline-offset-4 hover:text-[#123b34]">Trova o rivendica la tua azienda</Link>
            </div>
          </div>

          <div className="relative min-w-0" aria-label="Esempio illustrativo del flusso commerciale Smart Steel Sales">
            <div aria-hidden="true" className="absolute -inset-3 rounded-[32px] border border-[#dbe8e1] bg-white/30 sm:-inset-5" />
            <div className="relative overflow-hidden rounded-[24px] border border-[#cbd9d2] bg-white shadow-[0_20px_60px_rgba(18,59,52,0.10)]">
              <div className="flex items-center justify-between gap-3 bg-[#123b34] px-5 py-4 text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#bdd9ce]">Smart Steel Sales</p>
                  <p className="mt-1 text-sm font-semibold">Dal bisogno alla decisione</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold text-[#e1eee8]">Anteprima</span>
              </div>

              <div className="space-y-3 p-4 sm:p-5">
                <div className="flex gap-3 rounded-2xl border border-[#dce5e0] bg-[#f8faf9] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ddf5ec] text-xs font-extrabold text-[#123b34]">01</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#123b34]">Distinta tecnica</p>
                    <p className="mt-1 text-xs leading-5 text-[#52615b]">Materiale, norme, misure e quantità in un unico punto.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-[#dce5e0] bg-[#f8faf9] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f0f4] text-xs font-extrabold text-[#315c74]">02</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#123b34]">RFQ multi-fornitore</p>
                    <p className="mt-1 text-xs leading-5 text-[#52615b]">Richieste e risposte organizzate, con tracciabilità.</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-2xl border border-[#dce5e0] bg-[#f8faf9] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5ece5] text-xs font-extrabold text-[#895028]">03</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#123b34]">Confronto offerte</p>
                    <p className="mt-1 text-xs leading-5 text-[#52615b]">Elementi commerciali confrontabili per decidere.</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-[#e1eae5] bg-[#f8faf9] px-5 py-3 text-xs font-medium text-[#52615b]">
                Flusso illustrativo · L’AI assiste, la decisione resta alle persone.
              </div>
            </div>
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
            <DeferredPublicCompanyLookup />
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
