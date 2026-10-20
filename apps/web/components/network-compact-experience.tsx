import {NetworkCountryFlag} from "@/components/network-country-flag";
import {NetworkCountryRegionFilters} from "@/components/network-country-region-filters";
import {networkCountryName} from "@/lib/network-eu-countries";
import {NetworkLiveSearch} from "@/components/network-live-search";
import {NetworkConversation} from "@/components/network-conversation";
import Link from "next/link";
import {safeNetworkWebsiteUrl, type FreeCompany} from "@/lib/network-free";
import type {CompactNetworkFilters,CompactNetworkPage} from "@/lib/network-compact-directory";
import {NetworkEuropeanMap} from "@/components/network-europe-map";
import type {ItalyRegionCoverage,ItalyProvisionalGeoCoverage} from "@/lib/network-region-coverage";

type Props={
  accessMode:"free"|"pro"; directory:CompactNetworkPage; filters:CompactNetworkFilters;
  userId:string;organizationId:string;canCompose:boolean;
  coverage?:ItalyRegionCoverage|null; provisionalCoverage?:ItalyProvisionalGeoCoverage|null;
  regions?:string[]; capabilityLabels?:Record<string,string[]>; additionalFilters?:{
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
const COMPANY_COLUMNS="lg:grid-cols-[minmax(210px,2fr)_minmax(110px,.84fr)_minmax(140px,1.05fr)_minmax(125px,.95fr)_minmax(165px,1.12fr)_136px]";
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
function CompactCompanyRow({company,capabilities=[]}:{company:FreeCompany;capabilities?:string[]}){
  const name=company.trading_name||company.legal_name;
  const role=company.roles[0];
  const domain=companyDomain(company);
  const location=[company.location?.city,company.location?.region].filter(Boolean).join(" · ");
  const locationIndicative=company.geography_status==="sourced_unverified";
  const locationSource=safeNetworkWebsiteUrl(company.geo_source_url);
  const marketSource=safeNetworkWebsiteUrl(company.market_source_url);
  const countryCode=(company.country_code||"").toUpperCase();
  const countryLabel=networkCountryName(countryCode)||countryCode||"Paese non indicato";
  return <article className={"grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e8eeeb] px-3 py-3 last:border-b-0 sm:px-4 lg:py-2.5 "+COMPANY_COLUMNS}
    data-testid="network-compact-company-row">
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4f0e9] text-[11px] font-bold text-[#175640]">
        {initialLetters(name)}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-[#173f35]" title={name}>{name}</h3>
        {domain?<p className="truncate text-xs text-[#52615b]">{domain}</p>:null}
        {company.steel_priority?<p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4 text-[#43524c]">
          <span className="font-semibold text-[#175640]">{company.steel_reason}</span>
          {company.steel_evidence_status==="candidate"?<span>· Da confermare</span>:
           company.steel_evidence_status==="accepted"?<span>· Fonte revisionata</span>:null}
          {safeNetworkWebsiteUrl(company.steel_source_url)?<a
            href={safeNetworkWebsiteUrl(company.steel_source_url)||"#"} target="_blank" rel="noopener noreferrer"
            className="font-semibold text-[#175640] underline underline-offset-2"
            aria-label={"Fonte rilevanza acciaio per "+name}>Fonte ↗</a>:null}
        </p>:null}
        {company.market_name?<p className="mt-0.5 truncate text-[11px] text-[#52615b]"
          title={company.market_evidence_status==="accepted"?"Settore documentato, revisionato":"Settore indicativo da confermare"}>
          <span className="font-semibold text-[#175640]">{company.market_name}</span>
          {" · "}{company.market_evidence_status==="accepted"?"settore documentato":"settore indicativo"}
          {marketSource?<a href={marketSource} target="_blank" rel="noopener noreferrer"
            className="ml-1 font-semibold text-[#175640] underline underline-offset-2"
            aria-label={"Fonte del settore per "+name}>Fonte ↗</a>:null}
        </p>:null}
        <p className="mt-0.5 truncate text-[11px] text-[#52615b] lg:hidden">
          {role?(keys[role.key]||role.name):"Ruolo non indicato"}{" · "}<NetworkCountryFlag code={countryCode}/> {countryLabel}{location?" · "+location:""}{locationIndicative && location?" · località indicativa":""}
        </p>
        {locationSource&&locationIndicative&&location?
          <a href={locationSource} target="_blank" rel="noopener noreferrer"
            className="mt-0.5 inline-flex text-[11px] font-semibold text-[#175640] underline underline-offset-2 lg:hidden"
            aria-label={"Fonte della località indicativa di "+name}>Fonte località ↗</a>:null}
      </div>
    </div>
    <div className="hidden min-w-0 lg:block">
      <span className="inline-block max-w-full truncate rounded-full bg-[#eaf4ee] px-2 py-1 text-[11px] font-semibold text-[#175640]">
        {role?(keys[role.key]||role.name):"Non indicato"}
      </span>
      {company.discovery_status==="unconfirmed"?<p className="mt-0.5 text-[10px] text-[#52615b]">Ruolo indicativo</p>:null}
    </div>
    <div className="hidden min-w-0 flex-wrap gap-1 lg:flex">
      {company.products.length?company.products.slice(0,2).map((product,index)=>
        <span key={index} className="max-w-full truncate rounded-full bg-[#f1f5f2] px-2 py-1 text-[11px] text-[#43524c]" title={product}>{product}</span>
      ):<span className="text-xs text-[#647269]">Non indicati</span>}
    </div>
    <div className="hidden min-w-0 lg:block">
      {capabilities.length?<div className="flex flex-wrap gap-1">{capabilities.slice(0,2).map((name,i)=><span key={i} className="max-w-full truncate rounded-full border border-[#d7e3dc] bg-[#f9fbfa] px-2 py-1 text-[11px] text-[#43524c]" title={name}>{name}</span>)}</div>:<span className="text-xs text-[#647269]">Non indicate</span>}
    </div>
    <div className="hidden min-w-0 lg:block">
      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-[#173f35]">
        <NetworkCountryFlag code={countryCode}/>
        <span className="truncate">{countryLabel}</span>
      </p>
      <p className="truncate text-[11px] text-[#52615b]" title={location||"Località da integrare"}>
        {location||"Località da integrare"}
      </p>
      {locationIndicative&&location?<p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#52615b]">
        <span>Località indicativa</span>
        {locationSource?<a href={locationSource} target="_blank" rel="noopener noreferrer"
          aria-label={"Fonte della località indicativa di "+name}
          className="font-semibold text-[#175640] underline underline-offset-2">Fonte ↗</a>:null}
      </p>:null}
    </div>
    <Link href={"/network/"+company.id}
      aria-label={"Apri profilo di "+name}
      className="ui-action ui-action-primary inline-flex min-h-10 w-full min-w-[80px] sm:min-w-[112px] items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-3 text-xs font-semibold">
      <span className="sm:hidden">Apri</span><span className="hidden sm:inline">Esplora azienda</span><span className="ml-1 hidden sm:inline" aria-hidden="true">→</span>
    </Link>
  </article>;
}

export function NetworkCompactExperience({
  accessMode,directory,filters,userId,organizationId,canCompose,regions=[],additionalFilters,capabilityLabels={},
}:Props){
  const filterActive=Boolean(filters.q||filters.role||filters.region||filters.product||filters.capability||filters.market||filters.country||filters.steel);
  const knownTotals=!directory.discoveryUnavailable;
  const technicalOnly=Boolean(directory.technicalOnly);
  const companyCount=directory.total;
  const listedLocationCount=directory.items.filter(company=>Boolean(company.location?.city||company.location?.region)).length;
  return <main className="mx-auto w-full max-w-[1560px] space-y-3 pb-8" data-testid="network-compact-experience">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#176647]">Smart Steel Sales · Network <span data-testid="network-access-mode" className="ml-2 rounded-full bg-[#e4f0e9] px-2 py-1 tracking-normal">Modalità {accessMode==="pro"?"Pro":"Free"}</span></p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#173f35] sm:text-3xl">Trova aziende steel</h1>
            <p className="mt-1 text-xs leading-5 text-[#52615b] sm:text-sm">
              Cerca produttori, commercianti, terzisti e utilizzatori della filiera dell’acciaio.
            </p>
          </div>
          <Link href="/network/connections" className="text-xs font-semibold text-[#176647] underline underline-offset-2">Le mie connessioni →</Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-[#d8e5dd] bg-white px-3 py-2" aria-label="Statistiche Network">
          {[
            {value:knownTotals?companyCount.toLocaleString("it-IT"):"—",label:filterActive?"Aziende nei risultati":"Aziende nel Network"},
            {value:directory.published.toLocaleString("it-IT"),label:"Profili pubblicati"},
            {value:knownTotals?directory.discovered.toLocaleString("it-IT"):"—",label:directory.marketEvidence?"Settore da fonte":technicalOnly?"Censite non filtrabili":"Aziende censite"},
          ].map(card=><div key={card.label} className="flex items-baseline gap-2">
            <p className="text-sm font-bold tabular-nums text-[#173f35]">{card.value}</p>
            <p className="text-[11px] font-medium leading-4 text-[#43524c]">{card.label}</p>
          </div>)}
        </div>
      </div>
      <div className="hidden min-w-0 lg:block">
        <NetworkEuropeanMap filters={filters}
          fullMapHref={accessMode==="pro"?"/network?advanced=1#network-regional-map":"/network?map=1#network-regional-map"}/>
      </div>
    </div>
    <details className="rounded-xl border border-[#d8e5dd] bg-white lg:hidden" data-testid="network-compact-mobile-map">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        Mappa interattiva dell'Unione europea <span aria-hidden="true">⌄</span>
      </summary>
      <div className="px-3 pb-3">
        <NetworkEuropeanMap filters={filters}
          fullMapHref={accessMode==="pro"?"/network?advanced=1#network-regional-map":"/network?map=1#network-regional-map"}/>
      </div>
    </details>

    <section aria-label="Ricerca e filtri delle aziende" className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-3 sm:p-4">
      <NetworkLiveSearch filters={filters}/>
      <NetworkConversation userId={userId} organizationId={organizationId} canCompose={canCompose}/>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!filters.product&&!filters.capability&&!filters.market&&(!filters.country||filters.country==="IT")?
          <Link href={filterUrl(filters,{steel:directory.steelMode?null:"1",np:null},"#network-results")}
            aria-current={directory.steelMode?"page":undefined}
            data-testid="network-steel-ranking-toggle"
            className={"ui-action inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold "+
              (directory.steelMode?"ui-action-primary":"ui-action-secondary")}>
            {directory.steelMode?"✓ Priorità acciaio attiva":"✦ Priorità acciaio"}
          </Link>:null}
        {directory.steelMode?<span className="text-[11px] text-[#43524c]">
          {directory.steelEvidenceTotal??0} profili con evidenza tecnica pertinente o generica; gli altri restano consultabili.
        </span>:null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[#175640]">Ruolo</span>
        <nav aria-label="Ruolo nella filiera" className="flex flex-wrap gap-1.5">
          {roles.map(item=>{
            const selected=(filters.role||"")===item.key;
            return <Link key={item.key||"all"} href={filterUrl(filters,{role:item.key||null},"#network-results")}
              aria-current={selected?"page":undefined}
              className={"ui-action inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors "+
                (selected?"ui-action-primary":"ui-action-secondary")}>
              {item.label}
            </Link>;
          })}
        </nav>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <form method="get" action="/network" aria-label="Filtri tecnici e geografici"
          className="grid w-full min-w-0 flex-1 grid-cols-2 items-center gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          {filters.q?<input type="hidden" name="q" value={filters.q}/>:null}
          {filters.role?<input type="hidden" name="role" value={filters.role}/>:null}
          {filters.persona?<input type="hidden" name="persona" value={filters.persona}/>:null}
          <NetworkCountryRegionFilters key={(filters.country||"IT")+"|"+(filters.region||"")} country={filters.country||"IT"} region={filters.region||""} regions={regions}/>
          {[
            {name:"product",label:"Prodotti",options:additionalFilters?.products||[]},
            {name:"capability",label:"Capability",options:additionalFilters?.capabilities||[]},
            {name:"market",label:"Mercato",options:additionalFilters?.markets||[]},
          ].map(group=><label key={group.name} className="min-w-0">
            <span className="sr-only">{group.label}</span>
            <select name={group.name} aria-label={group.label}
              defaultValue={filters[group.name as "product"|"capability"|"market"]||""}
              className="h-10 w-full min-w-0 rounded-lg border border-[#b7cfc2] bg-white px-2.5 text-xs font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
              <option value="">{group.label}</option>
              {group.options.map(option=><option key={option.canonical_key} value={option.canonical_key}>{option.display_name}</option>)}
            </select>
          </label>)}
          <button type="submit" className="ui-action ui-action-secondary col-span-2 inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold sm:col-span-1">Applica filtri</button>
        </form>
        {filterActive?<Link href="/network" className="ui-action ui-action-secondary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold">Azzera filtri</Link>:null}
      </div>
      {technicalOnly?<p role="status" className="mt-2 text-[11px] leading-5 text-[#52615b]">
        {directory.steelMode?
          "Priorità acciaio: ordinamento sull’intero Network per prove tecniche disponibili. Le fonti candidate sono indicative e non attestano acquisti di tubi, capacità produttiva, disponibilità o qualifica di fornitore.":
        directory.marketEvidence?
          "Mercato: include profili pubblicati e schede scoperte con fonte ufficiale. Settore indicativo non significa azienda verificata, acquirente confermato o capacità produttiva certificata.":
          "Filtri tecnici applicati ai soli profili con dati strutturati pubblicati. Le aziende censite senza attributi tecnici non sono incluse; non significa che non offrano questi prodotti o servizi."}
      </p>:null}
    </section>

    <section id="network-results" aria-label="Risultati aziende" className="overflow-hidden rounded-2xl border border-[#d7e3dc] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eeeb] px-3 py-2.5 sm:px-4">
        <h2 className="text-base font-semibold text-[#173f35]">
          {knownTotals?companyCount.toLocaleString("it-IT")+" aziende trovate":"Profili disponibili"}
        </h2>
        <div className="flex items-center gap-2 text-xs text-[#52615b]">
          <span className="hidden text-[11px] text-[#52615b] md:inline" title="Località pubblicate o provenienti da fonti consultabili; quelle indicative non equivalgono a una sede certificata">Località disponibili: {listedLocationCount}/{directory.items.length}</span>
          <span className="hidden tabular-nums sm:inline">{directory.total?directory.first+"–"+directory.last+" di "+directory.total:"Nessun risultato"}</span>
          <span className="tabular-nums">{directory.page} / {directory.pages}</span>
          <nav aria-label="Pagine del Network" className="inline-flex overflow-hidden rounded-lg border border-[#d7e3dc]">
            {directory.page>1?<Link rel="prev" href={filterUrl(filters,{np:String(directory.page-1)},"#network-results")} className="ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-none border-0 px-3 font-semibold" aria-label="Pagina precedente">←</Link>:<span className="inline-flex min-h-9 items-center px-3 text-[#52615b]" aria-hidden="true">←</span>}
            {directory.page<directory.pages?<Link rel="next" href={filterUrl(filters,{np:String(directory.page+1)},"#network-results")} className="ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-none border-y-0 border-r-0 px-3 font-semibold" aria-label="Pagina successiva">→</Link>:<span className="inline-flex min-h-9 items-center border-l border-[#d7e3dc] px-3 text-[#b0bdb4]" aria-hidden="true">→</span>}
          </nav>
        </div>
      </div>
      <div className={"hidden gap-3 border-b border-[#e8eeeb] bg-[#f9fbfa] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52615b] lg:grid "+COMPANY_COLUMNS}>
        <span>Azienda</span><span>Ruolo</span><span>Prodotti dichiarati</span><span>Capability</span><span>Località</span><span className="sr-only">Azione</span>
      </div>
      {directory.items.length?directory.items.map(company=><CompactCompanyRow key={company.id} company={company} capabilities={capabilityLabels[company.id]||[]}/>):
        <div className="px-4 py-9 text-center text-sm text-[#52615b]">Nessuna azienda trovata. Prova un altro nome o azzera i filtri.</div>}
      <p className="border-t border-[#e8eeeb] bg-[#f9fbfa] px-4 py-2 text-[11px] leading-5 text-[#52615b]">
        I profili comprendono aziende registrate e dati raccolti da fonti pubbliche. Per verifiche, fonti e rivendicazione apri il profilo. Le connessioni sono disponibili solo verso aziende attive.
        {directory.discoveryUnavailable?" Alcune aziende censite sono temporaneamente indisponibili.":""}
      </p>
    </section>
  </main>;
}
