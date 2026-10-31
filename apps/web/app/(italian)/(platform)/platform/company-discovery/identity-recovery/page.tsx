import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {safeNetworkWebsiteUrl} from "@/lib/network-free";

export const dynamic="force-dynamic";
const SIZE=25;
const types=[
 {key:"all",label:"Tutte"},
 {key:"identity_collision_review",label:"Collisioni"},
 {key:"group_or_brand_review",label:"Gruppi e marchi"},
 {key:"legal_identity_enrichment",label:"Identità incomplete"},
 {key:"corporate_form_source_review",label:"Forma societaria"},
] as const;
type Kind=(typeof types)[number]["key"];
type Item={
 lead_id:string;company_name:string;domain:string;source_url:string;
 next_action:string;name_in_catalog:boolean;domain_in_catalog:boolean;
 lead_name_collision:boolean;review_state:string|null;
 observed_legal_name:string|null;review_source_url:string|null;
 review_note:string|null;reviewed_at:string|null;
};
type Snapshot={
 contract:"net-growth2c1-identity-recovery-v1";total:number;
 selected_total:number;by_action:Record<string,number>;
 events_recorded:number;publisher_enabled:boolean;
 identity_verified_by_this_process:0;items:Item[];
};
const pickKind=(value?:string):Kind=>
 (types.find(option=>option.key===value)?.key??"all");
const pickPage=(value?:string)=>
 value&&/^\d{1,3}$/.test(value)&&Number(value)>0?Math.min(400,Number(value)):1;
const stateLabel=(value:string)=>({
 identity_collision_review:"Possibile collisione",
 group_or_brand_review:"Gruppo o marchio",
 legal_identity_enrichment:"Ragione sociale da completare",
 corporate_form_source_review:"Verifica fonte societaria",
} as Record<string,string>)[value]??"Da esaminare";
const link=(kind:Kind,page:number)=>
 "/platform/company-discovery/identity-recovery?kind="+kind+"&page="+page;

