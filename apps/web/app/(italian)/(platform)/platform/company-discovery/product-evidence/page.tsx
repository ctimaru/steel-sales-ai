import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {safeNetworkWebsiteUrl} from "@/lib/network-free";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;
type Lane="all"|"canonical"|"provisional";
type ProductEvidence={
 id:string;name:string;domain:string;
 lane:"canonical"|"provisional";is_published:boolean;
 review_status:"candidate";confidence:number|null;
 fetched_at:string;source_url:string;products:string[];
 extractor_version:string;
};
type Snapshot={
 contract:"net-growth2c2-product-review-v1";
 total_candidates:number;canonical_candidates:number;
 provisional_candidates:number;selected_total:number;
 accepted_by_this_process:0;publication_performed:false;
 items:ProductEvidence[];
};
const lanes=[
 {key:"all",label:"Tutte"},
 {key:"canonical",label:"Catalogo canonico"},
 {key:"provisional",label:"Provvisorie"},
] as const;
const pickLane=(v?:string):Lane=>
 lanes.find(x=>x.key===v)?.key??"all";
const pickPage=(v?:string)=>
 v&&/^\d{1,3}$/.test(v)&&+v>0?Math.min(+v,400):1;
const href=(lane:Lane,page:number)=>
 "/platform/company-discovery/product-evidence?lane="+lane+"&page="+page;

