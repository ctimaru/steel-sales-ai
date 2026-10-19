import Link from "next/link";

import { ITALY_REGION_PATHS } from "@/lib/italy-region-paths";
import { italyRegionFilterHref, provisionalRegionCount } from "@/components/italy-region-map";
import type { ItalyRegionCoverage, ItalyProvisionalGeoCoverage } from "@/lib/network-region-coverage";

const intents = [
  { role:"trader_distributor", label:"Cerco fornitori", detail:"Commercianti e distributori" },
  { role:"end_user", label:"Cerco clienti", detail:"Utilizzatori potenziali" },
  { role:"processor_service_provider", label:"Cerco terzisti", detail:"Lavorazioni e servizi" },
  { role:"producer", label:"Cerco produttori", detail:"Aziende della filiera" },
] as const;

function intentHref(role:string,filters:Record<string,string|undefined>) {
  const qs=new URLSearchParams();
  if (filters.persona)qs.set("persona",filters.persona);
  qs.set("role",role);
  return "/network?"+qs.toString()+"#network-new-discoveries";
}

/** Static, accessible navigation; safe even if no account-specific query succeeds. */
export function NetworkIntentShortcuts({
 filters,
}: {filters:Record<string,string|undefined>}) {
 return <nav aria-label="Percorsi commerciali" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
  {intents.map(item=><Link key={item.role} href={intentHref(item.role,filters)}
    aria-current={filters.role===item.role?"page":undefined}
    className={"flex min-h-[78px] flex-col justify-center rounded-xl border px-3 py-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
      (filters.role===item.role ? "border-[#175640] bg-[#e2eee7] text-[#143e30]" :
       "border-[#d9e5dc] bg-white text-[#173f35] hover:border-[#88b8a0] hover:bg-[#f3f9f5]")}>
    <span className="text-sm font-semibold">{item.label}</span>
    <span className="mt-1 text-xs leading-4 text-[#52615b]">{item.detail}</span>
  </Link>)}
 </nav>;
}

/** A compact real Italy region map, always usable even if DB coverage is unavailable. */
export function NetworkMiniMap({
 filters,coverage,provisionalCoverage,fullMapHref,
}: {filters:Record<string,string|undefined>;coverage?:ItalyRegionCoverage|null;provisionalCoverage?:ItalyProvisionalGeoCoverage|null;fullMapHref?:string}) {
 const coverageByRegion=new Map(coverage?.regions.map(item=>[item.name,item.count])??[]);
 return <section aria-label="Esplora l'Italia per regione" className="flex h-full flex-col rounded-2xl border border-[#d6e5dc] bg-white px-4 py-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#32745a]">Mappa Italia</p>
      <h2 className="text-sm font-semibold text-[#173f35]">20 regioni da esplorare</h2>
    </div>
    <Link href={fullMapHref||"/network#network-regional-map"} className="text-xs font-semibold text-[#175640] underline">Mappa completa ↗</Link>
   </div>
   <div className="mx-auto mt-2 w-full max-w-[190px]">
    <svg viewBox="0 0 800 875" role="group" aria-label="Seleziona una regione d'Italia" className="h-auto max-h-[185px] w-full">
     {ITALY_REGION_PATHS.map(region=>{
       const selected=filters.region===region.name;
       const count=coverageByRegion.get(region.name);
       const provisional=provisionalRegionCount(provisionalCoverage,region.name);
       return <a key={region.code} href={italyRegionFilterHref(filters,selected?null:region.name)}
         aria-label={region.name+(count!==undefined?" · "+count+" profili pubblicati":"")+(provisional?" · "+provisional+" da confermare":"")}
         aria-current={selected?"location":undefined}
         className="group cursor-pointer outline-none">
         <path d={region.path} fill={selected?"#12573d":count?"#8abb9f":provisional?"#e6cb85":"#dcebe2"}
           stroke="#fff" strokeWidth={3}
           className="transition-colors group-hover:fill-[#277e5b] group-focus-visible:fill-[#277e5b] group-focus-visible:stroke-[#a56523] group-focus-visible:stroke-[8px]"/>
         <title>{region.name}</title>
       </a>
     })}
    </svg>
   </div>
   <p className="mt-auto text-center text-[11px] leading-4 text-[#64766a]">Verde: pubblicate · Oro: da confermare. Nessuna sede viene stimata.</p>
 </section>;
}

export function NetworkAvailabilityNotice({label}:{label:string}){
 return <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e0d6bd] bg-[#fffaf0] px-4 py-3 text-xs text-[#745528]">
   <p><strong>{label}</strong> Puoi continuare con ricerca, categorie e mappa.</p>
   <Link href="/network" className="font-semibold underline">Riprova ↗</Link>
 </div>;
}

/** Used by the route-level boundary without rendering data or asserting entitlement. */
export function NetworkRecoveryScreen({retry}:{retry?:()=>void}){
 return <main className="mx-auto max-w-[1160px] px-4 py-6 sm:px-6">
  <section className="rounded-2xl border border-[#d6e5dc] bg-[#f0f6f2] p-5 sm:p-7">
   <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2a7056]">Smart Steel Sales · Network</p>
   <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#153e30] sm:text-3xl">Esplora la filiera dell'acciaio</h1>
   <p className="mt-2 max-w-2xl text-sm leading-6 text-[#50645a]">Ricerca aziende industriali, individua partner e scopri produttori, commercianti, terzisti e utilizzatori.</p>
   <form action="/network" method="get" className="mt-5 flex flex-col gap-2 sm:flex-row">
     <label htmlFor="network-recovery-search" className="sr-only">Cerca azienda</label>
     <input id="network-recovery-search" type="search" name="q" maxLength={120} placeholder="Nome azienda o dominio"
       className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bdd3c7] bg-white px-4 text-sm text-[#173f35]"/>
     <button className="app-primary min-h-12 rounded-xl px-5 text-sm font-semibold">Cerca aziende</button>
   </form>
   <div className="mt-4"><NetworkIntentShortcuts filters={{}} /></div>
  </section>
  <div className="mt-4"><NetworkAvailabilityNotice label="L'elenco aziende non si è caricato completamente." /></div>
  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_290px]">
    <section className="rounded-2xl border border-[#dce6e0] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#173f35]">Continua a esplorare</h2>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">Puoi utilizzare i percorsi di ricerca e la mappa; i profili aziendali verranno mostrati quando il servizio tornerà disponibile. Nessun dato è stato inventato.</p>
      <div className="mt-4 flex flex-wrap gap-2">
       {retry?<button type="button" onClick={retry} className="app-primary min-h-11 rounded-xl px-4 text-sm font-semibold">Riprova caricamento</button>:null}
       <Link href="/network/connections" className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Connessioni aziendali</Link>
       <Link href="/dashboard" className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">Workspace</Link>
      </div>
    </section>
    <NetworkMiniMap filters={{}} />
  </div>
 </main>;
}