export default async function IdentityRecoveryPage({searchParams}:{
 searchParams:Promise<{kind?:string;page?:string}>
}){
 await requirePlatformPermission("discovery.read");
 const params=await searchParams;
 const kind=pickKind(params.kind),requested=pickPage(params.page);
 const db=await createClient();
 const {data,error}=await db.rpc("netgrowth2c1_identity_recovery_page",{
  p_kind:kind,p_limit:SIZE,p_offset:(requested-1)*SIZE,
 });
 const v=data as Snapshot|null;
 const valid=!error&&v?.contract==="net-growth2c1-identity-recovery-v1"&&
 Number.isInteger(v.total)&&v.total>=0&&
 Number.isInteger(v.selected_total)&&v.selected_total>=0&&v.selected_total<=v.total&&
 Number.isInteger(v.events_recorded)&&v.events_recorded>=0&&
 v.identity_verified_by_this_process===0&&Array.isArray(v.items)&&v.items.length<=SIZE&&
 v.items.every(item=>typeof item.lead_id==="string"&&
  typeof item.company_name==="string"&&typeof item.domain==="string"&&
  typeof item.next_action==="string");
 const current=valid?v:null;
 const pages=current?Math.max(1,Math.ceil(current.selected_total/SIZE)):1;
 const page=Math.min(requested,pages);
 const items=page===requested?current?.items??[]:[];
 return <main className="mx-auto w-full max-w-[1250px] space-y-2.5 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-6" data-testid="net-growth2c1-identity-recovery">
  <Link href="/platform/company-discovery/italian-identities" className="inline-flex min-h-8 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 sm:min-h-10 sm:text-sm">← Relazioni societarie</Link>
  <header className="rounded-2xl border border-[#d4e2da] bg-white px-3 py-3 sm:p-5">
   <p className="text-[10px] font-bold uppercase tracking-wide text-[#175640] sm:text-xs">NET-GROWTH2C.1 · Platform Intelligence</p>
   <h1 className="mt-1 text-xl font-bold leading-6 text-[#173f35] sm:text-2xl">Recupero identità aziendali</h1>
   <p className="mt-1 text-xs leading-4 text-[#52615b] sm:hidden">
    Collisioni, gruppi e identità da ricostruire. Nessuna verifica legale o pubblicazione automatica.
   </p>
   <p className="mt-2 hidden max-w-3xl text-sm leading-6 text-[#52615b] sm:block">
    Individua le società ancora da identificare, i possibili duplicati e i gruppi industriali.
    I segnali non costituiscono conferma legale, certificazione, diritto di riuso o autorizzazione alla pubblicazione.
    La pagina non modifica alcuna scheda.
   </p>
  </header>
  {!current?<p role="alert" className="rounded-xl border border-[#e5c8a4] bg-white p-4 text-sm text-[#7b4b1b]">
   Coda identità temporaneamente non disponibile: controlla migrazione e permessi Platform. Non mostrare zero al posto dei dati mancanti.
  </p>:<>
   <section aria-label="Stato identità" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
    {[
     {name:"Identità in recupero",value:current.total,note:"Non sommare alle aziende già esplorabili"},
     {name:"Collisioni",value:current.by_action.identity_collision_review??0,note:"Nessun merge automatico"},
     {name:"Gruppi e marchi",value:current.by_action.group_or_brand_review??0,note:"Società distinte fino a prova"},
     {name:"Lavorate con evidenza",value:current.events_recorded,note:"Eventi di ricerca, non verifiche"},
    ].map(k=><article key={k.name} className="min-w-0 rounded-xl border border-[#d7e3dc] bg-white px-3 py-2 sm:p-3">
     <p className="text-[11px] font-semibold text-[#52615b]">{k.name}</p>
     <p className="text-xl font-bold tabular-nums leading-6 text-[#173f35] sm:mt-1 sm:text-2xl">{k.value.toLocaleString("it-IT")}</p>
     <p className="mt-1 hidden text-[11px] leading-4 text-[#52615b] sm:block">{k.note}</p>
    </article>)}
   </section>
   <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
    <span className="rounded-lg border border-[#d7e3dc] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#52615b] sm:px-3 sm:py-2 sm:text-xs">
     Pubblicazione automatica: {current.publisher_enabled?"attiva (verificare autorizzazioni)":"disattivata"}
    </span>
    <span className="rounded-lg border border-[#d7e3dc] bg-white px-3 py-2 text-xs font-semibold text-[#52615b]">
     Identità verificate da questo processo: 0
    </span>
   </div>
   <nav aria-label="Tipologia verifica identità" className="flex flex-wrap gap-1.5 sm:gap-2">
    {types.map(option=><Link key={option.key} href={link(option.key,1)}
      aria-current={kind===option.key?"page":undefined}
      className={kind===option.key?
       "ui-action ui-action-primary inline-flex min-h-9 items-center rounded-lg px-2.5 text-[11px] font-semibold sm:min-h-10 sm:px-3 sm:text-xs":
       "ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-lg px-2.5 text-[11px] font-semibold sm:min-h-10 sm:px-3 sm:text-xs"}>
      {option.label}
     </Link>)}
   </nav>
   <section className="space-y-2" aria-label="Lotto di recupero identità">
    <div className="flex flex-wrap justify-between gap-2">
     <h2 className="text-base font-bold text-[#173f35]">Lotto di analisi · 25 alla volta</h2>
     <p className="text-xs text-[#52615b]">Pagina {page}/{pages} · {current.selected_total} casi nella selezione</p>
    </div>
    {items.map(item=>{
     const source=safeNetworkWebsiteUrl(item.source_url);
     const reviewSource=item.review_source_url?safeNetworkWebsiteUrl(item.review_source_url):null;
     const conflict=item.name_in_catalog||item.domain_in_catalog||item.lead_name_collision;
     return <article key={item.lead_id} className="rounded-xl border border-[#d7e3dc] bg-white p-3 sm:p-4" data-testid="net-growth2c1-identity-item">
      <div className="flex flex-wrap items-start justify-between gap-2">
       <div className="min-w-0">
        <h3 className="text-sm font-bold text-[#173f35]">{item.company_name}</h3>
        <p className="mt-1 break-all text-xs text-[#52615b]">{item.domain}</p>
       </div>
       <span className="rounded-full border border-[#ecdab6] bg-[#fff6e8] px-2.5 py-1 text-[11px] font-bold text-[#7b4b1b]">{stateLabel(item.next_action)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
       {conflict?<span className="rounded-md bg-[#fff6e8] px-2 py-1 text-[#7b4b1b]">Confrontare nomi o domini già presenti</span>:null}
       {item.review_state?<span className="rounded-md bg-[#eef7f1] px-2 py-1 text-[#175640]">Ricerca: {item.review_state.replaceAll("_"," ")}</span>:
        <span className="rounded-md bg-[#f3f6f4] px-2 py-1 text-[#52615b]">Non ancora lavorata</span>}
      </div>
      {item.observed_legal_name?<p className="mt-3 text-xs text-[#43524c]">
       Denominazione osservata (non verificata): <strong>{item.observed_legal_name}</strong>
      </p>:null}
      {item.review_note?<p className="mt-2 text-xs leading-5 text-[#52615b]">{item.review_note}</p>:null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e9e2] pt-2">
       <div className="flex flex-wrap gap-2">
        {source?<a href={source} target="_blank" rel="noopener noreferrer"
         className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Fonte candidata ↗</a>:null}
        {reviewSource?<a href={reviewSource} target="_blank" rel="noopener noreferrer"
         className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Evidenza di ricerca ↗</a>:null}
       </div>
       <p className="hidden text-[11px] text-[#52615b] sm:block">Solo lettura · Nessuna fusione o promozione</p>
      </div>
     </article>;
    })}
    {items.length===0?<p className="rounded-xl border border-[#d7e3dc] bg-white p-4 text-sm text-[#52615b]">
     {requested>pages?"Pagina fuori intervallo: torna alla prima pagina.":"Nessun caso in questa selezione."}
    </p>:null}
   </section>
   <nav aria-label="Paginazione recupero identità" className="flex items-center justify-between gap-2">
    {page>1?<Link href={link(kind,page-1)} className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">← Precedente</Link>:<span/>}
    {page<pages?<Link href={link(kind,page+1)} className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">Successivo →</Link>:<span/>}
   </nav>
  </>}
 </main>;
}
