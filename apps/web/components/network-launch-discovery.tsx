import Link from "next/link";

import type { FreeDirectory } from "@/lib/network-free";
import { safeNetworkWebsiteUrl } from "@/lib/network-free";

const roleLabels: Record<string,string>={
 producer:"Produttore (indicativo)",
 trader_distributor:"Commerciante (indicativo)",
 processor_service_provider:"Terzista (indicativo)",
 end_user:"Utilizzatore (indicativo)",
};

/** NET-LAUNCH1: also show Free unconfirmed discoveries to users with Pro entitlements.
 * No Pro-only data, personal contacts or provisional qualification claims. */
export function NetworkLaunchDiscovery({
 directory, filters,
}:{
 directory: FreeDirectory | null;
 filters: {q?:string;role?:string;region?:string};
}){
 const found=(directory?.items??[]).filter(item=>item.discovery_status==="unconfirmed");
 const total=directory?.discovered_total??0;
 const filtered=Boolean(filters.q?.trim()||filters.role||filters.region);
 const clearParams=new URLSearchParams();
 if(filters.q?.trim())clearParams.set("q",filters.q.trim());
 if(filters.role)clearParams.set("role",filters.role);
 const resetPath="/network"+(clearParams.size?"?"+clearParams.toString():"")+"#network-new-discoveries";
 if(!directory)return null;
 return <section id="network-new-discoveries" aria-labelledby="network-new-discoveries-title"
    className="rounded-3xl border border-[#bcd8c8] bg-[#f5faf6] p-4 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
     <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#277052]">Network in crescita</p>
     <h2 id="network-new-discoveries-title" className="mt-1 text-xl font-semibold text-[#173f35]">Nuove aziende scoperte</h2>
     <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
       Profili individuati da ricerca e fonti strutturate. La categoria è indicativa:
       non sono aziende verificate, clienti confermati né fornitori qualificati.
     </p>
    </div>
    <div className="rounded-xl border border-[#c5ddcb] bg-white px-4 py-2 text-center">
     <p className="text-2xl font-bold tabular-nums text-[#173f35]">{total.toLocaleString("it-IT")}</p>
     <p className="text-[11px] text-[#52615b]">Da confermare{filtered?" · filtro corrente":""}</p>
    </div>
   </div>
   {found.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     {found.map(company=>{
      const url=safeNetworkWebsiteUrl(company.website_url);
      return <article key={company.id} className="flex min-w-0 flex-col justify-between rounded-2xl border border-[#d6e4dc] bg-white p-4">
       <div>
        <span className="inline-block rounded-full bg-[#f8efd9] px-2.5 py-1 text-[10px] font-semibold text-[#795521]">Da confermare</span>
        <h3 className="mt-3 break-words text-sm font-bold text-[#173f35]">{company.legal_name}</h3>
        <p className="mt-1 text-xs text-[#64746a]">
         {company.roles[0]?.key&&roleLabels[company.roles[0].key]||"Settore da classificare"}
        </p>
        {company.finished_only?<p className="mt-2 text-[11px] leading-5 text-[#7c6244]">Utilizzo di tubi non documentato</p>:null}
       </div>
       <div className="mt-4 flex flex-wrap gap-2">
        <Link href={"/network/"+company.id} className="inline-flex min-h-10 items-center rounded-lg bg-[#173f35] px-3 text-xs font-semibold text-white">Apri profilo</Link>
        {url?<a href={url} target="_blank" rel="noopener noreferrer"
           className="inline-flex min-h-10 items-center rounded-lg border border-[#d2ded6] px-3 text-xs font-semibold text-[#173f35]">Sito aziendale ↗</a>:null}
       </div>
      </article>;
     })}
   </div>:<div className="mt-4 rounded-xl border border-[#d3e2d8] bg-white p-4 text-sm text-[#52615b]">
     {filtered?"Nessuna scheda provvisoria per questi filtri. Prova la ricerca nazionale per scoprire le aziende non ancora geolocalizzate.":
       "Nessuna nuova azienda ammissibile al momento. Le aziende pubblicate restano consultabili nella directory."}
     {filters.region?<Link href={resetPath} className="ml-2 font-semibold text-[#175640] underline">Mostra aziende senza regione →</Link>:null}
   </div>}
   <p className="mt-4 text-xs leading-5 text-[#52615b]">
     I profili da confermare sono distinti dalle aziende pubblicate. Puoi segnalare errori o richiedere la rimozione attraverso la scheda.
   </p>
 </section>;
}
