import Link from "next/link";
import type {RecipientReadinessStatus} from "@/lib/network-recipient-readiness";
import type {NetworkCompanyRole} from "@/lib/network-experience";
import {explainPublishedRelevance} from "@/lib/network-relevance";
type Item={id:string;name:string;role?:string|null;region?:string|null;roles?:{key:string}[]};
export function NetworkReadyConnections({items,statuses,canAct=true,persona=null,sharedProducts=new Map()}:{
 items:Item[];statuses:Map<string,RecipientReadinessStatus>|null;canAct?:boolean;
 persona?:NetworkCompanyRole|null;sharedProducts?:Map<string,string[]>;
}){
 if(!statuses)return <p role="status" className="rounded-xl border border-[#e4d3af] bg-[#fff9ed] px-4 py-3 text-xs text-[#75582a]">
  Disponibilità delle connessioni temporaneamente non verificabile. Esplora i profili senza inviare richieste non confermate.
 </p>;
 const available=items.filter(x=>statuses.get(x.id)==="available")
  .map(item=>({...item,explanation:explainPublishedRelevance(item.roles??[],persona,sharedProducts.get(item.id)??[])}))
  // Order only contactable candidates in the current page. No global ranking or hidden data.
  .sort((a,b)=>b.explanation.relevanceRank-a.explanation.relevanceRank)
  .slice(0,3);
 const awaiting=items.filter(x=>statuses.get(x.id)==="pending").length;
 const connected=items.filter(x=>statuses.get(x.id)==="connected").length;
 if(!available.length && !awaiting && !connected)return <p className="rounded-xl border border-[#d7e5dc] bg-[#f8fbf9] px-4 py-3 text-xs leading-5 text-[#52615b]">
  In questa pagina non ci sono ancora aziende disponibili per una connessione diretta. Puoi continuare a esplorare i profili da confermare o cambiare i filtri.
 </p>;
 return <section className="rounded-2xl border border-[#bdd8c7] bg-[#f1f8f3] p-4 sm:p-5" aria-label="Connessioni possibili su questa pagina">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#287153]">Connessioni professionali</p>
      <h3 className="mt-1 text-base font-semibold text-[#173f35]">Controparti raggiungibili, con motivazione</h3>
      <p className="mt-1 text-xs leading-5 text-[#53675a]">Tra i profili di questa pagina, categorie di filiera e prodotti dichiarati nei profili pubblicati spiegano il suggerimento. Non è una certificazione, una previsione né una garanzia di risposta.</p>
    </div>
    <Link href="/network/connections?box=received" className="inline-flex min-h-10 items-center rounded-lg border border-[#bdd1c4] bg-white px-3 text-xs font-semibold text-[#175640]">Gestisci risposte →</Link>
  </div>
  {available.length ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{available.map(item=><article key={item.id}
   className="rounded-xl border border-[#d5e6db] bg-white p-4">
    <p className="line-clamp-2 text-sm font-semibold text-[#173f35]">{item.name}</p>
    <p className="mt-1 text-xs text-[#617269]">{[item.role,item.region].filter(Boolean).join(" · ")||"Profilo aziendale"}</p>
    {item.explanation.reasons.map(reason=><p key={reason} className="mt-2 text-[11px] leading-4 text-[#347050]">{reason}</p>)}
    <Link href={canAct?"/network/"+item.id+"/connect":"/network/"+item.id}
      className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#b9d8c4] bg-[#eaf6ee] px-3 text-xs font-semibold text-[#16583d]">
      {canAct?"Proponi connessione →":"Apri profilo →"}
    </Link>
  </article>)}</div>:null}
  {(awaiting>0||connected>0)?<p className="mt-3 text-xs text-[#52615b]">
    {awaiting>0?awaiting+" richieste già in attesa":""}{awaiting>0&&connected>0?" · ":""}{connected>0?connected+" connessioni già accettate":""}
  </p>:null}
 </section>;
}
export function NetworkReadinessAction({companyId,status,canAct=true}:{
 companyId:string;status:RecipientReadinessStatus|undefined;canAct?:boolean;
}){
 if(status==="available"&&canAct)return <Link href={"/network/"+companyId+"/connect"}
  className="inline-flex min-h-10 items-center rounded-xl border border-[#a8cdb6] bg-[#e8f5eb] px-3 text-xs font-semibold text-[#16583d] hover:bg-[#d8ecdd]">Connettiti →</Link>;
 if(status==="pending")return <Link href="/network/connections?box=sent" className="inline-flex min-h-10 items-center rounded-xl border border-[#e1d3aa] bg-[#fff7e6] px-3 text-xs font-semibold text-[#795521]">In attesa →</Link>;
 if(status==="connected")return <Link href="/network/connections?box=sent" className="inline-flex min-h-10 items-center rounded-xl border border-[#c0dccc] bg-[#f0f8f2] px-3 text-xs font-semibold text-[#16583d]">Connessa ✓</Link>;
 return null;
}
