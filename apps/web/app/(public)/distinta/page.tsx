import type { Metadata } from "next";
import Link from "next/link";

import { BuyerDistintaBuilder } from "@/components/buyer-distinta-builder";
import { buildBuyerDistintaCatalogOptions } from "@/lib/buyer-distinta-catalog";
import { listBuyerDistintaPublicDimensions } from "@/lib/public-knowledge";
import { absoluteUrl } from "@/lib/site";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Crea distinta per richiesta offerta acciaio e tubi",
  description:
    "Crea gratuitamente una distinta per i tuoi fornitori: articoli, quantità, kg/m, Target €/t opzionale e Target €/m. Copiala nell'email oppure accedi per salvarla e inviarla.",
  alternates: {
    canonical: absoluteUrl("/distinta"),
  },
  openGraph: {
    title: "Crea distinta · Smart Steel Sales",
    description:
      "Buyer tool gratuito per costruire richieste di offerta acciaio e tubi con Target €/t e Target €/m.",
    url: absoluteUrl("/distinta"),
    type: "website",
  },
};

export default async function BuyerDistintaPage() {
  const [supabase, publishedDimensions] = await Promise.all([
    createClient(),
    listBuyerDistintaPublicDimensions(),
  ]);
  const { data } = await supabase.auth.getUser();
  const catalogOptions = buildBuyerDistintaCatalogOptions(publishedDimensions);
  const authenticated = Boolean(data.user);
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="rounded-2xl border border-[var(--border-strong)] bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-primary)]">
              Buyer tool · gratuito
            </p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[var(--brand-deep)] sm:text-2xl">
              Crea distinta per i tuoi fornitori
            </h1>
            <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)] sm:text-sm">
              Tipo tubo → norma → grado → misura → richiesta. Nessun riferimento a listini produttore.
            </p>
          </div>
          <span className="rounded-full bg-[var(--brand-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand-deep)]">
            Compilazione libera · prezzo facoltativo
          </span>
        </div>
      </header>

      {authenticated ? (
        <aside className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--brand-primary-soft)] px-4 py-3" aria-label="Percorso RFQ aziendale">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--brand-deep)]">
              Questa è la distinta pubblica. La gestione aziendale si trova in RFQ Hub.
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              La bozza può essere ripresa nel Workspace dalla stessa scheda: il recupero è temporaneo e richiede conferma. Salva per conservarla nel tuo account.
            </p>
          </div>
          <Link
            href={appRoutes.rfqHub.createDistinta}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-[var(--brand-primary)] bg-white px-3 text-sm font-bold text-[var(--brand-deep)] hover:bg-[var(--surface-subtle)]"
          >
            Continua nel RFQ Hub →
          </Link>
        </aside>
      ) : null}

      <div className="mt-3">
        <BuyerDistintaBuilder
          authenticated={authenticated}
          emailConfigured={emailConfigured}
          catalogOptions={catalogOptions}
          userId={data.user?.id ?? null}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          Perché è utile
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">1. Standardizza la richiesta</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Tutti i fornitori ricevono la stessa distinta, con quantità e, se indicato, obiettivo prezzo leggibili.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">2. Evita conversioni manuali</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Se indichi Target €/t e kg/m ricaviamo il Target €/m senza fogli separati.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">3. Un solo invio, più fornitori</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Dopo il login puoi salvare la richiesta e preparare l'invio diretto a una lista di fornitori.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
