import { actionClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

import type { FreeDirectory, NetworkBrowsePage } from "@/lib/network-free";
import { NetworkPagination } from "@/components/network-pagination";

const roleLabels: Record<string,string>={
 producer:"Produttore (indicativo)",
 trader_distributor:"Commerciante (indicativo)",
 processor_service_provider:"Terzista (indicativo)",
 end_user:"Utilizzatore (indicativo)",
};

/** NET-LAUNCH1: also show Free unconfirmed discoveries to users with Pro entitlements.
 * No Pro-only data, personal contacts or provisional qualification claims. */
export function NetworkLaunchDiscovery({
 directory, filters, maxItems, pagination, navigationParams,
}:{
 directory: FreeDirectory | null;
 filters: {q?:string;role?:string;region?:string};
 maxItems?:number;
 pagination?:NetworkBrowsePage | null;
 navigationParams?: Record<string,string|undefined>;
}){
 const found=(directory?.items??[]).filter(item=>item.discovery_status==="unconfirmed").slice(0,maxItems??24);
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
     <h2 id="network-new-discoveries-title" className="mt-1 text-xl font-semibold text-[#173f35]">Esplora aziende</h2>
     <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
       Trova le aziende della filiera e consulta un profilo dedicato per conoscerne attività, territorio e fonti.
     </p>
    </div>
    <div className="rounded-xl border border-[#c5ddcb] bg-white px-4 py-2 text-center">
     <p className="text-2xl font-bold tabular-nums text-[#173f35]">{total.toLocaleString("it-IT")}</p>
     <p className="text-[11px] text-[#52615b]">Aziende disponibili{filtered?" · filtro corrente":""}</p>
    </div>
   </div>
   {found.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
     {found.map(company=>{
      return <article key={company.id} className="flex min-w-0 flex-col justify-between rounded-2xl border border-[#d6e4dc] bg-white p-4">
       <div>
        <h3 className="mt-3 break-words text-sm font-bold text-[#173f35]">{company.legal_name}</h3>
        <p className="mt-1 text-xs text-[#64746a]">
         {company.roles[0]?.key&&roleLabels[company.roles[0].key]||"Settore da classificare"}
        </p>
        {company.finished_only?<p className="mt-2 text-[11px] leading-5 text-[#7c6244]">Utilizzo di tubi non documentato</p>:null}
        {company.location?.region ? <p className="mt-2 text-[11px] font-medium leading-5 text-[#4c6256]">
          <span aria-label="Geografia ricavata da sito aziendale">{company.location.city} · {company.location.region}</span>
          {" · "}Sede indicata, da confermare
        </p> : null}
       </div>
       <div className="mt-4">
        <Link href={"/network/"+company.id} className={cn(actionClasses({ variant: "default", size: "sm" }), "min-h-10 w-full justify-center rounded-lg")}>Esplora azienda</Link>
       </div>
      </article>;
     })}
   </div>:<div className="mt-4 rounded-xl border border-[#d3e2d8] bg-white p-4 text-sm text-[#52615b]">
     {filtered?"Nessuna scheda provvisoria per questi filtri. Prova la ricerca nazionale per scoprire le aziende non ancora geolocalizzate.":
       "Nessuna nuova azienda ammissibile al momento. Le aziende pubblicate restano consultabili nella directory."}
     {filters.region?<Link href={resetPath} className="ml-2 font-semibold text-[#175640] underline">Mostra aziende senza regione →</Link>:null}
   </div>}
   {pagination && navigationParams ? <NetworkPagination
     page={pagination.page} total={pagination.total} pageSize={pagination.page_size}
     parameter="dpage" params={navigationParams} anchor="network-new-discoveries"
   /> : null}
   <p className="mt-4 text-xs leading-5 text-[#52615b]">
     Le schede raccolgono informazioni pubbliche con fonti consultabili. La presenza nel Network non implica adesione al servizio né verifica di ogni dettaglio. La rivendicazione e le segnalazioni sono disponibili nel profilo.
   </p>
 </section>;
}
