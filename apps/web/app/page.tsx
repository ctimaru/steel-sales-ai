import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
import { PublicCompanyLookup } from "@/components/public-company-lookup";
import { absoluteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Smart Steel Sales — Il business network dell'acciaio",
  description:
    "Scuola, strumenti tecnici e verifica della tua azienda per chi lavora con acciaio e tubi. Il Network completo è un prodotto privato per aziende registrate.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Smart Steel Sales — Il business network dell'acciaio",
    description:
      "Scuola, strumenti tecnici e company lookup pubblico; Network completo riservato alle aziende registrate.",
    url: absoluteUrl("/"),
    type: "website",
  },
};

const schoolCards = [
  {
    eyebrow: "Pesi & dimensioni",
    title: "Calcola e verifica i tubi",
    description:
      "Peso al metro, famiglie dimensionali e riferimenti per tubi tondi, quadri e rettangolari.",
    href: "/knowledge/tubes",
    action: "Apri strumenti",
  },
  {
    eyebrow: "Norme",
    title: "Capisci cosa disciplina ogni standard",
    description:
      "Consulta il catalogo pubblico e passa rapidamente dalla norma ai prodotti e ai gradi collegati.",
    href: "/knowledge/norme",
    action: "Esplora norme",
  },
  {
    eyebrow: "Gradi",
    title: "Leggi materiali e designazioni",
    description:
      "Significato delle sigle, numeri materiale, applicazioni e collegamenti agli standard.",
    href: "/knowledge/gradi",
    action: "Esplora gradi",
  },
] as const;

