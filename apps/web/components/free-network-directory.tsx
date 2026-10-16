import Link from "next/link";

import { FocusPage } from "@/components/focus-ui";
import { NETWORK_COMPANY_ROLES, orderNetworkDiscovery } from "@/lib/network-experience";
import { getFreeNetworkDirectory, safeNetworkWebsiteUrl } from "@/lib/network-free";

const roleLabels: Record<string, string> = {
  producer: "Produttori", trader_distributor: "Commercianti",
  processor_service_provider: "Terzisti", end_user: "Utilizzatori",
};
function href(filters: { q?: string; role?: string; region?: string }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return "/network" + (query.size ? "?" + query.toString() : "");
}
export async function FreeNetworkDirectoryView({
  organizationId, organizationName, filters,
}: {
  organizationId: string;
  organizationName: string;
  filters: { q?: string; role?: string; region?: string };
}) {
  const role = NETWORK_COMPANY_ROLES.includes(filters.role as (typeof NETWORK_COMPANY_ROLES)[number])
    ? filters.role : undefined;
  let data;
  try {
    data = await getFreeNetworkDirectory(organizationId, { ...filters, role });
  } catch {
    return (
      <FocusPage className="max-w-[1180px]">
        <section className="rounded-2xl border border-[#d7dfdb] bg-white p-6">
          <h1 className="text-2xl font-semibold text-[#173f35]">Attiva la tua azienda per esplorare il Network</h1>
          <p className="mt-3 text-sm text-[#52615b]">
            La directory Free richiede un account autenticato e una registrazione aziendale attiva.
            Controlla lo stato della tua azienda oppure riprova.
          </p>
          <Link href="/registration" className="mt-5 inline-flex rounded-xl border border-[#173f35] px-4 py-2 text-sm font-semibold text-[#173f35]">Verifica registrazione</Link>
        </section>
      </FocusPage>
    );
  }
  const hasFilters = Boolean(filters.q?.trim() || role || filters.region);
  const items = orderNetworkDiscovery(data.items, data.viewer_role, hasFilters);
  return (
    <FocusPage className="max-w-[1180px]">
      <section className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#173f35] px-3 py-1 text-xs font-semibold text-white">Network Free</span>
          <span className="text-xs font-medium text-[#52615b]">{organizationName}</span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">Scopri le aziende dell'acciaio</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#43524c]">
          Cerca produttori, commercianti, terzisti e utilizzatori. La mappa interattiva
          per regioni arriverà con NET-UX2: i risultati attuali sono profili pubblicati,
          anche se privi di una regione associata.
        </p>
        <form action="/network" method="get" className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="free-network-search" className="sr-only">Cerca aziende</label>
          <input id="free-network-search" name="q" type="search" maxLength={120}
            defaultValue={filters.q || ""} placeholder="Ragione sociale..."
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#b8d2c8] bg-white px-3 text-sm text-[#173f35]"/>
          {role ? <input name="role" type="hidden" value={role} /> : null}
          {filters.region ? <input name="region" type="hidden" value={filters.region} /> : null}
          <button className="app-primary min-h-11 rounded-xl px-5 text-sm font-semibold">Cerca</button>
        </form>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Categorie aziendali">
          {[{ key: "", label: "Tutta la filiera" }, ...NETWORK_COMPANY_ROLES.map((key) => ({ key, label: roleLabels[key] }))].map((item) => (
            <Link key={item.key || "all"} href={href({ ...filters, role: item.key || undefined })}
              aria-current={(role || "") === item.key ? "page" : undefined}
              className={"inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-semibold " +
                ((role || "") === item.key ? "border-[#173f35] bg-[#173f35] text-white" : "border-[#bfd6ca] bg-white text-[#173f35] hover:bg-[#f8faf9]")}>
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/network" method="get" className="mt-4 flex flex-wrap items-center gap-2">
          {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}
          {role ? <input name="role" type="hidden" value={role} /> : null}
          <label htmlFor="free-network-region" className="text-xs font-semibold text-[#43524c]">Regione</label>
          <select id="free-network-region" name="region" defaultValue={filters.region || ""}
            className="min-h-10 rounded-xl border border-[#bfd6ca] bg-white px-3 text-sm text-[#173f35]">
            <option value="">Tutte le regioni</option>
            {data.regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="app-secondary min-h-10 rounded-xl px-3 text-xs font-semibold">Applica</button>
          {hasFilters ? <Link href="/network" className="text-xs font-semibold text-[#173f35] underline">Azzera filtri</Link> : null}
        </form>
      </section>
      <section aria-label="Risultati del Network" className="mt-6">
        <h2 className="text-xl font-semibold text-[#173f35]">{data.total.toLocaleString("it-IT")} aziende</h2>
        <p className="mt-1 text-sm text-[#52615b]">Solo dati aziendali condivisibili. Le sedi non disponibili non vengono inventate.</p>
        {items.length ? (
          <div className="mt-4 divide-y divide-[#edf1ef] overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            {items.map((company) => {
              const website = safeNetworkWebsiteUrl(company.website_url);
              return (
                <article key={company.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <Link href={"/network/" + company.id} className="text-base font-semibold text-[#173f35] hover:underline">
                      {company.trading_name || company.legal_name}
                    </Link>
                    <p className="mt-1 text-xs text-[#52615b]">
                      {company.roles.map((r) => r.name).join(" · ") || "Ruolo da completare"}
                      {" · "}{company.location?.region || "Regione non disponibile"}
                    </p>
                    {company.products.length ? <p className="mt-2 text-xs text-[#52615b]">{company.products.slice(0, 3).join(" · ")}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {website ? <a href={website} rel="noopener noreferrer" target="_blank" className="app-secondary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">Sito web</a> : null}
                    <Link href={"/network/" + company.id} className="app-primary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">Profilo</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[#dce2df] bg-white p-6 text-sm text-[#52615b]">
            Nessuna azienda trovata. Cambia regione, categoria oppure azzera i filtri.
          </div>
        )}
      </section>
    </FocusPage>
  );
}
