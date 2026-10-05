import Link from "next/link";

import { FocusHeader, FocusPage, FocusPanel } from "@/components/focus-ui";
import { listPriceListsForRequest } from "@/lib/price-list-explorer-server";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novità · Private Lab",
  robots: {
    index: false,
    follow: false,
  },
};

function formatDate(value: string | null) {
  if (!value) return "Data non indicata";
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
  const internalLists = lists
    .filter((list) => list.is_internal_preview)
    .sort((a, b) => Number(isPadanaList(b)) - Number(isPadanaList(a)));

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="NOV1 · Private Lab"
        title="Novità"
        description="Area privata del Platform Owner per provare funzionalità e contenuti prima di portarli nelle superfici definitive di Smart Steel Sales."
      />

      <FocusPanel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="app-kicker">Laboratorio privato</p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Listini strutturati in anteprima
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Qui compaiono soltanto versioni interne già leggibili dal motore PL1. Non vengono rese
              pubbliche, non sono indicizzabili e continuano a rispettare i controlli di accesso e la
              governance del catalogo listini.
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#cddbd6] bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
            Owner only
          </span>
        </div>
      </FocusPanel>

      {internalLists.length === 0 ? (
        <FocusPanel muted>
          <p className="app-kicker">Nessuna anteprima disponibile</p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Il laboratorio è attivo, ma non ci sono listini interni visibili
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Quando una versione entra nello scope di anteprima governata, apparirà qui automaticamente.
          </p>
        </FocusPanel>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {internalLists.map((list) => {
            const isPadana = isPadanaList(list);
            const readinessPct =
              list.item_count > 0
                ? Math.round((list.price_per_t_ready_count / list.item_count) * 100)
                : 0;

            return (
              <article
                key={list.version_id}
                className={[
                  "rounded-3xl border bg-white p-5 sm:p-6",
                  isPadana ? "border-[#8fb6a8] shadow-sm" : "border-[#dce2df]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                      {isPadana ? "Prima prova · Padana Tubi" : "Anteprima interna"}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                      {list.list_name}
                    </h2>
                    <p className="mt-1 text-sm text-[#66736e]">
                      {list.manufacturer_version_code} · {formatDate(list.source_date)}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    Privato
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-xs text-[#7a8781]">Articoli strutturati</p>
                    <p className="mt-1 text-lg font-semibold text-[#1d2824]">
                      {list.item_count.toLocaleString("it-IT")}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-xs text-[#7a8781]">€/t governato</p>
                    <p className="mt-1 text-lg font-semibold text-[#1d2824]">
                      {readinessPct}%
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-[#66736e]">
                  Lo sconto, la Distinta, i totali e gli eventuali warning di publication readiness
                  vengono gestiti dal listino interattivo esistente: questa pagina è soltanto il punto
                  di accesso privato alle novità.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={"/listini/" + list.version_id + "?preview=1"}
                    className="school-primary-action"
                  >
                    Apri listino strutturato
                  </Link>
                  <Link href="/platform" className="school-secondary-action">
                    Torna alla Platform
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <FocusPanel muted>
        <p className="app-kicker">Regola NOV1</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          La sezione Novità non è un canale pubblico: serve per testare asset già integrati nel prodotto
          prima di decidere dove collocarli definitivamente. L’accesso resta riservato al Platform Owner.
        </p>
      </FocusPanel>
    </FocusPage>
  );
}