const companyTypes = [
  {
    title: "Produttori",
    body: "Acciaierie, tubifici e produttori di prodotti siderurgici.",
  },
  {
    title: "Commercianti",
    body: "Stockholder, distributori e specialisti della vendita.",
  },
  {
    title: "Terzisti",
    body: "Centri servizio, lavorazioni, taglio, finitura e trasformazione.",
  },
  {
    title: "Utilizzatori",
    body: "Carpenterie e industrie che acquistano e trasformano acciaio.",
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
        <div className="mx-auto flex min-h-16 max-w-[1180px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <ProductBrand href="/" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigazione pubblica">
            <Link
              href="/knowledge"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Scuola
            </Link>
            <Link
              href="/knowledge/tubes?source=home&surface=header#calcolatore-pesi"
              className="rounded-xl bg-[#edf5f2] px-3 py-2 text-sm font-bold text-[#173f35] hover:bg-[#d9e8e2]"
            >
              Calcolatore
            </Link>
            <a
              href="#aziende"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Aziende
            </a>
            <a
              href="#network"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f2f4f3] hover:text-[#173f35]"
            >
              Network
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/knowledge/tubes?source=home&surface=quick_actions#calcolatore-pesi"
              className="inline-flex rounded-xl bg-[#173f35] px-3 py-2 text-sm font-bold text-white md:hidden"
            >
              Calcola
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
            >
              Accedi
            </Link>
            <Link
              href="/register"
              className="platform-primary hidden rounded-xl px-4 py-2 text-sm font-semibold sm:inline-flex"
            >
              Registra azienda
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-[#dce2df] bg-[#123d34] text-white">
        <div className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">Smart Steel Sales · Utile anche senza account</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-5xl">
            Il business network dell’acciaio
            <span className="block text-[#9cc5b7]">parte da uno strumento utile.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#d8e5e0]">
            Parti da uno strumento utile: calcola il peso dei tubi, consulta norme e gradi oppure verifica se la tua azienda è già presente.
            Il Network completo e la Commercial Memory restano prodotti privati per le aziende registrate.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/knowledge/tubes?source=home&surface=hero#calcolatore-pesi"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#173f35] hover:bg-[#edf5f2]"
            >
              Calcola peso tubo
            </Link>
            <Link
              href="/azienda"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-5 text-sm font-semibold text-white hover:bg-white/[0.1]"
            >
              Trova o rivendica la tua azienda
            </Link>
            <Link
              href="/knowledge"
              className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-[#c6d8d1] hover:text-white"
            >
              Apri Scuola →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Scuola</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
            Prima utilità, poi prodotto.
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#66736e] sm:text-base">
            Smart Steel Sales deve meritare una visita prima ancora di chiederti una registrazione.
            Per questo norme, gradi, pesi e dimensioni sono pubblici e direttamente utilizzabili.
          </p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {schoolCards.map((card, index) => (
            <Link
              key={card.title}
              href={
                index === 0
                  ? "/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi"
                  : card.href
              }
              className={
                index === 0
                  ? "rounded-[24px] border border-[#9fbfb3] bg-[#f7fbf9] p-6 shadow-[0_12px_36px_rgba(18,61,52,0.06)] transition hover:border-[#438d7a]"
                  : "rounded-[24px] border border-[#dce2df] bg-white p-6 transition hover:border-[#b8d2c8] hover:shadow-[0_12px_36px_rgba(18,61,52,0.06)]"
              }
            >
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#1a5144]">{card.eyebrow}</p>
              <h3 className="mt-3 text-xl font-semibold text-[#1d2824]">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">{card.description}</p>
              <p className="mt-5 text-xs font-semibold text-[#1a5144]">
                {index === 0 ? "Calcola ora" : card.action} <span aria-hidden="true">→</span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section id="aziende" className="border-y border-[#dce2df] bg-white">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">La tua azienda</p>
            <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
              Cercala per nome o Partita IVA.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#66736e] sm:text-base">
              La ricerca pubblica serve solo a riconoscere l&apos;identità aziendale e capire se il
              profilo è rivendicabile. Non apre la directory Network né espone dati commerciali
              arricchiti.
            </p>

            <div className="mt-6 space-y-3">
              {[
                ["01", "Trova", "Ragione sociale o Partita IVA."],
                ["02", "Verifica", "Claim disponibile, in verifica o già rivendicato."],
                ["03", "Registrati", "Completa il claim e accedi ai prodotti privati SSS."],
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
          </div>

          <PublicCompanyLookup />
        </div>
      </section>

      <section id="network" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Network</p>
              <span className="rounded-full bg-[#173f35] px-2.5 py-1 text-[10px] font-bold text-white">
                Privato · Premium
              </span>
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
              La filiera dell&apos;acciaio, organizzata per trovare chi ti serve.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#66736e] sm:text-base">
              Dopo la registrazione, il Network diventa uno dei prodotti premium di Smart Steel Sales:
              directory ricca, filtri avanzati, prodotti, capability, mercati e relazioni B2B. La ricerca
              pubblica della propria azienda non sostituisce questo asset.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
            >
              Accedi
            </Link>
            <Link
              href="/register"
              className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold"
            >
              Registrati per Smart Steel Sales
            </Link>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {companyTypes.map((type) => (
            <article key={type.title} className="rounded-[24px] border border-[#dce2df] bg-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf5f2] text-sm font-bold text-[#173f35]">
                {type.title.slice(0, 1)}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1d2824]">{type.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">{type.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#1d2824] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">Trust by design</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              Il profilo pubblico non è la tua Commercial Memory.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#cfddd8]">
              Scuola e lookup dell&apos;identità aziendale sono pubblici. Network e Commercial Memory
              restano prodotti privati con livelli di accesso separati.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["Pubblico", "Scuola + lookup minimale dell'identità aziendale."],
              ["Network", "Directory, filtri e intelligence B2B · privato e premium."],
              ["Commercial Memory", "Email, prezzi, offerte, ordini e documenti · privati al tenant."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-2 text-xs leading-5 text-[#b9cec6]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#dce2df] bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 py-6 text-xs text-[#7b8782] sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/knowledge/tubes?source=home&surface=school_section#calcolatore-pesi" className="font-semibold hover:text-[#173f35]">Calcolatore</Link>
            <Link href="/knowledge" className="font-semibold hover:text-[#173f35]">Scuola</Link>
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
