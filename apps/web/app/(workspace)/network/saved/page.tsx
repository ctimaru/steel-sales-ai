import Link from "next/link";
import { redirect } from "next/navigation";

import { removeSavedNetworkCompany } from "@/app/(workspace)/network/actions";
import { getSavedNetworkCompanies } from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

export default async function SavedNetworkCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const { error, message } = await searchParams;
  const saved = await getSavedNetworkCompanies();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
            ← Torna alla directory
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">P4 · Interaction Layer</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Aziende salvate</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Questa lista è privata: un salvataggio non equivale a follow, connection, inquiry o segnale pubblico verso l’azienda.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {saved.length} salvate
        </span>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      {saved.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">Non hai ancora salvato aziende</p>
          <p className="mt-2 text-sm text-slate-500">Apri un Company Profile nel Network e usa “Salva azienda”.</p>
          <Link href="/network" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
            Esplora il Network
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {saved.map((item) => (
            <article key={item.network_company_id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{item.company.country_code}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{item.company.legal_name}</h2>
                  {item.company.trading_name ? <p className="mt-1 text-sm text-slate-500">{item.company.trading_name}</p> : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  {item.company.verification_status}
                </span>
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                  href={"/network/" + item.network_company_id}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
                >
                  Apri profilo
                </Link>
                <form action={removeSavedNetworkCompany}>
                  <input type="hidden" name="network_company_id" value={item.network_company_id} />
                  <button className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">
                    Rimuovi
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
