import {Fragment} from "react";
import {NetworkCountryFlag} from "@/components/network-country-flag";
import {NetworkCountryRegionFilters} from "@/components/network-country-region-filters";
import {networkCountryName} from "@/lib/network-eu-countries";
import {europeNutsRegionName} from "@/lib/network-eu-regions";
import type {EuropeRegionCoverage} from "@/lib/network-europe-regional";
import {NetworkLiveSearch} from "@/components/network-live-search";
import {NetworkConversation} from "@/components/network-conversation";
import Link from "next/link";
import {safeNetworkWebsiteUrl, type FreeCompany} from "@/lib/network-free";
import type {CompactNetworkFilters,CompactNetworkPage} from "@/lib/network-compact-directory";
import {NetworkEuropeanMap} from "@/components/network-europe-map";
import {NetworkCountryTicker} from "@/components/network-country-ticker";
import {NetworkSpecPanel,SpecMatchLine} from "@/components/network-spec-filters";
import {NetworkAutoSubmitSelect} from "@/components/network-auto-submit-select";
import {NetworkFilterClientForm} from "@/components/network-filter-client-form";
import {NetworkRfqSelectionBar} from "@/components/network-rfq-selection-bar";
import {NetworkFilterDrawer} from "@/components/network-filter-drawer";
import {NetworkSaveToggle} from "@/components/network-save-toggle";
import {isRfqReachable,networkRfqSelectionEnabled} from "@/lib/network-rfq-supplier-handoff";
import type {RecipientReadinessStatus} from "@/lib/network-recipient-readiness";
import {localizeTaxonomyOptions,networkLabelIt,networkNameIt} from "@/lib/network-taxonomy-it";
import type {SpecMatch} from "@/lib/network-spec-search";
import {NETWORK_SPEC_PARAMS,describeSpecFilters} from "@/lib/network-spec-filters";
import type {ItalyRegionCoverage,ItalyProvisionalGeoCoverage} from "@/lib/network-region-coverage";

