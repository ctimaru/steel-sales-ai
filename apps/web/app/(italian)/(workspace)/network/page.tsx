import {NetworkCompactExperience} from "@/components/network-compact-experience";
import {getCompactNetworkPage,normalizeCompactGeoFilters} from "@/lib/network-compact-directory";
import Link from "next/link";
import {NetworkCompanyGrowthEntry} from "@/components/network-company-growth-entry";
import {NetworkReadyConnections} from "@/components/network-ready-connections";
import {getNetworkRecipientReadiness} from "@/lib/network-recipient-readiness";
import {getNetworkReplyIntelligence,sharedPublicProducts} from "@/lib/network-reply-intelligence";
import {canInteractWithNetwork,canWriteWorkspace} from "@/lib/access-policy";
import { redirect } from "next/navigation";

import { FreeNetworkDirectoryView } from "@/components/free-network-directory";
import { NetworkLaunchDiscovery } from "@/components/network-launch-discovery";
import { NetworkInventoryBar, networkListingView } from "@/components/network-inventory-bar";
import { NetworkDiscoveryOverview } from "@/components/network-discovery-overview";
import { NetworkMiniMap, NetworkAvailabilityNotice } from "@/components/network-resilient-first-screen";
import { NetworkPagination, parseNetworkPage } from "@/components/network-pagination";
import { ItalyRegionMap } from "@/components/italy-region-map";
import { NetworkRoleDiscovery } from "@/components/network-role-discovery";
import { getItalyRegionCoverage, getItalyProvisionalGeoCoverage } from "@/lib/network-region-coverage";
import { orderNetworkDiscovery } from "@/lib/network-experience";
import { activeNetworkPersona, networkRoleReason, validNetworkPersona } from "@/lib/network-role-discovery";
import { getFreeNetworkViewerRole, getProNetworkDiscoveryDirectory, getNetworkBrowsePage } from "@/lib/network-free";
import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { NetworkAccessGate } from "@/components/network-access-gate";
import { PilotEvent } from "@/components/pilot-event";
import {
  getNetworkTaxonomy,
  getNetworkGeoFacets,
  searchNetwork,
  type NetworkSearchItem,
} from "@/lib/network";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFreeReadEnabled, isNetworkFrontendEnabled } from "@/lib/network-flags";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

function selectClass() {
  return "h-11 w-full rounded-xl border border-[#dce2df] bg-white px-3 text-sm text-[#2b3d46] outline-none transition focus:border-[#82aa9b] focus:ring-4 focus:ring-[#e1ece8]";
}

const companyTypeDoors = [
  { key: "", label: "Tutta la filiera" },
  { key: "producer", label: "Produttori" },
  { key: "trader_distributor", label: "Commercianti" },
  { key: "processor_service_provider", label: "Terzisti" },
  { key: "end_user", label: "Utilizzatori" },
] as const;

function companyTypeHref(role: string, persona?: string) {
  const query = new URLSearchParams();
  if (role) query.set("role", role);
  const viewer = validNetworkPersona(persona);
  if (viewer) query.set("persona", viewer);
  query.set("product", "tubes_pipes");
  query.set("country", "IT");
  return `/network?${query.toString()}`;
}

