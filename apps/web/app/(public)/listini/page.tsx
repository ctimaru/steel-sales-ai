import type { Metadata } from "next";
import Link from "next/link";

import { FocusPage, FocusPanel } from "@/components/focus-ui";
import { listPriceListsForRequest } from "@/lib/price-list-explorer-server";
import { absoluteUrl } from "@/lib/site";

type SearchParams = Promise<{ preview?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const internalPreview = params.preview === "1";

  return {
    title: "Listini interattivi acciaio e tubi",
    description:
      "Consulta listini siderurgici strutturati, filtra misure e applica uno sconto temporaneo per calcolare netto €/m e, dove disponibile, €/t.",
    alternates: {
      canonical: absoluteUrl("/listini"),
    },
    robots: internalPreview
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: "Listini interattivi · Smart Steel Sales",
      description:
        "Listini produttore strutturati con Base, Extra, sconto temporaneo, netto €/m e €/t governato.",
      url: absoluteUrl("/listini"),
      type: "website",
    },
  };
}

function formatDate(value: string | null) {
  if (!value) return "Data non indicata";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

export default async function PriceListsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const includeInternal = params.preview === "1";
  const lists = await listPriceListsForRequest(includeInternal);

  return (
    <FocusPage className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="rounded-3xl border border-[#244d43] bg-[#123d34] px-5 py-7 text-white sm:px-7 sm:py-9">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
          Listini
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          Dal PDF al prezzo utilizzabile.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#d8e5e0] sm:text-base">
          Consulta i listini produttore in forma strutturata, filtra le misure, calcola i prezzi e costruisci
          una Distinta pronta da copiare nell&apos;email commerciale. Con un account puoi anche salvarla e
          ritrovarla nello storico come snapshot immutabile.
        </p>
      </header>

      {includeInternal && lists.some((list) => list.is_internal_preview) ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anteprima interna attiva: puoi vedere versioni in review perché il tuo account dispone dei permessi
          Knowledge. Queste versioni non sono visibili al pubblico né indicizzabili.
        </div>
      ) : null}

      {lists.length === 0 ? (
        <FocusPanel muted>
          <p className="app-kicker">Pubblicazione governata</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Nessun listino pubblico disponibile al momento
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
            Smart Steel Sales pubblica un listino solo dopo aver verificato fonte, versione e permessi di
            ripubblicazione dei dati strutturati. Il motore interattivo è pronto; le versioni non approvate
            restano in area interna.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/knowledge/tubes"
              className="school-secondary-action"
            >
              Calcolo pesi
            </Link>
            <Link
              href="/knowledge"
              className="school-secondary-action"
            >
              Apri Scuola
            </Link>
          </div>
        </FocusPanel>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => {
            const readinessPct =
              list.item_count > 0
                ? Math.round((list.price_per_t_ready_count / list.item_count) * 100)
                : 0;
            const href =
              "/listini/" +
              list.version_id +
              (list.is_internal_preview ? "?preview=1" : "");

            return (
              <Link
                key={list.version_id}
                href={href}
                className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#9ebfb3] hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                      {list.list_code} · {formatDate(list.source_date)}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                      {list.list_name}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-[#66736e]">
                      {list.manufacturer_version_code}
                      {list.manufacturer_revision_code
                        ? " · " + list.manufacturer_revision_code
                        : ""}
                    </p>
                  </div>
                  {list.is_internal_preview ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                      Anteprima interna
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#173f35]">
                      Pubblico
                    </span>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-xs text-[#7a8781]">Articoli</p>
                    <p className="mt-1 text-lg font-semibold text-[#1d2824]">
                      {list.item_count.toLocaleString("it-IT")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-xs text-[#7a8781]">Con €/t governato</p>
                    <p className="mt-1 text-lg font-semibold text-[#1d2824]">
                      {readinessPct}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {list.shape_codes.slice(0, 4).map((shape) => (
                    <span
                      key={shape}
                      className="rounded-full border border-[#dce2df] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#66736e]"
                    >
                      {shape === "circular"
                        ? "Tondi"
                        : shape === "square"
                          ? "Quadri"
                          : shape === "rectangular"
                            ? "Rettangolari"
                            : "Profili speciali"}
                    </span>
                  ))}
                </div>

                <p className="mt-5 text-sm font-semibold text-[#173f35]">
                  Apri listino interattivo →
                </p>
              </Link>
            );
          })}
        </section>
      )}

      <FocusPanel>
        <p className="app-kicker">Come funziona</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">1. Filtra il prodotto</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Forma, grado, finitura, dimensione e spessore.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">2. Applica lo sconto</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Lo sconto temporaneo segue la regola commerciale del listino e non viene salvato.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">3. Crea la Distinta</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Inserisci metri, barre o tonnellate e ottieni totali e €/t medio ponderato.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1d2824]">4. Copia o salva</h2>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Incolla la tabella direttamente nell&apos;email oppure salvala in I miei calcoli.
            </p>
          </div>
        </div>
      </FocusPanel>
    </FocusPage>
  );
}