export default async function ProductEvidencePage({searchParams}:{
 searchParams:Promise<{lane?:string;page?:string}>
}){
 await requirePlatformPermission("discovery.read");
 const params=await searchParams;
 const lane=pickLane(params.lane),requested=pickPage(params.page);
 const db=await createClient();
 const {data,error}=await db.rpc("netgrowth2c2_product_evidence_page",{
  p_lane:lane,p_limit:PAGE_SIZE,p_offset:(requested-1)*PAGE_SIZE,
 });
 const v=data as Snapshot|null;
 const valid=!error&&v?.contract==="net-growth2c2-product-review-v1"&&
  Number.isInteger(v.total_candidates)&&
  Number.isInteger(v.canonical_candidates)&&Number.isInteger(v.provisional_candidates)&&
  v.total_candidates===v.canonical_candidates+v.provisional_candidates&&
  Number.isInteger(v.selected_total)&&v.selected_total>=0&&
  v.accepted_by_this_process===0&&v.publication_performed===false&&
  Array.isArray(v.items)&&v.items.length<=PAGE_SIZE&&v.items.every(item=>
   item.review_status==="candidate"&&
   (item.lane==="canonical"||item.lane==="provisional")&&
   Array.isArray(item.products)&&item.products.length<=4);
 const snapshot=valid?v:null;
 const pages=snapshot?Math.max(1,Math.ceil(snapshot.selected_total/PAGE_SIZE)):1;
 const page=Math.min(requested,pages);
 const items=page===requested?snapshot?.items??[]:[];
 return <main className="mx-auto w-full max-w-[1250px] space-y-3 px-3 py-4 sm:px-4 sm:py-6" data-testid="net-growth2c2-product-review">
  <Link href="/platform/company-discovery/steel-coverage"
   className="inline-flex min-h-9 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">← Copertura industriale</Link>
  <header className="rounded-2xl border border-[#d4e2da] bg-white p-3 sm:p-5">
   <p className="text-[11px] font-bold uppercase tracking-wide text-[#175640]">NET-GROWTH2C.2 · Company Intelligence</p>
   <h1 className="mt-1 text-xl font-bold text-[#173f35] sm:text-2xl">Prodotti e capacità · revisione fonti</h1>
   <p className="mt-1 text-xs leading-5 text-[#52615b] sm:text-sm">
    Evidenze candidate, non informazioni confermate. La presenza della parola tubo non dimostra
    produzione, vendita, disponibilità o acquisti. Nessuna pubblicazione o approvazione automatica.
   </p>
  </header>
  {!snapshot?<p role="alert" className="rounded-xl border border-[#e5c8a4] bg-white p-4 text-sm text-[#7b4b1b]">
   Coda temporaneamente non disponibile. Non interpretare l&apos;errore come assenza di dati.
  </p>:<>
   <section aria-label="Stato delle evidenze prodotti" className="grid grid-cols-3 gap-1.5 sm:gap-3">
    {[
     {label:"Candidate",value:snapshot.total_candidates},
     {label:"Canoniche",value:snapshot.canonical_candidates},
     {label:"Provvisorie",value:snapshot.provisional_candidates},
    ].map(stat=><article key={stat.label} className="min-w-0 rounded-xl border border-[#d7e3dc] bg-white px-3 py-2 sm:p-4">
     <p className="text-[11px] font-semibold text-[#52615b]">{stat.label}</p>
     <p className="text-xl font-bold tabular-nums text-[#173f35] sm:text-3xl">{stat.value.toLocaleString("it-IT")}</p>
    </article>)}
   </section>
   <nav aria-label="Filtro stato scheda" className="flex flex-wrap gap-2">
    {lanes.map(l=><Link key={l.key} href={href(l.key,1)} aria-current={lane===l.key?"page":undefined}
     className={lane===l.key?"ui-action ui-action-primary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold":
      "ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold"}>
     {l.label}</Link>)}
   </nav>
   <section aria-label="Evidenze da controllare" className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h2 className="text-sm font-bold text-[#173f35]">Primo lotto · 25 evidenze per pagina</h2>
     <p className="text-xs text-[#52615b]">Pagina {page}/{pages} · {snapshot.selected_total} candidate</p>
    </div>
    {items.map((item,index)=>{
     const source=safeNetworkWebsiteUrl(item.source_url);
     return <article key={item.id} data-testid="net-growth2c2-evidence-item"
      className="rounded-xl border border-[#d7e3dc] bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
       <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#52615b]">Evidenza {(page-1)*PAGE_SIZE+index+1} · {item.is_published?"Scheda pubblicata":item.lane==="canonical"?"Scheda canonica non pubblicata":"Scheda provvisoria"}</p>
        <h3 className="mt-0.5 break-words text-sm font-bold text-[#173f35]">{item.name}</h3>
        <p className="break-all text-xs text-[#52615b]">{item.domain||"Dominio non risolto"}</p>
       </div>
       <span className="rounded-full border border-[#ecdab6] bg-[#fff6e8] px-2.5 py-1 text-[11px] font-bold text-[#7b4b1b]">Da verificare</span>
      </div>
      <div className="mt-2 space-y-1">
       {item.products.map((product,i)=><p key={i} className="text-xs leading-5 text-[#43524c]">
        <span className="font-semibold text-[#175640]">Proposta {i+1}:</span> {product}
       </p>)}
       {item.products.length===0?<p className="text-xs text-[#7b4b1b]">Contenuto non visualizzabile; controllare la fonte.</p>:null}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e9e2] pt-2">
       {source?<a href={source} target="_blank" rel="noopener noreferrer"
        className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Apri fonte da verificare ↗</a>:
        <span className="text-xs text-[#7b4b1b]">URL non utilizzabile in sicurezza</span>}
       <p className="text-[11px] text-[#52615b]">
        {item.lane==="provisional"?"Prima risolvere identità":"Prima confermare prodotti e ruolo"}
       </p>
      </div>
     </article>;
    })}
    {items.length===0?<p className="rounded-xl border border-[#d7e3dc] bg-white p-4 text-sm text-[#52615b]">
     {requested>pages?"Pagina fuori intervallo. Torna alla prima.":"Nessuna evidenza candidata in questa selezione."}
    </p>:null}
   </section>
   <nav aria-label="Paginazione evidenze prodotti" className="flex items-center justify-between gap-2">
    {page>1?<Link href={href(lane,page-1)}
     className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">← Precedente</Link>:<span/>}
    {page<pages?<Link href={href(lane,page+1)}
     className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Successivo →</Link>:<span/>}
   </nav>
  </>}
 </main>;
}
