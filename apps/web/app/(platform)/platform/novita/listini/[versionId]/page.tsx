import Link from "next/link";

import { PrivateDiscountProfilesPanel } from "@/components/private-discount-profiles-panel";
import { PublicPriceListExplorer } from "@/components/public-price-list-explorer";
import { FocusHeader, FocusPage, FocusPanel } from "@/components/focus-ui";
import {
  getPrivateLabPriceListExplorerItems,
  getPrivateLabPriceListExplorerVersion,
  getPrivatePricingContext,
} from "@/lib/price-list-explorer-server";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Listino · Private Lab",
  robots: {
    index: false,
    follow: false,
  },
};

type Params = Promise<{ versionId: string }>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function PrivateLabPriceListPage({
  params,
}: {
  params: Params;
}) {
  const { versionId } = await params;

  if (!isUuid(versionId)) {
    return (
      <FocusPage>
        <FocusHeader
          eyebrow="NOV1 · Private Lab"
          title="Listino non valido"
          description="L’identificativo richiesto non è valido."
        />
        <FocusPanel>
          <Link href={appRoutes.platform.novita} className="school-primary-action">
            Torna a Novità
          </Link>
        </FocusPanel>
      </FocusPage>
    );
  }

  const [version, items, privatePricing] = await Promise.all([
    getPrivateLabPriceListExplorerVersion(versionId),
    getPrivateLabPriceListExplorerItems(versionId),
    getPrivatePricingContext(versionId),
  ]);

  if (!version) {
    return (
      <FocusPage>
        <FocusHeader
          eyebrow="NOV1 · Private Lab"
          title="Listino non disponibile"
          description="La versione richiesta non esiste nel Private Lab oppure non è disponibile per la Platform Console."
        />
        <FocusPanel>
          <p className="text-sm leading-6 text-[#66736e]">
            Il Private Lab ora usa RPC dedicate alla Platform Console e non dipende più dalle policy di pubblicazione del catalogo pubblico.
          </p>
          <div className="mt-4">
            <Link href={appRoutes.platform.novita} className="school-primary-action">
              Torna a Novità
            </Link>
          </div>
        </FocusPanel>
      </FocusPage>
    );
  }

  const readyPct =
    version.item_count > 0
      ? Math.round((version.price_per_t_ready_count / version.item_count) * 100)
      : 0;

  return (
    <FocusPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={appRoutes.platform.novita}
          className="text-sm font-semibold text-[#496159] hover:text-[#173f35]"
        >
          ← Novità
        </Link>
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
          Private Lab
        </span>
      </div>

      <header className="rounded-3xl border border-[#8fb6a8] bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          {version.list_code} · area privata
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1d2824] sm:text-4xl">
          {version.list_name}
        </h1>
        <p className="mt-2 text-base font-medium text-[#52615b]">
          {version.manufacturer_version_code}
          {version.manufacturer_revision_code ? " · " + version.manufacturer_revision_code : ""}
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#7a8781]">Articoli</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">
              {version.item_count.toLocaleString("it-IT")}
            </p>
          </div>
          <div className="rounded-xl bg-[#edf5f2] p-3">
            <p className="text-xs text-[#527268]">€/t disponibile</p>
            <p className="mt-1 text-xl font-semibold text-[#173f35]">{readyPct}%</p>
          </div>
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#7a8781]">Stato sorgente</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">
              {version.version_status}
            </p>
          </div>
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
    </FocusPage>
  );
}
