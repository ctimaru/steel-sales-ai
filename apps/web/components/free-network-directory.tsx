import Link from "next/link";
import {NetworkCompanyGrowthEntry} from "@/components/network-company-growth-entry";
import {NetworkReadyConnections,NetworkReadinessAction} from "@/components/network-ready-connections";
import {getNetworkRecipientReadiness} from "@/lib/network-recipient-readiness";

import { FocusPage } from "@/components/focus-ui";
import { ItalyRegionMap } from "@/components/italy-region-map";
import { NetworkRoleDiscovery } from "@/components/network-role-discovery";
import { NetworkLaunchDiscovery } from "@/components/network-launch-discovery";
import { NetworkDiscoveryOverview } from "@/components/network-discovery-overview";
import { NetworkMiniMap, NetworkRecoveryScreen } from "@/components/network-resilient-first-screen";
import { NetworkPagination, parseNetworkPage } from "@/components/network-pagination";
import { NetworkActivationCta } from "@/components/network-activation-cta";
import { getItalyRegionCoverage, getItalyProvisionalGeoCoverage, type ItalyRegionCoverage, type ItalyProvisionalGeoCoverage } from "@/lib/network-region-coverage";
import { NETWORK_COMPANY_ROLES } from "@/lib/network-experience";
import { activeNetworkPersona, networkRoleReason } from "@/lib/network-role-discovery";
import { getFreeNetworkPagedDirectory, safeNetworkWebsiteUrl } from "@/lib/network-free";

