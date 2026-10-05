import type { Metadata } from "next";

import { PrivateDiscountProfilesPanel } from "@/components/private-discount-profiles-panel";
import { PublicPriceListExplorer } from "@/components/public-price-list-explorer";
import {
  getPriceListExplorerItems,
  getPriceListExplorerVersion,
  getPriceListPublicationReadiness,
  getPriceListPublicNotices,
  getPrivatePricingContext,
} from "@/lib/price-list-explorer-server";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prove & novità · Platform",
  robots: { index: false, follow: false, noarchive: true },
};

const PADANA_PTC18_VERSION_ID = "31c762b0-2d20-480f-aa87-dd63e33db945";

function formatDate(value: string | null) {
  if (!value) return "Data non indicata";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

export default async function PlatformLabsPage() {
  await requirePlatformSuperadmin();

  const [version, items, privatePricing, notices, readiness] = await Promise.all([
    getPriceListExplorerVersion(PADANA_PTC18_VERSION_ID, true),
    getPriceListExplorerItems(PADANA_PTC18_VERSION_ID, true),
    getPrivatePricingContext(PADANA_PTC18_VERSION_ID),
    getPriceListPublicNotices(PADANA_PTC18_VERSION_ID, true),
    getPriceListPublicationReadiness(PADANA_PTC18_VERSION_ID),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="platform-kicker">Prove & novità · Owner only</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
              Listini in prova
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Area privata della Platform Console per testare funzionalità non ancora pubblicate.
              Il listino Padana rimane interno: nessuna route pubblica, nessuna indicizzazione e nessun
              cambio automatico dello stato di pubblicazione.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
            Solo Platform Owner
          </div>
        </div>
      </section>

      {!version ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-900">
            Listino non disponibile
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Padana PTC 18/2026 non è leggibile dalla sessione Platform
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Il dataset non viene pubblicato per aggirare il problema: resta privato finché l&apos;accesso
            interno non è disponibile correttamente.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                  {version.list_code} · {formatDate(version.source_date)}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
                  {version.list_name} · {version.manufacturer_version_code}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
                  Questa è la stessa struttura dati costruita dal PDF Padana, resa qui direttamente dentro
                  la Platform Console per il test privato.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[#f7f9f8] px-3 py-3">
                  <p className="text-[10px] text-[#718078]">Articoli</p>
                  <p className="mt-1 text-lg font-bold text-[#1d2824]">
                    {version.item_count.toLocaleString("it-IT")}
                  </p>
                </div>
                <div className="rounded-xl bg-[#edf5f2] px-3 py-3">
                  <p className="text-[10px] text-[#527268]">€/m</p>
                  <p className="mt-1 text-lg font-bold text-[#173f35]">
                    {readiness?.metrics.price_per_m_ready.toLocaleString("it-IT") ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-[#edf5f2] px-3 py-3">
                  <p className="text-[10px] text-[#527268]">€/t</p>
                  <p className="mt-1 text-lg font-bold text-[#173f35]">
                    {readiness?.metrics.price_per_t_coverage_pct.toLocaleString("it-IT") ?? "—"}%
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#edf0ee] pt-4 text-[10px] font-semibold">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-900">
                {version.version_status}
              </span>
              <span className="rounded-full border border-[#dce2df] bg-[#f8faf9] px-2.5 py-1 text-[#596761]">
                {version.publication_scope}
              </span>
              <span className="rounded-full border border-[#dce2df] bg-[#f8faf9] px-2.5 py-1 text-[#596761]">
                {items.length.toLocaleString("it-IT")} righe caricate
              </span>
            </div>
          </section>

          {notices.length > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-[#fffaf0] p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900">
                Condizioni fonte non automatizzate
              </p>
              <div className="mt-3 grid gap-2">
                {notices.map((notice) => (
                  <div
                    key={notice.notice_code}
                    className="rounded-xl border border-amber-100 bg-white px-3 py-3"
                  >
                    <p className="text-xs font-bold text-[#43524c]">{notice.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#66736e]">{notice.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <PrivateDiscountProfilesPanel
            versionId={PADANA_PTC18_VERSION_ID}
            items={items}
            context={privatePricing}
          />

          <PublicPriceListExplorer
            version={version}
            items={items}
            privatePricing={privatePricing}
          />
        </>
      )}
    </div>
  );
}