function currentDirectoryPath(params: {
  q?: string;
  role?: string;
  product?: string;
  capability?: string;
  country?: string;
  market?: string;
  region?: string;
  province?: string;
  city?: string;
  persona?: string;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `/network?${serialized}` : "/network";
}

function compactList(items: { name: string }[], limit = 2) {
  return items.slice(0, limit);
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
    region?: string;
    province?: string;
    city?: string;
    persona?: string;
    p?: string;
    dpage?: string;
    view?: string;
    np?: string;
    steel?: string;
    advanced?: string;
    map?: string;
    error?: string;
    message?: string;
  }>;
}) {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");

  const context = await getWorkspaceContext();
  const access = await getNetworkAccessState(context.organizationId);

  if (!access.can_access_network) {
    if (isNetworkFreeReadEnabled()) {
      const params = await searchParams;
      // The same governed source ranking is available in Free without any Pro upgrade.
      // Failure falls back to the existing Free listing, never bypassing the Free guard.
      if(params.steel==="1" && !params.product && !params.capability && !params.market &&
         (!params.country || params.country.toUpperCase()==="IT")){
        const filters=normalizeCompactGeoFilters({q:params.q,role:params.role,region:params.region,
          persona:params.persona,np:params.np,steel:"1",country:params.country});
        const ranked=await getCompactNetworkPage(context.organizationId,"free",filters).catch(()=>null);
        if(ranked){
          return <FocusPage className="max-w-[1560px]">
            <NetworkCompactExperience accessMode="free" directory={ranked} filters={filters}
              userId={context.userId} organizationId={context.organizationId}
              canCompose={canWriteWorkspace(context.role)}
              regions={[]}/>
          </FocusPage>;
        }
      }
      return (
        <FreeNetworkDirectoryView
          organizationId={context.organizationId}
          userId={context.userId}
          canCompose={canWriteWorkspace(context.role)}
          organizationName={context.organizationName}
          isWorkspaceAdmin={context.role==="admin"}
          canConnect={canInteractWithNetwork(context.role)}
          filters={{ q: params.q, role: params.role, region: params.region, persona: params.persona, p:params.p,dpage:params.dpage,view:params.view, np:params.np, map:params.map, product:params.product, capability:params.capability, market:params.market, country:params.country }}
        />
      );
    }
    return (
      <NetworkAccessGate
        access={access}
        organizationName={context.organizationName}
      />
    );
  }

  const params = await searchParams;
  // NET-UX COMPACT1: fast, unified first-screen browse. Keep the existing rich
  // technical finder as an explicit advanced route and as a resilient fallback.
  const compactFilters=normalizeCompactGeoFilters({q:params.q,role:params.role,region:params.region,persona:params.persona,np:params.np,
    product:params.product,capability:params.capability,market:params.market,country:params.country,steel:params.steel});
  const needsTechnicalFinder=Boolean(params.advanced==="1"||params.province||params.city);
  if(!needsTechnicalFinder){
    const compact=await getCompactNetworkPage(context.organizationId,"pro",compactFilters).catch(()=>null);
    if(compact){
      const [compactCoverage,compactProvisional,compactGeo,compactLegacyResults,compactTaxonomy]=await Promise.all([
        getItalyRegionCoverage(context.organizationId).catch(()=>null),
        getItalyProvisionalGeoCoverage(context.organizationId,"pro").catch(()=>null),
        getNetworkGeoFacets().catch(()=>({regions:[],cities:[],provinces:[]})),
        compact.technicalOnly?Promise.resolve({items:[],total:0}):searchNetwork({query:params.q,role:params.role,region:params.region,
          page:Math.max(1,Math.floor(((compact.page-1)*6)/18)+1)}).catch(()=>({items:[],total:0})),
        getNetworkTaxonomy().catch(()=>({roles:[],products:[],capabilities:[],markets:[]})),

      ]);
      const capabilityLabels=compact.capabilityLabels??Object.fromEntries(compactLegacyResults.items.map(item=>[
        item.id,item.capabilities.map(cap=>cap.name),
      ]));
      return <FocusPage className="max-w-[1560px]">
        <PilotEvent eventName="network_directory_viewed" metadata={{surface:"network_compact"}}/>
        <NetworkCompactExperience accessMode="pro" directory={compact} filters={compactFilters}
          userId={context.userId} organizationId={context.organizationId} canCompose={canWriteWorkspace(context.role)}
          coverage={compactCoverage} provisionalCoverage={compactProvisional}
          regions={compactGeo.regions.length?compactGeo.regions:compactCoverage?.regions.map(r=>r.name)||[]}
          capabilityLabels={capabilityLabels}
          additionalFilters={{products:compactTaxonomy.products,capabilities:compactTaxonomy.capabilities,markets:compactTaxonomy.markets}}/>
      </FocusPage>;
    }
  }
  const listingView = networkListingView(params.view);
  // Normal discovery must use the same published source as Free, otherwise
  // the old technical m6 reader omits published Network profiles on the default page.
  const simplePublishedSearch = !params.product && !params.capability && !params.market
    && !params.province && !params.city && (!params.country || params.country.toUpperCase()==="IT");
  const [taxonomyResult, geoResult, resultsResult, coverageResult, roleResult, previewResult, provisionalGeoResult, publishedBrowseResult] = await Promise.allSettled([
    getNetworkTaxonomy(),
    getNetworkGeoFacets(),
    searchNetwork({
      query: params.q,
      role: params.role,
      product: params.product,
      capability: params.capability,
      country: params.country,
      market: params.market,
      region: params.region,
      province: params.province,
      city: params.city,
      page:parseNetworkPage(params.p),
    }),
    getItalyRegionCoverage(context.organizationId).catch(() => null),
    getFreeNetworkViewerRole(context.organizationId).catch(() => null),
    // Pro users previously saw only the legacy canonical search, hiding NET-FAST discoveries.
    getProNetworkDiscoveryDirectory(context.organizationId, {
      q: params.q, role: params.role, region: params.region,
      persona: validNetworkPersona(params.persona) || undefined, page:parseNetworkPage(params.dpage),
    }),
    getItalyProvisionalGeoCoverage(context.organizationId,"pro").catch(() => null),
    getNetworkBrowsePage(context.organizationId,"pro","published",{
      q:params.q,role:params.role,region:params.region,persona:validNetworkPersona(params.persona)||undefined,
      page:parseNetworkPage(params.p),
    }),
  ]);

  // Never let one unavailable feed take down the whole Network. Auth and
  // entitlement checks above remain mandatory; this only isolates data reads.
  const taxonomy = taxonomyResult.status === "fulfilled" ? taxonomyResult.value
    : {roles:[],products:[],capabilities:[],markets:[]};
  const geoFacets = geoResult.status === "fulfilled" ? geoResult.value
    : {regions:[],cities:[],provinces:[]};
  const olderResults = resultsResult.status === "fulfilled" ? resultsResult.value : {items:[],total:0};
  const authoritativePublishedPage = publishedBrowseResult.status==="fulfilled" ? publishedBrowseResult.value : null;
  const canonicalUnavailable = resultsResult.status === "rejected" && !(simplePublishedSearch && authoritativePublishedPage);
  const knownPublished = new Map(olderResults.items.map(item=>[item.id,item]));
  const results = simplePublishedSearch && authoritativePublishedPage ? {
    total:authoritativePublishedPage.total,
    items:authoritativePublishedPage.items.map(item=>knownPublished.get(item.id) ?? ({
      id:item.id,legal_name:item.legal_name,trading_name:item.trading_name,
      country_code:item.country_code,website_url:item.website_url,
      website_domain:item.website_url ? (()=>{try{return new URL(item.website_url).hostname.replace(/^www\./,"");}catch{return null;}})() : null,
      verification_status:item.verification_status,claimed_status:item.claimed_status,
      roles:item.roles,products:item.products.map(name=>({key:name,name,relationship_type:"unspecified"})),
      markets:[],capabilities:[],facility_countries:[item.country_code],
    } satisfies NetworkSearchItem)),
  } : olderResults;
  const coverage = coverageResult.status === "fulfilled" ? coverageResult.value : null;
  const provisionalCoverage = provisionalGeoResult.status === "fulfilled" ? provisionalGeoResult.value : null;
  const viewerRole = roleResult.status === "fulfilled" ? roleResult.value : null;
  const previewDirectory = previewResult.status === "fulfilled" ? previewResult.value : null;
  const unavailableSections = [
    canonicalUnavailable ? "profili pubblicati" : null,
    !previewDirectory ? "aziende da confermare" : null,
    geoResult.status === "rejected" ? "filtri geografici avanzati" : null,
  ].filter(Boolean);

  const hasAdvancedFilters = Boolean(
    params.role ||
      params.product ||
      params.capability ||
      params.country ||
      params.market || params.region || params.province || params.city,
  );
  const quickTubeContext =
    params.product === "tubes_pipes" && (params.country ?? "").toUpperCase() === "IT";
  const persona = activeNetworkPersona(params.persona, viewerRole);
  const orderedResults = orderNetworkDiscovery(results.items, persona, Boolean(params.q || hasAdvancedFilters));
  const [readiness,intelligence]=canonicalUnavailable ? [null,null] :
    await Promise.all([
      getNetworkRecipientReadiness(context.organizationId,orderedResults.map(x=>x.id)).catch(()=>null),
      getNetworkReplyIntelligence(context.organizationId,orderedResults.map(x=>x.id)).catch(()=>null),
    ]);
  const readyItems=orderedResults.map(x=>({id:x.id,name:x.trading_name||x.legal_name,
    role:x.roles[0]?.name,region:null,roles:x.roles.map(r=>({key:r.key}))}));

  return (
    <FocusPage className="max-w-[1180px]">
      <NetworkCompanyGrowthEntry />
      <NetworkInventoryBar accessMode="pro" published={results.total}
        unconfirmed={previewDirectory?.discovered_total??0}
        publishedUnavailable={canonicalUnavailable} discoveryUnavailable={!previewDirectory}
        view={listingView} filters={params} />
      <PilotEvent eventName="network_directory_viewed" metadata={{ surface: "network_directory" }} />
      {params.q || hasAdvancedFilters ? (
        <PilotEvent
          eventName="network_search_completed"
          outcome={results.total > 0 ? "success" : "empty"}
          resultCount={results.total}
          metadata={{ surface: "network_directory" }}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_245px]">
        <div className="min-w-0">
      <FocusHeader
        eyebrow="Network"
        title="Trova aziende steel"
        description={
          <>
            Cerca aziende per nome o dominio e restringi solo quando serve per ruolo, prodotto,
            capability, mercato o paese.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              Rete aziendale riservata · la Commercial Memory resta separata
            </span>
          </>
        }
      />

      <section className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-6">
        <p className="app-kicker">Ricerca aziende</p>
        <h2 className="mt-2 text-xl font-semibold text-[#173f35] sm:text-2xl">
          Nome o dominio
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#52615b]">
          Parti dall&apos;identità aziendale. I filtri tecnici servono dopo, non prima.
        </p>

        <form className="mt-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="network-company-search" className="sr-only">
              Nome azienda o dominio
            </label>
            <input
              id="network-company-search"
              name="q"
              type="search"
              aria-label="Nome azienda o dominio"
              defaultValue={params.q ?? ""}
              placeholder="Es. Padana Tubi, acciaitubi.it..."
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#c9d9d3] bg-white px-4 text-sm text-[#1d2824] outline-none placeholder:text-[#5d6a65] focus:border-[#438d7a] focus:ring-4 focus:ring-[#dcebe6]"
            />
            {params.role ? <input type="hidden" name="role" value={params.role} /> : null}
            {listingView!=="all" ? <input type="hidden" name="view" value={listingView} /> : null}
            {validNetworkPersona(params.persona) ? <input type="hidden" name="persona" value={params.persona} /> : null}
            {params.product ? <input type="hidden" name="product" value={params.product} /> : null}
            {params.capability ? <input type="hidden" name="capability" value={params.capability} /> : null}
            {params.country ? <input type="hidden" name="country" value={params.country} /> : null}
            {params.market ? <input type="hidden" name="market" value={params.market} /> : null}
            {params.region ? <input type="hidden" name="region" value={params.region} /> : null}
            {params.province ? <input type="hidden" name="province" value={params.province} /> : null}
            {params.city ? <input type="hidden" name="city" value={params.city} /> : null}
            <button className="app-primary min-h-12 rounded-xl px-6 text-sm font-semibold">
              Cerca
            </button>
            {params.q || hasAdvancedFilters ? (
              <Link
                href={appRoutes.network.directory}
                className="app-secondary inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold"
              >
                Azzera
              </Link>
            ) : null}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Tipologia azienda">
          <span className="mr-1 text-xs font-semibold text-[#5d6a65]">Italia · Tubes & Pipes</span>
          {companyTypeDoors.map((door) => {
            const active = quickTubeContext && (params.role ?? "") === door.key;
            return (
              <Link
                key={door.key || "all"}
                href={companyTypeHref(door.key, params.persona)}
                aria-current={active ? "page" : undefined}
                aria-label={door.key === "processor_service_provider" ? "Carpenterie & terzisti" : door.label}
                className={[
                  "inline-flex min-h-10 items-center rounded-full border px-3.5 text-xs font-semibold transition",
                  active
                    ? "border-[#82aa9b] bg-white text-[#173f35]"
                    : "border-[#cfe0d9] bg-white/70 text-[#43524c] hover:border-[#9db9af] hover:bg-white",
                ].join(" ")}
              >
                {door.label}
              </Link>
            );
          })}
        </div>

        <details open={hasAdvancedFilters} className="mt-4 rounded-2xl border border-[#cfe0d9] bg-white/70">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#43524c]">
            Filtri
            <span className="ml-2 text-xs font-normal text-[#5d6a65]">
              {hasAdvancedFilters
                ? "· filtri attivi"
                : "· ruolo, prodotto, capability, mercato e paese"}
            </span>
          </summary>
          <form className="grid gap-3 border-t border-[#d9e8e2] p-4 sm:grid-cols-2 lg:grid-cols-5">
            {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
            {listingView!=="all" ? <input type="hidden" name="view" value={listingView} /> : null}
            {validNetworkPersona(params.persona) ? <input type="hidden" name="persona" value={params.persona} /> : null}
            <select name="role" aria-label="Ruolo azienda" defaultValue={params.role ?? ""} className={selectClass()}>
              <option value="">Tutti i ruoli</option>
              {taxonomy.roles.map((item) => (
                <option key={item.canonical_key} value={item.canonical_key}>
                  {item.display_name}
                </option>
              ))}
            </select>
            <select name="product" aria-label="Famiglia prodotto" defaultValue={params.product ?? ""} className={selectClass()}>
              <option value="">Tutti i prodotti</option>
              {taxonomy.products.map((item) => (
                <option key={item.canonical_key} value={item.canonical_key}>
                  {item.display_name}
                </option>
              ))}
            </select>
            <select name="capability" aria-label="Capability" defaultValue={params.capability ?? ""} className={selectClass()}>
              <option value="">Tutte le capability</option>
              {taxonomy.capabilities.map((item) => (
                <option key={item.canonical_key} value={item.canonical_key}>
                  {item.display_name}
                </option>
              ))}
            </select>
            <select name="market" aria-label="Mercato" defaultValue={params.market ?? ""} className={selectClass()}>
              <option value="">Tutti i mercati</option>
              {taxonomy.markets.map((item) => (
                <option key={item.canonical_key} value={item.canonical_key}>
                  {item.display_name}
                </option>
              ))}
            </select>
            <select name="region" aria-label="Regione" defaultValue={params.region ?? ""} className={selectClass()}>
              <option value="">Tutte le regioni</option>
              {geoFacets.regions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="province" aria-label="Provincia verificata ISTAT" defaultValue={params.province ?? ""} className={selectClass()} disabled={!geoFacets.provinces.length}>
              <option value="">Tutte le province{!geoFacets.provinces.length ? " · in preparazione" : ""}</option>
              {geoFacets.provinces.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select name="city" aria-label="Comune" defaultValue={params.city ?? ""} className={selectClass()}>
              <option value="">Tutti i comuni</option>
              {geoFacets.cities.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <div className="flex gap-2">
              <input
                name="country"
                defaultValue={params.country ?? ""}
                maxLength={2}
                placeholder="Paese, es. IT"
                aria-label="Paese"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#dce2df] bg-white px-3 text-sm uppercase text-[#2b3d46] outline-none placeholder:normal-case placeholder:text-[#5d6a65] focus:border-[#82aa9b] focus:ring-4 focus:ring-[#e1ece8]"
              />
              <button className="app-primary h-11 rounded-xl px-4 text-xs font-semibold">
                Applica
              </button>
            </div>
            <p className="text-xs text-[#647269] sm:col-span-2 lg:col-span-5">Regione e comune provengono da sedi pubblicate. La provincia sarà disponibile dopo la verifica ISTAT; le aziende senza sede strutturata non appaiono nei filtri geografici.</p>
          </form>
        </details>
      </section>

      <NetworkDiscoveryOverview
        published={results.total}
        discovered={previewDirectory?.discovered_total ?? 0}
        persona={params.persona}
        role={params.role}
        region={params.region}
        discoveryUnavailable={!previewDirectory}
        publishedUnavailable={canonicalUnavailable}
      />
        </div>
        <NetworkMiniMap coverage={coverage} provisionalCoverage={provisionalCoverage} filters={params} />
      </div>
      {unavailableSections.length ? <div className="mt-4">
        <NetworkAvailabilityNotice label={"Servizi temporaneamente non disponibili: "+unavailableSections.join(", ")+ "."}/>
      </div> : null}

      {previewDirectory?.discovered_total ? <p className="mt-4 text-xs text-[#52615b]">
        La sezione di scoperta contiene {previewDirectory.discovered_total} profili aggiuntivi da confermare;
        le funzionalità premium rimangono disponibili sulla directory pubblicata qui sotto.
      </p> : null}
      {params.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {params.error}
        </div>
      ) : null}
      {params.message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {params.message}
        </div>
      ) : null}



      <div className="mt-5">
        <NetworkRoleDiscovery viewerRole={viewerRole} filters={params} />
      </div>
      <div id="network-company-list" className="mt-5">
        {<NetworkLaunchDiscovery directory={previewDirectory}
          filters={{q:params.q,role:params.role,region:params.region}}
          pagination={previewDirectory?.discovery_page} navigationParams={params} />}
      </div>
      <div className="mt-5"><NetworkReadyConnections items={readyItems} statuses={readiness} canAct={canInteractWithNetwork(context.role)}
         persona={persona} sharedProducts={sharedPublicProducts(intelligence)} /></div>
      {<section id="network-region-results" aria-labelledby="network-results">
        <FocusSectionHeader
          eyebrow="Esplora aziende"
          title={
            <span id="network-results">
              {canonicalUnavailable ? "Profili pubblicati" : results.total.toLocaleString("it-IT") + (results.total === 1 ? " azienda" : " aziende")}
            </span>
          }
          description="Esplora i profili aziendali della filiera e approfondisci le informazioni nelle schede."
          action={<Link href={appRoutes.network.connections}
            className="inline-flex min-h-10 items-center rounded-xl border border-[#c6d9cf] px-4 text-xs font-semibold text-[#173f35]">Connessioni aziendali →</Link>}

        />

        {canonicalUnavailable ? (
          <div role="status" className="rounded-2xl border border-[#e4d4b3] bg-[#fffaf1] p-5 text-sm text-[#72542b]">
            Impossibile caricare i profili pubblicati adesso. Prova la ricerca o esplora le nuove scoperte e la mappa.
          </div>
        ) : orderedResults.length === 0 ? (
          params.q || hasAdvancedFilters ? (
            <FirstUseEmptyState
              eyebrow="Ricerca senza risultati"
              title="Nessuna azienda trovata con questi filtri"
              description="Il Network non inventa profili mancanti. Azzera i filtri oppure amplia la ricerca per tornare all'elenco completo."
              primaryAction={{
                href: appRoutes.network.directory,
                label: "Azzera ricerca e filtri",
              }}
              secondaryAction={{
                href: appRoutes.network.connections,
                label: "Connessioni aziendali",
              }}
            />
          ) : (
            <FirstUseEmptyState
              title="Il Network crescerà con i Company Profile pubblici"
              description="Non ci sono ancora profili disponibili in questa vista. Puoi comunque completare il profilo della tua azienda così che sia pronto per discovery, matching e claim governato."
              primaryAction={{
                href: appRoutes.network.manage,
                label: "Completa Company Profile",
              }}
              secondaryAction={{
                href: appRoutes.home,
                label: "Torna al workspace",
              }}
            />
          )
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            {orderedResults.map((company, index) => {
              

              return (
                <article
                  key={company.id}
                  className={[
                    "grid gap-4 p-4 transition hover:bg-[#f8faf9] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center",
                    index > 0 ? "border-t border-[#edf1ef]" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">
                        {company.country_code || "—"}
                      </span>
                      {company.verification_status === "verified" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Verificata
                        </span>
                      ) : null}
                      {company.claimed_status === "unclaimed" ? (
                        <span className="rounded-full bg-[#fff4e8] px-2 py-0.5 text-[10px] font-bold text-[#8a461f]">
                          Profilo rivendicabile
                        </span>
                      ) : null}
                    </div>
                    <Link
                      href={appRoutes.network.company(company.id)}
                      className="mt-1 block truncate text-base font-semibold text-[#1d2824] hover:text-[#173f35] hover:underline"
                    >
                      {company.legal_name}
                    </Link>
                    <p className="mt-1 truncate text-xs text-[#5d6a65]">
                      {company.trading_name || company.website_domain || "Profilo Network"}
                    </p>
                    {!params.q && !hasAdvancedFilters && networkRoleReason(company.roles, persona) ? (
                      <p className="mt-1 text-xs font-semibold text-[#27714f]">{networkRoleReason(company.roles, persona)}</p>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">Ruolo & prodotti</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {compactList(company.roles).map((role) => (
                        <span key={role.name} className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-xs font-semibold text-[#173f35]">
                          {role.name}
                        </span>
                      ))}
                      {compactList(company.products).map((product) => (
                        <span key={product.name} className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-xs text-[#43524c]">
                          {product.name}
                        </span>
                      ))}
                      {company.roles.length === 0 && company.products.length === 0 ? (
                        <span className="text-xs text-[#5d6a65]">Non ancora classificata</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">Capability</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {compactList(company.capabilities).map((capability) => (
                        <span key={capability.name} className="rounded-full border border-[#dce2df] bg-white px-2.5 py-1 text-xs text-[#43524c]">
                          {capability.name}
                        </span>
                      ))}
                      {company.capabilities.length === 0 ? (
                        <span className="text-xs text-[#5d6a65]">Non pubblicate</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center lg:justify-end">
                    <Link href={appRoutes.network.company(company.id)} className="app-primary inline-flex min-h-10 items-center rounded-xl px-3.5 text-xs font-semibold">Esplora azienda</Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <NetworkPagination
          page={parseNetworkPage(params.p)} total={results.total} pageSize={18}
          parameter="p" params={params} anchor="network-region-results"
        />
      </section>}
      <div className="mt-6">
        <ItalyRegionMap coverage={coverage} provisionalCoverage={provisionalCoverage} selectedRegion={params.region} filters={params} />
      </div>
    </FocusPage>
  );
}
