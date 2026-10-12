import Link from "next/link";

import { FocusHeader, FocusPage, FocusPanel } from "@/components/focus-ui";
import { listPriceListsForRequest } from "@/lib/price-list-explorer-server";
import { appRoutes } from "@/lib/routes";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novità · Private Lab",
  robots: {
    index: false,
    follow: false,
  },
};

const PADANA_VERSION_ID = "31c762b0-2d20-480f-aa87-dd63e33db945";

function formatDate(value: string | null) {
  if (!value) return "28/09/2026";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

function isPadanaList(list: {
  list_name: string;
  list_code: string;
  manufacturer_version_code: string;
}) {
  return /padana|ptc\s*18|18[\/-]09[\/-]2026/i.test(
    [list.list_name, list.list_code, list.manufacturer_version_code].join(" "),
  );
}

export default async function PlatformNovitaPage() {
  await requirePlatformSuperadmin();
  const lists = await listPriceListsForRequest(true);
  const padana = lists.find(isPadanaList) ?? null;
  const otherInternalLists = lists.filter(
    (list) => list.is_internal_preview && !isPadanaList(list),
  );

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="NOV1 · Private Lab"
        title="Novità"
        description="Area privata della Platform Console per usare subito funzioni e contenuti ancora in prova, senza passare dalle route pubbliche."
      />

      <section className="rounded-3xl border border-[#8fb6a8] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Prima prova · Padana Tubi
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              {padana?.list_name ?? "Padana Tubi — PTC"}
            </h2>
            <p className="mt-1 text-sm text-[#66736e]">
              {padana?.manufacturer_version_code ?? "PTC 18/2026"} · {formatDate(padana?.source_date ?? "2026-09-28")}
            </p>
          </div>
          <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#173f35]">
            Privato · disponibile
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#7a8781]">Articoli strutturati</p>
            <p className="mt-1 text-lg font-semibold text-[#1d2824]">
              {(padana?.item_count ?? 1828).toLocaleString("it-IT")}
            </p>
          </div>
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#7a8781]">Stato</p>
            <p className="mt-1 text-lg font-semibold text-[#1d2824]">
              {padana?.version_status ?? "review"}
            </p>
          </div>
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#7a8781]">Visibilità</p>
            <p className="mt-1 text-lg font-semibold text-[#1d2824]">Private Lab</p>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#66736e]">
          Questo accesso non passa più dalla pagina pubblica dei listini. Il listino viene aperto direttamente
          dentro la Platform Console, con filtri, sconto, prezzi €/m e €/t, Distinta e funzioni già sviluppate.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={appRoutes.platform.novitaPriceList(padana?.version_id ?? PADANA_VERSION_ID)}
            className="school-primary-action"
          >
            Apri listino Padana
          </Link>
          <Link href="/platform" className="school-secondary-action">
            Torna alla Platform
          </Link>
        </div>
      </section>

      {otherInternalLists.length > 0 ? (
        <FocusPanel>
          <p className="app-kicker">Altre prove disponibili</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {otherInternalLists.map((list) => (
              <Link
                key={list.version_id}
                href={appRoutes.platform.novitaPriceList(list.version_id)}
                className="rounded-2xl border border-[#dce2df] bg-white p-4 hover:border-[#9ebfb3]"
              >
                <p className="text-sm font-semibold text-[#1d2824]">{list.list_name}</p>
                <p className="mt-1 text-xs text-[#66736e]">{list.manufacturer_version_code}</p>
              </Link>
            ))}
          </div>
        </FocusPanel>
      ) : null}

      <FocusPanel muted>
        <p className="app-kicker">Private Lab</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          L’area resta dentro la Platform Console e non è indicizzata. Non dipende più dallo stato di pubblicazione
          pubblica del listino.
        </p>
      </FocusPanel>
    </FocusPage>
  );
}
