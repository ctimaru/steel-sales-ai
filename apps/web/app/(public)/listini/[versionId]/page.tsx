import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrivateDiscountProfilesPanel } from "@/components/private-discount-profiles-panel";
import { PublicPriceListExplorer } from "@/components/public-price-list-explorer";
import {
  getPriceListExplorerItems,
  getPriceListExplorerVersion,
  getPrivatePricingContext,
} from "@/lib/price-list-explorer-server";
import { absoluteUrl } from "@/lib/site";

type Params = Promise<{ versionId: string }>;
type SearchParams = Promise<{ preview?: string }>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatDate(value: string | null) {
  if (!value) return "Data non indicata";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { versionId } = await params;
  const query = await searchParams;
  const includeInternal = query.preview === "1";

  if (!isUuid(versionId)) {
    return {
      title: "Listino non disponibile",
      robots: { index: false, follow: false },
    };
  }

  const version = await getPriceListExplorerVersion(versionId, includeInternal);
  if (!version) {
    return {
      title: "Listino non disponibile",
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = "/listini/" + version.version_id;
  return {
    title: version.list_name + " · " + version.manufacturer_version_code,
    description:
      "Listino interattivo " +
      version.list_name +
      ": filtra articoli, applica uno sconto temporaneo e calcola netto €/m e €/t dove il peso è governato.",
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    robots: version.is_internal_preview
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: version.list_name + " · " + version.manufacturer_version_code,
      description:
        "Listino produttore strutturato con Base, Extra, sconto temporaneo, netto €/m e €/t governato.",
      url: absoluteUrl(canonicalPath),
      type: "website",
    },
  };
}

export default async function PriceListExplorerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { versionId } = await params;
  const query = await searchParams;
  const includeInternal = query.preview === "1";

  if (!isUuid(versionId)) notFound();

  const [version, items, privatePricing] = await Promise.all([
    getPriceListExplorerVersion(versionId, includeInternal),
    getPriceListExplorerItems(versionId, includeInternal),
    getPrivatePricingContext(versionId),
  ]);

  if (!version) notFound();

  const readyPct =
    version.item_count > 0
      ? Math.round((version.price_per_t_ready_count / version.item_count) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 px-3 py-5 sm:px-5 sm:py-7 lg:px-6">
      <nav className="text-xs font-semibold text-[#66736e]" aria-label="Breadcrumb">
        <Link href="/listini" className="hover:text-[#173f35]">
          Listini
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#1d2824]">{version.manufacturer_version_code}</span>
      </nav>

      {version.is_internal_preview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anteprima interna · questa versione è in stato <strong>{version.version_status}</strong> e non è
          visibile né indicizzabile per il pubblico.
        </div>
      ) : null}

      <header className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              {version.list_code} · {formatDate(version.source_date)}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824] sm:text-4xl">
              {version.list_name}
            </h1>
            <p className="mt-2 text-base font-medium text-[#52615b]">
              {version.manufacturer_version_code}
              {version.manufacturer_revision_code
                ? " · " + version.manufacturer_revision_code
                : ""}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#66736e]">
              Il listino applica esclusivamente la formula commerciale strutturata per questa versione.
              Puoi usare uno sconto temporaneo oppure, con un account aziendale, applicare profili sconto
              privati salvati per produttore, listino, versione, grado o finitura.
            </p>
          </div>

          <div className="grid min-w-[260px] grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-xs text-[#7a8781]">Articoli</p>
              <p className="mt-1 text-xl font-semibold text-[#1d2824]">
                {version.item_count.toLocaleString("it-IT")}
              </p>
            </div>
            <div className="rounded-xl bg-[#edf5f2] p-3">
              <p className="text-xs text-[#527268]">€/t disponibile</p>
              <p className="mt-1 text-xl font-semibold text-[#173f35]">
                {readyPct}%
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#edf0ee] pt-4">
          {version.grade_codes.slice(0, 10).map((grade) => (
            <span
              key={grade}
              className="rounded-full border border-[#dce2df] bg-[#f8faf9] px-2.5 py-1 text-[10px] font-semibold text-[#596761]"
            >
              {grade}
            </span>
          ))}
        </div>
      </header>

      <PrivateDiscountProfilesPanel
        versionId={versionId}
        items={items}
        context={privatePricing}
      />

      <PublicPriceListExplorer
        version={version}
        items={items}
        privatePricing={privatePricing}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Formula commerciale
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Base scontata + Extra fisso
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Netto €/m = Base €/m × (1 − sconto) + Extra €/m. Il frontend non applica lo
            sconto all&apos;Extra quando il contratto del listino lo dichiara non scontabile.
          </p>
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Peso e €/t
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Nessun peso viene inventato
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Il prezzo €/t appare solo quando l&apos;articolo possiede un kg/m accettato nel layer
            governato. Se norma o geometria non sono risolte, il listino continua a funzionare
            in €/m e mostra esplicitamente il motivo dell&apos;assenza di €/t.
          </p>
        </div>
      </section>

      {version.source_terms_raw ? (
        <details className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8]">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#43524c]">
            Condizioni e note della fonte
          </summary>
          <div className="border-t border-[#e2e7e4] px-5 py-4 text-sm leading-6 text-[#66736e]">
            {version.source_terms_raw}
          </div>
        </details>
      ) : null}
    </div>
  );
}