type Props={
  accessMode:"free"|"pro"; directory:CompactNetworkPage; filters:CompactNetworkFilters;
  userId:string;organizationId:string;canCompose:boolean;
  coverage?:ItalyRegionCoverage|null; provisionalCoverage?:ItalyProvisionalGeoCoverage|null;
  europeCoverage?:EuropeRegionCoverage|null;
  capabilityLabels?:Record<string,string[]>; additionalFilters?:{
    products:{canonical_key:string;display_name:string}[];
    capabilities:{canonical_key:string;display_name:string}[];
    markets:{canonical_key:string;display_name:string}[];
  };
};
const roles=[
  {key:"",label:"Tutta la filiera"},
  {key:"producer",label:"Produttori"},
  {key:"trader_distributor",label:"Commercianti"},
  {key:"processor_service_provider",label:"Terzisti"},
  {key:"end_user",label:"Utilizzatori"},
] as const;
// One source of truth for widths: header and rows share the exact grid columns.
// NET-UX LOT1: Azienda · Ruolo · Località · Contatto. Products and capabilities
// move under the name (they rarely differ between rows and left columns empty).
const COMPANY_COLUMNS="lg:grid-cols-[minmax(240px,2.2fr)_minmax(110px,.8fr)_minmax(160px,1.1fr)_minmax(150px,.95fr)]";
const keys:Record<string,string>={
  producer:"Produttore",trader_distributor:"Commerciante",
  processor_service_provider:"Terzista",end_user:"Utilizzatore",
};
function filterUrl(filters:CompactNetworkFilters,changes:Record<string,string|null>={},hash=""){
  const q=new URLSearchParams();
  for(const [key,value] of Object.entries(filters)){
    if(value && key!=="np")q.set(key,value);
  }
  for(const [key,value] of Object.entries(changes)){if(value)q.set(key,value);else q.delete(key);}
  const search=q.toString();
  return "/network"+(search?"?"+search:"")+hash;
}
function companyDomain(company:FreeCompany){
  if(company.website_url){
    try {
      const url=new URL(company.website_url);
      if(url.protocol==="https:"||url.protocol==="http:")return url.hostname.replace(/^www\./,"");
    } catch {}
  }
  return null;
}
function initialLetters(name:string){
  const words=name.trim().split(/\s+/).filter(Boolean);
  return (words.length>1?words.slice(0,2).map(x=>x[0]).join(""):name.slice(0,2)).toUpperCase();
}
// NET-CONTACT1: not active on the platform, but has a reviewed public company email.
const EMAIL_REACHABLE_LABEL="Contattabile via email";
// NET-UX LOT1: "Connetti" is the only relationship with a Network company.
// NET-CONN3: companies not yet active keep a visible but disabled Connetti, so the
// relationship is discoverable. Readiness stays SQL-bound: only "available" links.
const CONNECT_UNAVAILABLE_HINT="Connetti sarà disponibile quando l’azienda sarà attiva sulla piattaforma";
function DisabledConnect({name,emailReachable}:{name:string;emailReachable?:boolean}){
  return <span className="relative z-10 flex flex-col items-end gap-0.5">
    <span role="button" aria-disabled="true" tabIndex={0} data-testid="network-row-connect-disabled"
      aria-label={"Connetti con "+name+": non ancora disponibile"} title={CONNECT_UNAVAILABLE_HINT}
      className="inline-flex min-h-10 cursor-not-allowed select-none items-center justify-center rounded-lg border border-[#d7e3dc] bg-[#f3f6f4] px-3 text-xs font-semibold text-[#52615b]">
      Connetti
    </span>
    <span className="text-[10px] leading-3 text-[#52615b]">
      {emailReachable?<span data-testid="network-email-reachable" title="Riceve la RFQ via email al contatto aziendale pubblico">{EMAIL_REACHABLE_LABEL}</span>:"Non ancora attiva"}
    </span>
  </span>;
}
function ContactCell({company,name,status,emailReachable,canAct}:{
  company:FreeCompany;name:string;status?:RecipientReadinessStatus;emailReachable?:boolean;canAct?:boolean;
}){
  // Unknown readiness (load failure) or non-canonical discovered records: say nothing rather than guess.
  if(status==="unavailable"&&canAct&&!company.discovery_status)return <DisabledConnect name={name} emailReachable={emailReachable}/>;
  if(status==="available")return <Link href={"/network/"+company.id+"/connect"} data-testid="network-row-connect"
    aria-label={"Connetti con "+name}
    className="ui-action ui-action-primary relative z-10 inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold">
    Connetti
  </Link>;
  if(status==="connected")return <span className="text-xs font-semibold text-[#175640]" data-testid="network-recipient-status">✓ Connessa</span>;
  if(status==="pending")return <span className="text-xs font-semibold text-[#175640]" data-testid="network-recipient-status">Richiesta inviata</span>;
  if(emailReachable)return <span className="text-xs font-semibold text-[#175640]" data-testid="network-email-reachable"
    title="Riceve la RFQ via email al contatto aziendale pubblico">{EMAIL_REACHABLE_LABEL}</span>;
  // NET-UX touch-up: no label when there is nothing to do (most companies are not yet active).
  return null;
}
function CompactCompanyRow({company,capabilities=[],specMatch,status,selectable,emailReachable,saved,returnTo,canAct}:{
  company:FreeCompany;capabilities?:string[];specMatch?:SpecMatch;
  status?:RecipientReadinessStatus;selectable?:boolean;emailReachable?:boolean;
  saved?:boolean;returnTo?:string;canAct?:boolean;
}){
  const name=company.trading_name||company.legal_name;
  const role=company.roles[0];
  const domain=companyDomain(company);
  const location=[company.location?.city,company.location?.region].filter(Boolean).join(" · ");
  const locationIndicative=company.geography_status==="sourced_unverified";
  const locationSource=safeNetworkWebsiteUrl(company.geo_source_url);
  const marketSource=safeNetworkWebsiteUrl(company.market_source_url);
  const countryCode=(company.country_code||"").toUpperCase();
  const countryLabel=networkCountryName(countryCode)||countryCode||"Paese non indicato";
  const offer=[...company.products.slice(0,2).map(networkNameIt),...capabilities.slice(0,2).map(networkNameIt)];
  const moreOffer=Math.max(0,company.products.length-2)+Math.max(0,capabilities.length-2);
  // NET-AUDIT1.4 / NET-UX LOT1: the whole row opens the profile through the
  // stretched name link; Connetti and source links sit above the overlay.
  return <article className={"relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e8eeeb] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[#f6faf8] sm:px-4 "+COMPANY_COLUMNS}
    data-testid="network-compact-company-row">
    <div className="flex min-w-0 items-center gap-3">
      {selectable?<input type="checkbox" form="network-rfq-selection" name="supplier" value={company.id}
        aria-label={"Seleziona "+name+" per una RFQ"} className="relative z-10 h-5 w-5 shrink-0 accent-[#175640]"/>:null}
      <span aria-hidden="true" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4f0e9] text-[11px] font-bold text-[#175640] sm:flex">
        {initialLetters(name)}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-[#173f35]" title={name}>
          <Link href={"/network/"+company.id} aria-label={"Apri profilo di "+name}
            className="after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">{name}</Link>
        </h3>
        <p className="truncate text-xs text-[#52615b]" data-testid="network-row-offer"
          title={[domain,...offer].filter(Boolean).join(" · ")}>
          {[domain,...offer].filter(Boolean).join(" · ")||"Offerta non indicata"}
          {moreOffer?<span className="ml-1 font-semibold text-[#175640]">+{moreOffer}</span>:null}
        </p>
        {specMatch?<SpecMatchLine match={specMatch} name={name}/>:null}
        {company.steel_priority?<p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-[#43524c]">
          <span className="font-semibold text-[#175640]">{company.steel_reason}</span>
          {company.steel_evidence_status==="candidate"?<span>· Da confermare</span>:
           company.steel_evidence_status==="accepted"?<span>· Fonte revisionata</span>:null}
          {safeNetworkWebsiteUrl(company.steel_source_url)?<a
            href={safeNetworkWebsiteUrl(company.steel_source_url)||"#"} target="_blank" rel="noopener noreferrer"
            className="relative z-10 font-semibold text-[#175640] underline underline-offset-2"
            aria-label={"Fonte rilevanza acciaio per "+name}>Fonte ↗</a>:null}
        </p>:null}
        {company.market_name?<p className="mt-0.5 truncate text-[11px] text-[#52615b]"
          title={company.market_evidence_status==="accepted"?"Settore documentato, revisionato":"Settore indicativo da confermare"}>
          <span className="font-semibold text-[#175640]">{company.market_name}</span>
          {" · "}{company.market_evidence_status==="accepted"?"settore documentato":"settore indicativo"}
          {marketSource?<a href={marketSource} target="_blank" rel="noopener noreferrer"
            className="relative z-10 ml-1 font-semibold text-[#175640] underline underline-offset-2"
            aria-label={"Fonte del settore per "+name}>Fonte ↗</a>:null}
        </p>:null}
        <p className="mt-0.5 truncate text-[11px] text-[#52615b] lg:hidden">
          {role?(keys[role.key]||role.name):"Ruolo non indicato"}{" · "}<NetworkCountryFlag code={countryCode}/> {location||countryLabel}
        </p>
      </div>
    </div>
    <div className="hidden min-w-0 lg:block">
      <span className="inline-block max-w-full truncate rounded-full bg-[#eaf4ee] px-2 py-1 text-[11px] font-semibold text-[#175640]">
        {role?(keys[role.key]||role.name):"Non indicato"}
      </span>
      {company.discovery_status==="unconfirmed"?<p className="mt-0.5 text-[10px] text-[#52615b]">Ruolo indicativo</p>:null}
    </div>
    <div className="hidden min-w-0 lg:block">
      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#173f35]" title={location||countryLabel}>
        <NetworkCountryFlag code={countryCode}/>
        <span className="truncate">{location||countryLabel}</span>
      </p>
      {locationIndicative&&location?<p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#52615b]">
        <span>Località indicativa</span>
        {locationSource?<a href={locationSource} target="_blank" rel="noopener noreferrer"
          aria-label={"Fonte della località indicativa di "+name}
          className="relative z-10 font-semibold text-[#175640] underline underline-offset-2">Fonte ↗</a>:null}
      </p>:!location?<p className="text-[10px] text-[#52615b]">Località da integrare</p>:null}
    </div>
    <div className="flex min-w-0 items-center justify-end gap-2 lg:justify-between">
      <ContactCell company={company} name={name} status={status} emailReachable={emailReachable} canAct={canAct}/>
      {/* NET-UX LOT1B: private list. Discovered (unconfirmed) records have no canonical profile to save. */}
      {returnTo&&!company.discovery_status?<NetworkSaveToggle companyId={company.id} name={name} saved={Boolean(saved)} returnTo={returnTo} compact/>:null}
    </div>
  </article>;
}

export function NetworkCompactExperience({
  accessMode,directory,filters,userId,organizationId,canCompose,europeCoverage,additionalFilters,capabilityLabels={},
}:Props){
  const specActive=NETWORK_SPEC_PARAMS.some(key=>Boolean(filters[key]));
  const filterActive=Boolean(filters.q||filters.role||filters.region||filters.product||filters.capability||filters.market||filters.country||filters.steel||specActive);
  const specMode=Boolean(directory.specMode);
  // NET-AUDIT1.3: off until the RFQ Hub receiver (lane B) exists.
  const rfqSelection=networkRfqSelectionEnabled();
  const specSummary=directory.spec?describeSpecFilters(directory.spec):"";
  const firstUndeclared=specMode?directory.items.findIndex(company=>directory.specMatches?.[company.id]?.status==="undeclared"):-1;
  const knownTotals=!directory.discoveryUnavailable;
  const technicalOnly=Boolean(directory.technicalOnly);
  const companyCount=directory.total;
  const listedLocationCount=directory.items.filter(company=>Boolean(company.location?.city||company.location?.region)).length;
  const savedIds=new Set(directory.savedIds??[]);
  const returnTo=filterUrl(filters,{np:directory.page>1?String(directory.page):null},"#network-results");
  const activeFilterCount=[filters.role,filters.region,filters.product,filters.capability,filters.market,
    filters.country&&filters.country!=="IT"?filters.country:null,specActive?"spec":null].filter(Boolean).length;
  const fullMapHref=accessMode==="pro"?"/network?advanced=1#network-regional-map":"/network?map=1#network-regional-map";
  const pager=(position:"top"|"bottom")=><nav aria-label={position==="top"?"Pagine del Network":"Pagine del Network (fondo elenco)"}
    className="inline-flex items-center gap-2 text-xs text-[#52615b]" data-testid={"network-pagination-"+position}>
    <span className="tabular-nums">{directory.total?directory.first+"–"+directory.last+" di "+directory.total:"Nessun risultato"}</span>
    <span className="inline-flex overflow-hidden rounded-lg border border-[#d7e3dc]">
      {directory.page>1?<Link rel="prev" href={filterUrl(filters,{np:String(directory.page-1)},"#network-results")} className="ui-action ui-action-secondary inline-flex min-h-10 min-w-10 items-center justify-center rounded-none border-0 px-3 font-semibold" aria-label="Pagina precedente">←</Link>:<span className="inline-flex min-h-10 min-w-10 items-center justify-center px-3 text-[#b0bdb4]" aria-hidden="true">←</span>}
      <span className="inline-flex min-h-10 items-center border-x border-[#d7e3dc] px-3 tabular-nums">{directory.page} / {directory.pages}</span>
      {directory.page<directory.pages?<Link rel="next" href={filterUrl(filters,{np:String(directory.page+1)},"#network-results")} className="ui-action ui-action-secondary inline-flex min-h-10 min-w-10 items-center justify-center rounded-none border-0 px-3 font-semibold" aria-label="Pagina successiva">→</Link>:<span className="inline-flex min-h-10 min-w-10 items-center justify-center px-3 text-[#b0bdb4]" aria-hidden="true">→</span>}
    </span>
  </nav>;
  // NET-UX LOT1: filters in a left column (drawer on phones); the list starts at the top.
  return <main className="mx-auto w-full max-w-[1560px] pb-8" data-testid="network-compact-experience">
    <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1" data-testid="network-europe1d-compact-header">
      <h1 className="text-2xl font-bold tracking-tight text-[#173f35]">Cerca aziende
        <span data-testid="network-access-mode" className="ml-2 align-middle rounded-full bg-[#e4f0e9] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#176647]">{accessMode==="pro"?"Pro":"Free"}</span>
      </h1>
      <p className="text-xs text-[#52615b]" aria-label="Statistiche Network">
        <strong className="tabular-nums text-[#173f35]">{directory.published.toLocaleString("it-IT")}</strong> profili pubblicati
        {knownTotals?<> · <strong className="tabular-nums text-[#173f35]">{directory.discovered.toLocaleString("it-IT")}</strong> {directory.marketEvidence?"con settore da fonte":technicalOnly?"censite non filtrabili":"censite da fonti pubbliche"}</>:null}
      </p>
    </header>
    <NetworkCountryTicker organizationId={organizationId} accessMode={accessMode}/>
    <div data-testid="network-europe1d-one-screen-shell" className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside aria-label="Filtri delle aziende" className="min-w-0 lg:sticky lg:top-24" data-testid="network-side-column">
        {/* NET-UX-MAP1: the European map is always visible, including on mobile. */}
        <div className="mb-3" data-testid="network-europe-persistent-map">
          <NetworkEuropeanMap filters={filters} coverage={europeCoverage} fullMapHref={fullMapHref}/>
        </div>
        <NetworkFilterDrawer activeCount={activeFilterCount}>
          <section aria-label="Ricerca e filtri delle aziende" className="space-y-4 rounded-2xl border border-[#d7e3dc] bg-white p-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#175640]">Ruolo nella filiera</p>
              <nav aria-label="Ruolo nella filiera" className="flex flex-wrap gap-1.5">
                {roles.map(item=>{
                  const selected=(filters.role||"")===item.key;
                  return <Link key={item.key||"all"} href={filterUrl(filters,{role:item.key||null,np:null},"#network-results")}
                    aria-current={selected?"page":undefined}
                    className={"ui-action inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors "+
                      (selected?"ui-action-primary":"ui-action-secondary")}>
                    {item.key?item.label:"Tutti"}
                  </Link>;
                })}
              </nav>
            </div>
            <NetworkFilterClientForm>
              {filters.q?<input type="hidden" name="q" value={filters.q}/>:null}
              {filters.role?<input type="hidden" name="role" value={filters.role}/>:null}
              {filters.persona?<input type="hidden" name="persona" value={filters.persona}/>:null}
              {filters.steel?<input type="hidden" name="steel" value={filters.steel}/>:null}
              {NETWORK_SPEC_PARAMS.map(key=>filters[key]?<input key={key} type="hidden" name={key} value={filters[key]}/>:null)}
              <p className="-mb-1 text-[11px] font-bold uppercase tracking-wider text-[#175640]">Dove</p>
              <NetworkCountryRegionFilters key={(filters.country||"IT")+"|"+(filters.region||"")} country={filters.country||"IT"} region={filters.region||""}/>
              <p className="-mb-1 text-[11px] font-bold uppercase tracking-wider text-[#175640]">Cosa offrono</p>
              {[
                {name:"product",label:"Prodotti",options:localizeTaxonomyOptions(additionalFilters?.products||[])},
                {name:"capability",label:"Lavorazioni e servizi",options:localizeTaxonomyOptions(additionalFilters?.capabilities||[])},
                {name:"market",label:"Mercato",options:localizeTaxonomyOptions(additionalFilters?.markets||[])},
              ].map(group=><label key={group.name} className="flex min-w-0 flex-col gap-1">
                <span className="sr-only">{group.label}</span>
                <NetworkAutoSubmitSelect name={group.name} aria-label={group.label}
                  defaultValue={filters[group.name as "product"|"capability"|"market"]||""}
                  className="h-10 w-full min-w-0 rounded-lg border border-[#b7cfc2] bg-white px-2.5 text-xs font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                  <option value="">{group.label}: tutti</option>
                  {group.options.map(option=><option key={option.canonical_key} value={option.canonical_key}>{option.display_name}</option>)}
                </NetworkAutoSubmitSelect>
              </label>)}
              {/* NET-AUDIT1.4: selects apply on change; this stays for no-JS and keyboard users. */}
              <button type="submit" className="ui-action ui-action-secondary sr-only inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold focus:not-sr-only">Applica filtri</button>
            </NetworkFilterClientForm>
            <NetworkSpecPanel filters={filters} accessMode={accessMode}/>
            {filterActive?<Link href="/network" className="ui-action ui-action-secondary inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold">Azzera filtri</Link>:null}
          </section>
        </NetworkFilterDrawer>
        {/* NET-AUDIT1.4: the chat stays beside the list, which stays visible while chatting. */}
        <div className="mt-3"><NetworkConversation userId={userId} organizationId={organizationId} canCompose={canCompose}/></div>
      </aside>
      <div className="min-w-0 space-y-3">
        <NetworkLiveSearch filters={filters}/>
      <div className="flex flex-wrap items-center gap-2" data-testid="network-sort">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[#175640]">Ordina</span>
        {!specMode&&!filters.product&&!filters.capability&&!filters.market&&(!filters.country||filters.country==="IT")?
          <Link href={filterUrl(filters,{steel:null,np:null},"#network-results")}
            aria-current={directory.steelMode?undefined:"page"}
            className={"ui-action inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold "+
              (directory.steelMode?"ui-action-secondary":"ui-action-primary")}>
            Pertinenza
          </Link>:null}
        {!specMode&&!filters.product&&!filters.capability&&!filters.market&&(!filters.country||filters.country==="IT")?
          <Link href={filterUrl(filters,{steel:"1",np:null},"#network-results")}
            aria-current={directory.steelMode?"page":undefined}
            data-testid="network-steel-ranking-toggle"
            className={"ui-action inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold "+
              (directory.steelMode?"ui-action-primary":"ui-action-secondary")}>
            {directory.steelMode?"✓ Priorità acciaio":"✦ Priorità acciaio"}
          </Link>:<span className="text-[11px] text-[#52615b]">
            {specMode?"compatibili prima, poi da verificare":"profili con dati strutturati"}
          </span>}
        {directory.steelMode?<span className="text-[11px] text-[#43524c]">
          {directory.steelEvidenceTotal??0} profili con evidenza tecnica pertinente o generica; gli altri restano consultabili.
        </span>:null}
      </div>
        <NetworkActiveFilters filters={filters} additionalFilters={additionalFilters} specSummary={specSummary}/>
      {filters.country||filters.region?<nav aria-label="Territorio selezionato" data-testid="network-europe1d-active-geography"
        className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#365a48]">
        <span className="font-semibold">Territorio:</span>
        <span className="inline-flex min-h-7 items-center rounded-full border border-[#c6ded0] bg-white px-2.5 font-semibold text-[#174b38]">
          {networkCountryName(filters.country||"IT")||"Italia"}
        </span>
        {filters.region?<Link href={filterUrl(filters,{region:null,np:null},"#network-results")}
          aria-label={"Rimuovi filtro regione "+(europeNutsRegionName(filters.country||"",filters.region)||filters.region)}
          className="ui-action ui-action-secondary inline-flex min-h-8 items-center rounded-full px-2.5 font-semibold">
          {europeNutsRegionName(filters.country||"",filters.region)||filters.region} <span aria-hidden="true" className="ml-1">×</span>
        </Link>:null}
        <span className="text-[#52615b]">Mappa e risultati sincronizzati</span>
      </nav>:null}
      {specMode?<p role="status" className="mt-2 text-[11px] leading-5 text-[#52615b]" data-testid="network-spec-status">
        {directory.specLocked?"Ricerca per specifica disponibile nel Network Pro: lo scope tecnico dei profili (norme, gradi, misure) non è incluso nel Free.":
          "Specifica "+specSummary+": prima le aziende con scope tecnico pubblicato compatibile, poi quelle che non lo hanno dichiarato. Chi dichiara una norma, un grado o una misura diversi è escluso. La compatibilità dichiarata non è una conferma di disponibilità."}
        {directory.specIgnored?.length?" Non combinati con la specifica: "+directory.specIgnored.map(key=>({product:"prodotto",capability:"capability",market:"mercato",country:"Paese estero"} as const)[key]).join(", ")+".":""}
      </p>:directory.regionPublishedOnly?<p role="status" className="mt-2 text-[11px] leading-5 text-[#52615b]">
        {directory.geoInvalid?"Regione europea non riconosciuta. Seleziona una regione valida dai filtri. Nessuna ricerca nazionale è stata eseguita.":"Area "+(europeNutsRegionName(filters.country||"",filters.region||"")||filters.region)+" · risultati limitati a sedi pubblicate associate con codice NUTS 2024 o nome ufficiale. L'assenza di risultati non dimostra che non esistano aziende nella regione."}
      </p>:technicalOnly?<p role="status" className="mt-2 text-[11px] leading-5 text-[#52615b]">
        {directory.steelMode?
          "Priorità acciaio: ordinamento sull’intero Network per prove tecniche disponibili. Le fonti candidate sono indicative e non attestano acquisti di tubi, capacità produttiva, disponibilità o qualifica di fornitore.":
        directory.marketEvidence?
          "Mercato: include profili pubblicati e schede scoperte con fonte ufficiale. Settore indicativo non significa azienda verificata, acquirente confermato o capacità produttiva certificata.":
          "Filtri tecnici applicati ai soli profili con dati strutturati pubblicati. Le aziende censite senza attributi tecnici non sono incluse; non significa che non offrano questi prodotti o servizi."}
      </p>:null}
        <section id="network-results" aria-label="Risultati aziende" className="overflow-hidden rounded-2xl border border-[#d7e3dc] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eeeb] px-3 py-2.5 sm:px-4">
            <h2 className="text-base font-semibold text-[#173f35]">
              {specMode?(directory.specExactTotal??0).toLocaleString("it-IT")+" compatibili"+
                (directory.specUndeclaredTotal?" · "+directory.specUndeclaredTotal.toLocaleString("it-IT")+" da verificare":""):
                knownTotals?companyCount.toLocaleString("it-IT")+" aziende trovate":"Profili disponibili"}
            </h2>
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] text-[#52615b] xl:inline" title="Località pubblicate o provenienti da fonti consultabili; quelle indicative non equivalgono a una sede certificata">Località disponibili: {listedLocationCount}/{directory.items.length}</span>
              {pager("top")}
            </div>
          </div>
          <div className={"hidden gap-3 border-b border-[#e8eeeb] bg-[#f9fbfa] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52615b] lg:grid "+COMPANY_COLUMNS}>
            <span>Azienda</span><span>Ruolo</span><span>Località</span><span>Contatto</span>
          </div>
      {directory.specLocked?<div className="px-4 py-9 text-center text-sm text-[#52615b]" data-testid="network-spec-locked">
          La ricerca per norma, grado e misure è inclusa nel Network Pro. Puoi continuare a cercare per nome, ruolo e regione.
        </div>:
      directory.items.length?directory.items.map((company,index)=><Fragment key={company.id}>
          {index===firstUndeclared?<p className="border-b border-[#e8eeeb] bg-[#f9fbfa] px-4 py-2 text-[11px] font-semibold text-[#43524c]" data-testid="network-spec-undeclared-divider">
            Scope tecnico non dichiarato · aziende della filiera tubo da verificare direttamente
          </p>:null}
          <CompactCompanyRow company={company} capabilities={capabilityLabels[company.id]||[]} specMatch={directory.specMatches?.[company.id]}
            status={directory.recipientStatus?.[company.id]}
            emailReachable={directory.rfqChannel?.[company.id]==="email"&&!["available","connected"].includes(directory.recipientStatus?.[company.id]??"")}
            saved={savedIds.has(company.id)} returnTo={accessMode==="pro"&&canCompose?returnTo:undefined} canAct={canCompose}
            selectable={rfqSelection&&accessMode==="pro"&&isRfqReachable(directory.recipientStatus?.[company.id],directory.rfqChannel?.[company.id])}/>
        </Fragment>):
        <div className="px-4 py-9 text-center text-sm text-[#52615b]">{specMode?"Nessuna azienda con scope tecnico compatibile o non dichiarato per "+specSummary+". Prova a togliere un criterio, ad esempio il grado o una misura.":
          directory.regionPublishedOnly?"Nessuna sede pubblicata mappata per questa selezione; la copertura geografica del Network è ancora parziale.":"Nessuna azienda trovata. Prova un altro nome o azzera i filtri."}</div>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8eeeb] bg-[#f9fbfa] px-3 py-2 sm:px-4">
            <p className="max-w-2xl text-[11px] leading-5 text-[#52615b]">
              Profili da aziende registrate e da fonti pubbliche. Apri il profilo per fonti, verifiche e rivendicazione. Puoi connetterti con le aziende già attive sulla piattaforma.
              {directory.discoveryUnavailable?" Alcune aziende censite sono temporaneamente indisponibili.":""}
            </p>
            {directory.pages>1?pager("bottom"):null}
          </div>
        </section>
        {rfqSelection&&accessMode==="pro"?<NetworkRfqSelectionBar userId={userId} organizationId={organizationId} specSummary={specSummary||undefined}/>:null}
      </div>
    </div>
  </main>;
}

/** NET-AUDIT1.4 — every active filter as a removable chip (geography keeps its own row). */
function NetworkActiveFilters({filters,additionalFilters,specSummary}:{
  filters:CompactNetworkFilters;specSummary:string;
  additionalFilters?:Props["additionalFilters"];
}){
  const label=(list:{canonical_key:string;display_name:string}[]|undefined,key?:string)=>
    networkLabelIt(key,list?.find(item=>item.canonical_key===key)?.display_name);
  type Chip={key:string;text:string;remove:Record<string,string|null>};
  const specClear:Record<string,string|null>=Object.fromEntries(NETWORK_SPEC_PARAMS.map(key=>[key,null]));
  const candidates:(Chip|null)[]=[
    filters.q?{key:"q",text:"Nome: "+filters.q,remove:{q:null}}:null,
    filters.role?{key:"role",text:roles.find(item=>item.key===filters.role)?.label||filters.role,remove:{role:null}}:null,
    filters.product?{key:"product",text:label(additionalFilters?.products,filters.product),remove:{product:null}}:null,
    filters.capability?{key:"capability",text:label(additionalFilters?.capabilities,filters.capability),remove:{capability:null}}:null,
    filters.market?{key:"market",text:label(additionalFilters?.markets,filters.market),remove:{market:null}}:null,
    specSummary?{key:"spec",text:"Specifica: "+specSummary,remove:specClear}:null,
    filters.steel?{key:"steel",text:"Priorità acciaio",remove:{steel:null}}:null,
  ];
  const chips=candidates.filter((chip):chip is Chip=>chip!==null);
  if(!chips.length)return null;
  return <nav aria-label="Filtri attivi" data-testid="network-active-filters"
    className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#365a48]">
    <span className="font-semibold">Filtri attivi:</span>
    {chips.map(chip=><Link key={chip.key} href={filterUrl(filters,{...chip.remove,np:null},"#network-results")}
      aria-label={"Rimuovi filtro "+chip.text}
      className="ui-action ui-action-secondary inline-flex min-h-8 max-w-[260px] items-center rounded-full px-2.5 font-semibold">
      <span className="truncate">{chip.text}</span> <span aria-hidden="true" className="ml-1">×</span>
    </Link>)}
  </nav>;
}
