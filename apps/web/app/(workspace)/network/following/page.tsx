import Link from "next/link";
import { redirect } from "next/navigation";

import { unfollowNetworkCompany } from "@/app/(workspace)/network/actions";
import { getActiveOrganizationContext, getFollowedNetworkCompanies } from "@/lib/network";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

export default async function FollowedCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const { error, message } = await searchParams;
  const organization = await getActiveOrganizationContext();
  if (!organization) redirect("/network?error=Nessuna%20organization%20attiva");

  const followed = await getFollowedNetworkCompanies(organization.organization_id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/network" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
            ← Torna alla directory
          </Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">P4 · Follow</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Aziende seguite</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Il follow è privato e serve solo a ricevere gli aggiornamenti pubblicati nel Network.
            Non crea connection, endorsement o follower count pubblico.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/network/activity"
            className="inline-flex h-10 items-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
          >
            Activity feed
          </Link>
          <span className="inline-flex h-10 items-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700">
            {followed.total} seguite
          </span>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      {followed.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-slate-900">Non segui ancora aziende</p>
          <p className="mt-2 text-sm text-slate-500">
            Apri un Company Profile e usa “Segui aggiornamenti”.
          </p>
          <Link href="/network" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
            Esplora il Network
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {followed.items.map((item) => (
            <article key={item.network_company_id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{item.country_code}</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{item.legal_name}</h2>
                  {item.trading_name ? <p className="mt-1 text-sm text-slate-500">{item.trading_name}</p> : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  {item.verification_status}
                </span>
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                  href={"/network/" + item.network_company_id}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
                >
                  Apri profilo
                </Link>
                <form action={unfollowNetworkCompany}>
                  <input type="hidden" name="network_company_id" value={item.network_company_id} />
                  <button className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">
                    Non seguire
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