const roleLabels: Record<string, string> = {
  producer: "Produttori", trader_distributor: "Commercianti",
  processor_service_provider: "Terzisti", end_user: "Utilizzatori",
};
function href(filters: { q?: string; role?: string; region?: string; persona?: string }) {
  const query = new URLSearchParams();
  // Changing a category restarts both page windows; never carry stale p/dpage.
  for (const key of ["q","role","region","persona"] as const) {
    const value=filters[key]; if(value)query.set(key,value);
  }
  return "/network" + (query.size ? "?" + query.toString() : "");
}
export async function FreeNetworkDirectoryView({
  organizationId, organizationName, filters, isWorkspaceAdmin=false, canConnect=false,
}: {
  organizationId: string;
  organizationName: string;
  isWorkspaceAdmin?:boolean;
  canConnect?:boolean;
  filters: { q?: string; role?: string; region?: string; persona?: string; p?: string; dpage?: string };
}) {
  const role = NETWORK_COMPANY_ROLES.includes(filters.role as (typeof NETWORK_COMPANY_ROLES)[number])
    ? filters.role : undefined;
  let data;
  let coverage: ItalyRegionCoverage | null = null;
  let provisionalCoverage: ItalyProvisionalGeoCoverage | null = null;
  try {
    [data, coverage, provisionalCoverage] = await Promise.all([
      getFreeNetworkPagedDirectory(organizationId, { ...filters, role, page:parseNetworkPage(filters.p), discoveryPage:parseNetworkPage(filters.dpage) }),
      getItalyRegionCoverage(organizationId).catch(() => null),
      getItalyProvisionalGeoCoverage(organizationId,"free").catch(() => null),
    ]);
  } catch {
    // DB timeouts are not registration failures. Keep entitlement enforcement
    // in the original RPCs; expose no company rows on failed authorized reads.
    return <NetworkRecoveryScreen />;
  }
  const hasFilters = Boolean(filters.q?.trim() || role || filters.region);
  const persona = activeNetworkPersona(filters.persona, data.viewer_role);
  const items = data.published_page.items; // role ordering is global and enforced by SQL before pagination
  const readiness = await getNetworkRecipientReadiness(organizationId,items.map(x=>x.id)).catch(()=>null);
  const readyItems = items.map(x=>({id:x.id,name:x.trading_name||x.legal_name,role:x.roles[0]?.name,region:x.location?.region}));
  return (
    <FocusPage className="max-w-[1180px]">
      <NetworkCompanyGrowthEntry />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_245px]">
      <section className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#173f35] px-3 py-1 text-xs font-semibold text-white">Network Free</span>
          <span className="text-xs font-medium text-[#52615b]">{organizationName}</span>
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">Scopri le aziende dell'acciaio</h1>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Dimensione della rete aziendale">
          <span className="rounded-full border border-[#b8d2c8] bg-white px-3 py-1.5 text-xs font-semibold text-[#173f35]">
            {Math.max(data.total-(data.discovered_total??0),0)} profili pubblicati
          </span>
          <span className="rounded-full border border-[#e2d1a4] bg-[#fff7e6] px-3 py-1.5 text-xs font-semibold text-[#795521]">
            {data.discovered_total??0} aziende scoperte · da confermare
          </span>
          <a href="#network-new-discoveries" className="inline-flex items-center px-2 text-xs font-semibold text-[#175640] underline">
            Esplora le novità ↓
          </a>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#43524c]">
          Cerca produttori, commercianti, terzisti e utilizzatori in tutta Italia.
          Le aziende scoperte vengono mostrate subito come "Da confermare". La mappa distingue sedi pubblicate da località aziendali provvisorie, sempre da confermare.
        </p>
        <form action="/network" method="get" className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="free-network-search" className="sr-only">Cerca aziende</label>
          <input id="free-network-search" name="q" type="search" maxLength={120}
            defaultValue={filters.q || ""} placeholder="Ragione sociale..."
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#b8d2c8] bg-white px-3 text-sm text-[#173f35]"/>
          {role ? <input name="role" type="hidden" value={role} /> : null}
          {filters.persona ? <input name="persona" type="hidden" value={filters.persona} /> : null}
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

      </section>
      <NetworkMiniMap coverage={coverage} provisionalCoverage={provisionalCoverage} filters={filters} />
      </div>
      <div className="mt-4">
        <NetworkDiscoveryOverview
          published={Math.max(data.total - (data.discovered_total ?? 0), 0)}
          discovered={data.discovered_total ?? 0}
          persona={filters.persona}
          role={filters.role}
          region={filters.region}
          discoveryUnavailable={data.discovery_unavailable}
        />
      </div>
      <div className="mt-6">
        <NetworkRoleDiscovery viewerRole={data.viewer_role} filters={filters} />
      </div>
      <div className="mt-5">
        <NetworkLaunchDiscovery directory={data}
          filters={{q:filters.q,role:filters.role,region:filters.region}}
          pagination={data.discovery_page} navigationParams={filters} />
      </div>
      <div className="mt-5"><NetworkReadyConnections items={readyItems} statuses={readiness} canAct={canConnect} /></div>
      <section id="network-region-results" aria-label="Risultati del Network" className="mt-6">
        <h2 className="text-xl font-semibold text-[#173f35]">{data.total.toLocaleString("it-IT")} aziende</h2>
        {data.discovered_total ? <p className="mt-1 text-xs font-semibold text-[#52615b]">
          {data.discovered_total.toLocaleString("it-IT")} profili scoperti · Da confermare · categoria indicativa
        </p> : null}
        <p className="mt-1 text-sm text-[#52615b]">Solo dati aziendali essenziali. Le aziende scoperte non sono necessariamente clienti, fornitori verificati o proprietarie dei profili; nessuna sede viene inventata.</p>
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
                    {company.discovery_status==="unconfirmed" ? <p className="mt-1 text-xs font-semibold text-[#8a5a16]">Scoperta dal Network · Da confermare</p> : null}
                    <p className="mt-1 text-xs text-[#52615b]">
                      {company.roles.map((r) => r.name).join(" · ") || "Ruolo da completare"}
                      {" · "}{company.location?.region || "Regione non disponibile"}
                      {company.discovery_status==="unconfirmed" ? " · Classificazione indicativa" : ""}
                    </p>
                    {company.products.length ? <p className="mt-2 text-xs text-[#52615b]">{company.products.slice(0, 3).join(" · ")}</p> : null}
                    {!hasFilters && networkRoleReason(company.roles,persona) ? <p className="mt-2 text-xs font-semibold text-[#27714f]">{networkRoleReason(company.roles,persona)}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <NetworkReadinessAction companyId={company.id} status={readiness?.get(company.id)} canAct={canConnect}/>
                    {website ? <a href={website} rel="noopener noreferrer" target="_blank" className="app-secondary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">Sito web</a> : null}
                    <Link href={"/network/" + company.id} className="app-primary inline-flex min-h-10 items-center rounded-xl px-3 text-xs font-semibold">Profilo</Link>
                    {isWorkspaceAdmin && ["unclaimed","revoked"].includes(company.claimed_status)
                      ? <NetworkActivationCta mode="published" companyId={company.id}
                          companyName={company.legal_name} source="network_free_results" compact />
                      : null}
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
        <NetworkPagination
          page={data.published_page.page} total={data.published_page.total} pageSize={data.published_page.page_size}
          parameter="p" params={filters} anchor="network-region-results"
        />
      </section>
      <div className="mt-6">
        <ItalyRegionMap coverage={coverage} provisionalCoverage={provisionalCoverage} selectedRegion={filters.region} filters={filters} />
      </div>
    </FocusPage>
  );
}
