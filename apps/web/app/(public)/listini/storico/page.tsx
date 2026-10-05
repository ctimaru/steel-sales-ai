import type { Metadata } from "next";
import Link from "next/link";

import { FocusPage, FocusPanel } from "@/components/focus-ui";
import { getPricingSessionHistory } from "@/lib/price-list-explorer-server";

export const metadata: Metadata = {
  title: "I miei calcoli · Listini",
  robots: { index: false, follow: false },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default async function PricingHistoryPage() {
  const history = await getPricingSessionHistory();

  return (
    <FocusPage className="px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="app-kicker">Listini · I miei calcoli</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">
            Distinte salvate
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
            Ogni salvataggio conserva listino, pesi, sconti applicati, quantità e risultati esattamente
            come erano al momento del calcolo.
          </p>
        </div>
        <Link
          href="/listini"
          className="inline-flex min-h-10 items-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b] hover:text-[#173f35]"
        >
          ← Listini
        </Link>
      </div>

      {!history.authenticated ? (
        <FocusPanel className="mt-6">
          <p className="app-kicker">Accesso richiesto</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Accedi per vedere il tuo storico
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
            Le distinte salvate contengono prezzi e condizioni commerciali private e restano associate
            al tuo account aziendale.
          </p>
          <Link
            href={"/login?next=" + encodeURIComponent("/listini/storico")}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white"
          >
            Accedi
          </Link>
        </FocusPanel>
      ) : history.sessions.length === 0 ? (
        <FocusPanel className="mt-6" muted>
          <p className="app-kicker">Storico vuoto</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Non hai ancora salvato distinte
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Apri un listino, aggiungi gli articoli alla Distinta e usa “Salva distinta”.
          </p>
        </FocusPanel>
      ) : (
        <section className="mt-6 grid gap-3">
          {history.sessions.map((session) => (
            <Link
              key={session.id}
              href={"/listini/storico/" + session.id}
              className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#9ebfb3] hover:shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                    {formatDateTime(session.created_at)} · {session.pricing_mode}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-[#1d2824]">
                    {session.title}
                  </h2>
                  <p className="mt-1 text-xs text-[#718078]">
                    {session.list_name_snapshot} · {session.manufacturer_version_snapshot} ·{" "}
                    {session.line_count} {session.line_count === 1 ? "riga" : "righe"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-[10px] text-[#7a8781]">Metri</p>
                    <p className="mt-1 font-semibold text-[#1d2824]">
                      {formatNumber(session.total_meters, 2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-[10px] text-[#7a8781]">Tonnellate</p>
                    <p className="mt-1 font-semibold text-[#1d2824]">
                      {formatNumber(session.total_tonnes, 3)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#edf5f2] p-3">
                    <p className="text-[10px] text-[#527268]">Valore €</p>
                    <p className="mt-1 font-bold text-[#173f35]">
                      {formatNumber(session.total_value, 2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#edf5f2] p-3">
                    <p className="text-[10px] text-[#527268]">€/t medio</p>
                    <p className="mt-1 font-bold text-[#173f35]">
                      {formatNumber(session.weighted_average_eur_t, 2)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </FocusPage>
  );
}
