import Link from "next/link";
import type {FreeCompany} from "@/lib/network-free";
import type {CompactNetworkFilters,CompactNetworkPage} from "@/lib/network-compact-directory";
import {NetworkMiniMap} from "@/components/network-resilient-first-screen";
import type {ItalyRegionCoverage,ItalyProvisionalGeoCoverage} from "@/lib/network-region-coverage";

type Props={
  accessMode:"free"|"pro"; directory:CompactNetworkPage; filters:CompactNetworkFilters;
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
  return <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#e8eeeb] px-3 py-3 last:border-b-0 sm:px-4 lg:grid-cols-[minmax(180px,1.65fr)_minmax(90px,.75fr)_minmax(145px,1fr)_minmax(110px,.8fr)_minmax(100px,.8fr)_auto] lg:gap-3 lg:py-2.5"
    data-testid="network-compact-company-row">
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4f0e9] text-[11px] font-bold text-[#175640]">
        {initialLetters(name)}
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-[#173f35]" title={name}>{name}</h3>
        {domain?<p className="truncate text-xs text-[#52615b]">{domain}</p>:null}
        <p className="mt-0.5 truncate text-[11px] text-[#52615b] lg:hidden">
          {role?(keys[role.key]||role.name):"Ruolo non indicato"}{location?" · "+location:""}
        </p>
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
      <p className="truncate text-xs font-medium text-[#43524c]">{company.country_code==="IT"?"Italia":company.country_code}</p>
      <p className="truncate text-[11px] text-[#52615b]">{location||"Sede non indicata"}</p>
    </div>
    <Link href={"/network/"+company.id}
      className="app-primary inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold sm:px-4">
      Esplora azienda <span className="ml-1 hidden sm:inline" aria-hidden="true">→</span>
    </Link>
  </article>;
}

export function NetworkCompactExperience({
  accessMode,directory,filters,coverage,provisionalCoverage,regions=[],additionalFilters,capabilityLabels={},
}:Props){
  const filterActive=Boolean(filters.q||filters.role||filters.region||filters.product||filters.capability||filters.market||filters.country);
  const knownTotals=!directory.discoveryUnavailable;
  const technicalOnly=Boolean(directory.technicalOnly);
  const companyCount=directory.total;
  return <main className="mx-auto w-full max-w-[1560px] space-y-3 pb-8" data-testid="network-compact-experience">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_235px]">
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
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Statistiche Network">
          {[
            {value:knownTotals?companyCount.toLocaleString("it-IT"):"—",label:filterActive?"Aziende nei risultati":"Aziende nel Network"},
            {value:directory.published.toLocaleString("it-IT"),label:"Profili pubblicati"},
            {value:knownTotals?directory.discovered.toLocaleString("it-IT"):"—",label:technicalOnly?"Censite non filtrabili":"Aziende censite"},
            {value:"4",label:"Ruoli nella filiera"},
          ].map(card=><div key={card.label} className="rounded-xl border border-[#d8e5dd] bg-white px-3 py-2.5">
            <p className="text-xl font-bold tabular-nums text-[#173f35]">{card.value}</p>
            <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#43524c]">{card.label}</p>
          </div>)}
        </div>
      </div>
      <div className="hidden lg:block [&_svg]:max-h-[112px] [&_section]:h-full [&_section]:px-3 [&_section]:py-2 [&_p:last-child]:hidden">
        <NetworkMiniMap coverage={coverage} provisionalCoverage={provisionalCoverage}
          filters={filters} fullMapHref={accessMode==="pro"?"/network?advanced=1#network-regional-map":"/network?map=1#network-regional-map"}/>
      </div>
    </div>

    <section aria-label="Ricerca e filtri delle aziende" className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-3 sm:p-4">
      <form action="/network" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="network-compact-search">Nome azienda o dominio</label>
        <input id="network-compact-search" type="search" name="q" maxLength={120}
          placeholder="Nome azienda o dominio (es. Padana Tubi, acciaitubi.it)"
          defaultValue={filters.q||""} className="h-11 min-w-0 flex-1 rounded-xl border border-[#c9d9d3] bg-white px-4 text-sm text-[#173f35] outline-none placeholder:text-[#68766f] focus-visible:ring-2 focus-visible:ring-[#438d7a]"/>
        {filters.role?<input type="hidden" name="role" value={filters.role}/>:null}
        {filters.region?<input type="hidden" name="region" value={filters.region}/>:null}
        {filters.product?<input type="hidden" name="product" value={filters.product}/>:null}
        {filters.capability?<input type="hidden" name="capability" value={filters.capability}/>:null}
        {filters.market?<input type="hidden" name="market" value={filters.market}/>:null}
        {filters.country?<input type="hidden" name="country" value={filters.country}/>:null}
        {filters.persona?<input type="hidden" name="persona" value={filters.persona}/>:null}
        <button type="submit" className="app-primary min-h-11 rounded-xl px-6 text-sm font-semibold">Cerca</button>
        {filterActive?<Link href="/network" className="app-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold">Azzera</Link>:null}
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-[#175640]">Ruolo</span>
        <nav aria-label="Ruolo nella filiera" className="flex flex-wrap gap-1.5">
          {roles.map(item=>{
            const selected=(filters.role||"")===item.key;
            return <Link key={item.key||"all"} href={filterUrl(filters,{role:item.key||null},"#network-results")}
              aria-current={selected?"page":undefined}
              className={"inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors "+
                (selected?"border-[#175640] bg-[#175640] text-white":"border-[#c6d9cf] bg-white text-[#175640] hover:bg-[#f7faf8]")}>
              {item.label}
            </Link>;
          })}
        </nav>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <form method="get" action="/network" aria-label="Filtri tecnici e geografici"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {filters.q?<input type="hidden" name="q" value={filters.q}/>:null}
          {filters.role?<input type="hidden" name="role" value={filters.role}/>:null}
          {filters.persona?<input type="hidden" name="persona" value={filters.persona}/>:null}
          {filters.region?<input type="hidden" name="region" value={filters.region}/>:null}
          {[
            {name:"product",label:"Prodotti",options:additionalFilters?.products||[]},
            {name:"capability",label:"Capability",options:additionalFilters?.capabilities||[]},
            {name:"market",label:"Mercato",options:additionalFilters?.markets||[]},
          ].map(group=><label key={group.name} className="sr-only-wrapper">
            <span className="sr-only">{group.label}</span>
            <select name={group.name} aria-label={group.label}
              defaultValue={filters[group.name as "product"|"capability"|"market"]||""}
              className="min-h-9 max-w-[165px] rounded-lg border border-[#c5d8cd] bg-white px-2.5 text-xs font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
              <option value="">{group.label}</option>
              {group.options.map(option=><option key={option.canonical_key} value={option.canonical_key}>{option.display_name}</option>)}
            </select>
          </label>)}
          <label>
            <span className="sr-only">Paese</span>
            <select name="country" aria-label="Paese" defaultValue={filters.country||"IT"}
              className="min-h-9 rounded-lg border border-[#c5d8cd] bg-white px-2.5 text-xs font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
              <option value="IT">Italia</option>
              <option value="DE">Germania</option>
              <option value="FR">Francia</option>
              <option value="ES">Spagna</option>
              <option value="US">USA</option>
              <option value="GB">Regno Unito</option>
              <option value="CH">Svizzera</option>
            </select>
          </label>
          <button type="submit" className="app-secondary inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold">Applica filtri</button>
        </form>
        <details className="group ml-auto text-xs text-[#175640]" open={Boolean(filters.region)}>
          <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-[#bcd4c7] bg-white px-3 font-semibold">
            Regione {filters.region?"· "+filters.region:""} <span aria-hidden="true">⌄</span>
          </summary>
          <form method="get" action="/network" className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#d7e3dc] bg-white p-3">
            {filters.q?<input type="hidden" name="q" value={filters.q}/>:null}
            {filters.role?<input type="hidden" name="role" value={filters.role}/>:null}
            {filters.persona?<input type="hidden" name="persona" value={filters.persona}/>:null}
            {filters.product?<input type="hidden" name="product" value={filters.product}/>:null}
            {filters.capability?<input type="hidden" name="capability" value={filters.capability}/>:null}
            {filters.market?<input type="hidden" name="market" value={filters.market}/>:null}
            {filters.country?<input type="hidden" name="country" value={filters.country}/>:null}
            <label htmlFor="compact-region" className="text-xs font-semibold">Regione</label>
            <select id="compact-region" name="region" defaultValue={filters.region||""}
              className="min-h-10 min-w-[160px] rounded-lg border border-[#c9d9d3] bg-white px-3 text-sm text-[#173f35]">
              <option value="">Tutte le regioni</option>
              {regions.map(item=><option key={item} value={item}>{item}</option>)}
            </select>
            <button type="submit" className="app-primary min-h-10 rounded-lg px-4 text-xs font-semibold">Applica</button>
          </form>
        </details>
      </div>
      {technicalOnly?<p role="status" className="mt-2 text-[11px] leading-5 text-[#52615b]">
        Filtri tecnici applicati ai soli profili con dati strutturati pubblicati. Le aziende censite senza attributi tecnici non sono incluse; non significa che non offrano questi prodotti o servizi.
      </p>:null}
    </section>

    <section id="network-results" aria-label="Risultati aziende" className="overflow-hidden rounded-2xl border border-[#d7e3dc] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8eeeb] px-3 py-2.5 sm:px-4">
        <h2 className="text-base font-semibold text-[#173f35]">
          {knownTotals?companyCount.toLocaleString("it-IT")+" aziende trovate":"Profili disponibili"}
        </h2>
        <div className="flex items-center gap-2 text-xs text-[#52615b]">
          <span className="hidden tabular-nums sm:inline">{directory.total?directory.first+"–"+directory.last+" di "+directory.total:"Nessun risultato"}</span>
          <span className="tabular-nums">{directory.page} / {directory.pages}</span>
          <nav aria-label="Pagine del Network" className="inline-flex overflow-hidden rounded-lg border border-[#d7e3dc]">
            {directory.page>1?<Link rel="prev" href={filterUrl(filters,{np:String(directory.page-1)},"#network-results")} className="inline-flex min-h-9 items-center px-3 font-semibold text-[#175640] hover:bg-[#edf5f2]" aria-label="Pagina precedente">←</Link>:<span className="inline-flex min-h-9 items-center px-3 text-[#b0bdb4]" aria-hidden="true">←</span>}
            {directory.page<directory.pages?<Link rel="next" href={filterUrl(filters,{np:String(directory.page+1)},"#network-results")} className="inline-flex min-h-9 items-center border-l border-[#d7e3dc] px-3 font-semibold text-[#175640] hover:bg-[#edf5f2]" aria-label="Pagina successiva">→</Link>:<span className="inline-flex min-h-9 items-center border-l border-[#d7e3dc] px-3 text-[#b0bdb4]" aria-hidden="true">→</span>}
          </nav>
        </div>
      </div>
      <div className="hidden grid-cols-[minmax(180px,1.65fr)_minmax(90px,.75fr)_minmax(145px,1fr)_minmax(110px,.8fr)_minmax(100px,.8fr)_auto] gap-3 border-b border-[#e8eeeb] bg-[#f9fbfa] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#52615b] lg:grid">
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
