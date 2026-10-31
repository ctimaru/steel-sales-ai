import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {getPlatformAccessContext,requirePlatformPermission} from "@/lib/platform-admin";
import {recordProductEvidenceReview} from "./actions";
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
 latest_decision:"accepted"|"hold"|"rejected"|null;
 latest_reason:string|null;last_reviewed_at:string|null;
 last_reviewer_role:string|null;
};
type Snapshot={
 contract:"net-growth2c2-product-review-v1";
 total_candidates:number;canonical_candidates:number;
 provisional_candidates:number;selected_total:number;
 accepted_by_this_process:number;on_hold:number;
 rejected_after_review:number;not_yet_reviewed:number;
 publication_performed:false;
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
 searchParams:Promise<{lane?:string;page?:string;message?:string;error?:string}>
}){
 await requirePlatformPermission("discovery.read");
 const params=await searchParams;
 const lane=pickLane(params.lane),requested=pickPage(params.page);
 const access=await getPlatformAccessContext();
 const canReview=access?.permissions.includes("discovery.review")??false;
 const canAccept=canReview&&(access?.permissions.includes("discovery.enrich")??false);
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
  Number.isInteger(v.accepted_by_this_process)&&Number.isInteger(v.on_hold)&&
  Number.isInteger(v.rejected_after_review)&&Number.isInteger(v.not_yet_reviewed)&&
  v.accepted_by_this_process+v.on_hold+v.rejected_after_review+v.not_yet_reviewed===v.total_candidates&&
  v.publication_performed===false&&
  Array.isArray(v.items)&&v.items.length<=PAGE_SIZE&&v.items.every(item=>
   item.review_status==="candidate"&&
   (item.lane==="canonical"||item.lane==="provisional")&&
   Array.isArray(item.products)&&item.products.length<=4&&
   [null,"accepted","hold","rejected"].includes(item.latest_decision));
 const snapshot=valid?v:null;
 const pages=snapshot?Math.max(1,Math.ceil(snapshot.selected_total/PAGE_SIZE)):1;
 const page=Math.min(requested,pages);
 const items=page===requested?snapshot?.items??[]:[];
 const roleOptions=[
  {value:"unclassified",label:"Ruolo non determinato"},
  {value:"tube_producer",label:"Produttore di tubi"},
  {value:"trader_distributor",label:"Commerciante / distributore"},
  {value:"processor_service_provider",label:"Terzista / centro servizi"},
  {value:"end_user",label:"Utilizzatore industriale"},
  {value:"tube_machinery_maker",label:"Costruttore macchine per tubi"},
  {value:"finished_equipment_maker",label:"Costruttore di prodotti finiti"},
 ] as const;
 return <main className="mx-auto w-full max-w-[1250px] space-y-3 px-3 py-4 sm:px-4 sm:py-6" data-testid="net-growth2c2-product-review">
  <Link href="/platform/company-discovery/steel-coverage"
   className="inline-flex min-h-9 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">← Copertura industriale</Link>
  <header className="rounded-2xl border border-[#d4e2da] bg-white p-3 sm:p-5">
   <p className="text-[11px] font-bold uppercase tracking-wide text-[#175640]">NET-GROWTH2C.2 · Company Intelligence</p>
   <h1 className="mt-1 text-xl font-bold text-[#173f35] sm:text-2xl">Prodotti e capacità · revisione fonti</h1>
   <p className="mt-1 text-xs leading-5 text-[#52615b] sm:text-sm">
    Evidenze candidate, non informazioni confermate. La presenza della parola tubo non dimostra
    produzione, vendita, disponibilità o acquisti. Ogni approvazione è manuale e non comporta pubblicazione.
   </p>
  </header>
  {(params.message||params.error)?<p role="status" className="rounded-xl border border-[#d7e3dc] bg-white p-3 text-xs text-[#52615b]">{params.message||params.error}</p>:null}
  {!snapshot?<p role="alert" className="rounded-xl border border-[#e5c8a4] bg-white p-4 text-sm text-[#7b4b1b]">
   Coda temporaneamente non disponibile. Non interpretare l&apos;errore come assenza di dati.
  </p>:<>
   <section aria-label="Stato delle evidenze prodotti" className="grid grid-cols-3 gap-1.5 sm:gap-3">
    {[
     {label:"Da revisionare",value:snapshot.not_yet_reviewed},
     {label:"Valutate internamente",value:snapshot.accepted_by_this_process},
     {label:"Sospese",value:snapshot.on_hold},
    ].map(stat=><article key={stat.label} className="min-w-0 rounded-xl border border-[#d7e3dc] bg-white px-3 py-2 sm:p-4">
     <p className="text-[11px] font-semibold text-[#52615b]">{stat.label}</p>
     <p className="text-xl font-bold tabular-nums text-[#173f35] sm:text-3xl">{stat.value.toLocaleString("it-IT")}</p>
    </article>)}
   </section>
   <p className="text-xs text-[#52615b]">{snapshot.total_candidates} evidenze candidate: {snapshot.canonical_candidates} canoniche e {snapshot.provisional_candidates} provvisorie. {snapshot.rejected_after_review} respinte. Nessuna pubblicata da questo processo.</p>
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
       <span className="rounded-full border border-[#ecdab6] bg-[#fff6e8] px-2.5 py-1 text-[11px] font-bold text-[#7b4b1b]">{item.latest_decision==="accepted"?"Revisionata · non pubblicata":item.latest_decision==="hold"?"In sospeso":item.latest_decision==="rejected"?"Respinta":"Da verificare"}</span>
      </div>
      <div className="mt-2 space-y-1">
       {item.products.map((product,i)=><p key={i} className="text-xs leading-5 text-[#43524c]">
        <span className="font-semibold text-[#175640]">Proposta {i+1}:</span> {product}
       </p>)}
       {item.products.length===0?<p className="text-xs text-[#7b4b1b]">Contenuto non visualizzabile; controllare la fonte.</p>:null}
      </div>
      {item.latest_reason?<p className="mt-2 text-xs text-[#52615b]">Ultima decisione: {item.latest_reason}</p>:null}
      {canReview?<details className="mt-2 rounded-lg border border-[#d7e3dc] bg-[#f8fbf9] p-2.5">
       <summary className="cursor-pointer text-xs font-semibold text-[#175640]">Registra decisione di revisione</summary>
       <form action={recordProductEvidenceReview} className="mt-3 grid gap-2 text-xs">
        <input type="hidden" name="evidence_id" value={item.id}/>
        <input type="hidden" name="lane" value={lane}/>
        <input type="hidden" name="page" value={page}/>
        <label className="grid gap-1 font-semibold text-[#43524c]">Decisione
         <select name="decision" required className="min-h-10 rounded-lg border border-[#b9cfc3] bg-white p-2 text-[#173f35]">
          <option value="hold">Sospendi per integrazione fonte</option>
          <option value="rejected">Respingi informazione non documentata</option>
          {canAccept&&item.lane==="canonical"&&item.is_published?<option value="accepted">Approva evidenza (solo registro interno)</option>:null}
         </select>
        </label>
        <label className="grid gap-1 font-semibold text-[#43524c]">Attività dell’azienda secondo fonte
         <select name="reviewer_role" required className="min-h-10 rounded-lg border border-[#b9cfc3] bg-white p-2 text-[#173f35]">
          {roleOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
         </select>
        </label>
        {canAccept&&item.lane==="canonical"&&item.is_published?<fieldset className="grid gap-1.5 rounded-lg border border-[#d7e3dc] bg-white p-2 text-[#43524c]">
         <legend className="px-1 font-semibold">Requisiti obbligatori solo per approvare</legend>
         <label className="flex items-center gap-2"><input type="checkbox" name="identity_confirmed"/> Identità societaria controllata</label>
         <label className="flex items-center gap-2"><input type="checkbox" name="source_rights_confirmed"/> Diritti e uso della fonte controllati</label>
         <label className="flex items-center gap-2"><input type="checkbox" name="attribute_confirmed"/> Prodotto attribuibile alla società</label>
        </fieldset>:null}
        <label className="grid gap-1 font-semibold text-[#43524c]">Motivazione (20–1000 caratteri)
         <textarea name="reason" minLength={20} maxLength={1000} required rows={2}
          placeholder="Descrivi la verifica effettuata, il limite della fonte o il motivo della sospensione."
          className="rounded-lg border border-[#b9cfc3] bg-white p-2 text-[#173f35]"/>
        </label>
        <button type="submit" className="ui-action ui-action-primary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold">Registra nello storico privato</button>
       </form>
      </details>:null}
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
