import Link from "next/link";
import { redirect } from "next/navigation";

import { getNetworkTaxonomy, searchNetwork } from "@/lib/network";
import { PilotEvent } from "@/components/pilot-event";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

function selectClass() {
  return "h-11 rounded-xl border border-[#d9e0e4] bg-white px-3 text-sm text-[#2b3d46] outline-none";
}

export default async function NetworkDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    product?: string;
    capability?: string;
    country?: string;
    market?: string;
    error?: string;
  }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  const params = await searchParams;
  const [taxonomy, results] = await Promise.all([
    getNetworkTaxonomy(),
    searchNetwork({
      query: params.q,
      role: params.role,
      product: params.product,
      capability: params.capability,
      country: params.country,
      market: params.market,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PilotEvent eventName="network_directory_viewed" metadata={{ surface: "network_directory" }} />
      <section className="rounded-3xl border border-[#d9e0e4] bg-white p-6 shadow-[0_1px_2px_rgba(11,23,30,0.035),0_10px_30px_rgba(11,23,30,0.025)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#28677a]">Steel Industry Network</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#17232d]">Directory aziende</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66737d]">
              Cerca aziende pubblicate nel Network per ruolo, prodotto, capability, paese e mercato servito.
              I dati della Commercial Memory privata non vengono mostrati qui.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/network/pilot-readiness"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800"
            >
              P5 readiness
            </Link>
            <Link
              href="/network/activity"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#c8dce1] bg-[#eef5f6] px-4 text-sm font-semibold text-[#1b4c5d]"
            >
              Activity
            </Link>
            <Link
              href="/network/following"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d9e0e4] bg-white px-4 text-sm font-semibold text-[#33454e]"
            >
              Seguite
            </Link>
            <Link
              href="/network/inquiries"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d9e0e4] bg-white px-4 text-sm font-semibold text-[#33454e]"
            >
              Inquiry
            </Link>
            <Link
              href="/network/saved"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d9e0e4] bg-white px-4 text-sm font-semibold text-[#33454e]"
            >
              Aziende salvate
            </Link>
            <Link
              href="/network/manage"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0b171e] px-4 text-sm font-semibold text-white"
            >
              Gestisci profilo azienda
            </Link>
          </div>
        </div>
      </section>

      <form className="grid gap-3 rounded-2xl border border-[#d9e0e4] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Azienda o dominio"
          className="h-11 rounded-xl border border-[#d9e0e4] px-3 text-sm outline-none sm:col-span-2"
        />
        <select name="role" defaultValue={params.role ?? ""} className={selectClass()}>
          <option value="">Tutti i ruoli</option>
          {taxonomy.roles.map((item) => (
            <option key={item.canonical_key} value={item.canonical_key}>{item.display_name}</option>
          ))}
        </select>
        <select name="product" defaultValue={params.product ?? ""} className={selectClass()}>
          <option value="">Tutti i prodotti</option>
          {taxonomy.products.map((item) => (
            <option key={item.canonical_key} value={item.canonical_key}>{item.display_name}</option>
          ))}
        </select>
        <select name="capability" defaultValue={params.capability ?? ""} className={selectClass()}>
          <option value="">Tutte le capability</option>
          {taxonomy.capabilities.map((item) => (
            <option key={item.canonical_key} value={item.canonical_key}>{item.display_name}</option>
          ))}
        </select>
        <select name="market" defaultValue={params.market ?? ""} className={selectClass()}>
          <option value="">Tutti i mercati</option>
          {taxonomy.markets.map((item) => (
            <option key={item.canonical_key} value={item.canonical_key}>{item.display_name}</option>
          ))}
        </select>
        <input
          name="country"
          defaultValue={params.country ?? ""}
          maxLength={2}
          placeholder="Paese (IT)"
          className="h-11 rounded-xl border border-[#d9e0e4] px-3 text-sm uppercase outline-none"
        />
        <div className="flex gap-2 lg:col-span-5">
          <button className="h-11 rounded-xl bg-[#1b4c5d] px-5 text-sm font-semibold text-white">Cerca nel Network</button>
          <Link href="/network" className="inline-flex h-11 items-center rounded-xl border border-[#d9e0e4] px-4 text-sm font-semibold text-[#52636c]">
            Azzera filtri
          </Link>
        </div>
      </form>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#22313a]">{results.total} aziende trovate</p>
          <p className="text-xs text-[#8fa1a9]">Solo profili published</p>
        </div>

        {results.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c8d2d7] bg-white p-10 text-center">
            <p className="font-semibold text-[#22313a]">Nessun profilo pubblico corrisponde ai filtri</p>
            <p className="mt-2 text-sm text-[#66737d]">
              I profili pending review, sospesi o privati restano esclusi dal read model.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {results.items.map((company) => (
              <Link
                key={company.id}
                href={"/network/" + company.id}
                className="rounded-2xl border border-[#d9e0e4] bg-white p-5 transition hover:border-[#8fa1a9] hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#8fa1a9]">{company.country_code}</p>
                    <h2 className="mt-1 text-lg font-semibold text-[#17232d]">{company.legal_name}</h2>
                    {company.trading_name ? <p className="mt-1 text-sm text-[#66737d]">{company.trading_name}</p> : null}
                  </div>
                  <span className="rounded-full bg-[#edf1f3] px-2.5 py-1 text-[11px] font-bold text-[#33454e]">
                    {company.verification_status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {company.roles.slice(0, 3).map((role) => (
                    <span key={role.key} className="rounded-full bg-[#eef5f6] px-2.5 py-1 text-xs font-semibold text-[#1b4c5d]">
                      {role.name}
                    </span>
                  ))}
                  {company.products.slice(0, 3).map((product) => (
                    <span key={product.key + product.relationship_type} className="rounded-full bg-[#edf1f3] px-2.5 py-1 text-xs text-[#52636c]">
                      {product.name}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-xs font-semibold text-[#28677a]">Apri profilo Network →</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
