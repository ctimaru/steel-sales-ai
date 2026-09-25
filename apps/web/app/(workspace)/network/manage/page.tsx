import Link from "next/link";

import { updateManagedNetworkProfile } from "@/app/(workspace)/network/actions";
import { getManagedNetworkCompany } from "@/lib/network";

export default async function ManagedNetworkProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const managed = await getManagedNetworkCompany();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
          ← Torna alla directory
        </Link>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      {!managed ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Managed Network profile</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Nessun profilo azienda gestibile</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Per modificare un profilo Network servono contemporaneamente Organization Admin attivo,
            link organizzazione-azienda attivo e claim approvato.
          </p>
          <Link href="/network" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
            Cerca la tua azienda
          </Link>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Managed Network profile</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{managed.company.legal_name}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Claim {managed.claim_status}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Publication {managed.company.publication_status}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Verification {managed.company.verification_status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Puoi modificare solo i campi company-managed. Ragione sociale, paese, verification,
              publication state e claim restano sotto governance della piattaforma.
            </p>
          </section>

          <form action={updateManagedNetworkProfile} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
            <input type="hidden" name="network_company_id" value={managed.network_company_id} />
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Nome commerciale</label>
              <input
                name="trading_name"
                defaultValue={managed.company.trading_name ?? ""}
                maxLength={255}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Sito web</label>
              <input
                name="website_url"
                defaultValue={managed.company.website_url ?? ""}
                maxLength={500}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Descrizione azienda</label>
              <textarea
                name="description"
                defaultValue={managed.company.description ?? ""}
                maxLength={4000}
                rows={7}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none"
              />
            </div>
            <button className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white">
              Salva profilo Network
            </button>
          </form>
        </>
      )}
    </div>
  );
}
