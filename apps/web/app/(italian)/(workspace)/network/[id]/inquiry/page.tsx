import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { submitNetworkInquiry } from "@/app/(workspace)/network/actions";
import {
  getActiveOrganizationContext,
  getInquiryEligibility,
  getNetworkProfile,
} from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

export default async function NetworkInquiryComposePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const { id } = await params;
  const { error } = await searchParams;
  const [profile, context] = await Promise.all([
    getNetworkProfile(id),
    getActiveOrganizationContext(),
  ]);

  if (!profile) notFound();
  if (!context) redirect("/network/" + id + "?error=Nessuna%20organization%20attiva");

  const eligibility = await getInquiryEligibility(context.organization_id, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={"/network/" + id} className="text-sm font-semibold text-slate-500 hover:text-slate-950">
        ← Torna al profilo
      </Link>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Business inquiry</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Contatta {profile.company.legal_name}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          L’inquiry è privata tra le organizzazioni partecipanti. Non crea una connection pubblica,
          non modifica la verification e non alimenta automaticamente la Commercial Memory.
        </p>
      </section>

      {!eligibility.eligible ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-950">Inquiry non disponibile</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Questa azienda non può ricevere inquiry in-platform in questo momento. Puoi utilizzare
            eventuali contatti business pubblicati nel profilo.
          </p>
        </section>
      ) : (
        <form action={submitNetworkInquiry} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <input type="hidden" name="network_company_id" value={profile.company.id} />
          <input type="hidden" name="organization_id" value={context.organization_id} />

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Oggetto</label>
            <input
              name="subject"
              required
              minLength={1}
              maxLength={200}
              placeholder="Es. Richiesta informazioni tubi EN 10219"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Messaggio</label>
            <textarea
              name="body"
              required
              minLength={1}
              maxLength={5000}
              rows={9}
              placeholder="Descrivi la richiesta commerciale..."
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none"
            />
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            Anti-abuse: massimo 10 inquiry per utente nelle 24 ore e massimo 3 verso la stessa azienda
            dalla stessa organizzazione nelle 24 ore.
          </div>

          <button className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white">
            Invia inquiry
          </button>
        </form>
      )}
    </div>
  );
}
