import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {safeNetworkWebsiteUrl} from "@/lib/network-free";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;
type LinkCandidate={
 id:string;name_a:string;domain_a:string;name_b:string;domain_b:string;
 relation_hint:"possible_alias"|"possible_brand_alias"|"shared_group_signal";
 proposal_status:"candidate";source_url:string;source_note:string;
 source_reuse_rights:"not_assessed";legal_identity_verified:false;
 merge_performed:false;created_at:string;
};
type Snapshot={contract:"net-it-identity2c-review-v1";total:number;items:LinkCandidate[];
 italian_legal_entities_verified_by_this_queue:0};
const relationLabel=(key:LinkCandidate["relation_hint"])=>({
 possible_alias:"Possibile dominio alternativo",
 possible_brand_alias:"Possibile marchio o nome alternativo",
 shared_group_signal:"Possibile collegamento di gruppo"
})[key]||"Relazione da verificare";
const pageValue=(v:string|undefined)=>v&&/^\d{1,3}$/.test(v)&&Number(v)>0?Math.min(100,Number(v)):1;

export default async function ItalianIdentityReviewPage({searchParams}:{
 searchParams:Promise<{page?:string}>
}){
 await requirePlatformPermission("discovery.read");
 const {page:queryPage}=await searchParams;
 const requested=pageValue(queryPage);
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netit_identity2c_review_queue",{
  p_limit:PAGE_SIZE,p_offset:(requested-1)*PAGE_SIZE
 });
 const v=data as Snapshot|null;
 const valid=!error&&v?.contract==="net-it-identity2c-review-v1"&&
  Number.isInteger(v.total)&&v.total>=0&&Array.isArray(v.items)&&
  v.items.length<=PAGE_SIZE&&v.items.every(item=>item.proposal_status==="candidate"&&
   item.legal_identity_verified===false&&item.merge_performed===false&&
   item.source_reuse_rights==="not_assessed");
 const current=valid?v:null;
 const pages=current?Math.max(1,Math.ceil(current.total/PAGE_SIZE)):1;
 const page=Math.min(requested,pages);
 const items=page===requested?current?.items??[]:[];
 const link=(p:number)=>"/platform/company-discovery/italian-identities?page="+p;
 return <main className="mx-auto w-full max-w-[1250px] space-y-4 px-4 py-6" data-testid="net-it-identity-review">
  <Link href="/platform/company-discovery/steel-coverage" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">← Copertura industriale</Link>
  <header className="rounded-2xl border border-[#d4e2da] bg-white p-5">
   <p className="text-xs font-bold uppercase tracking-wider text-[#175640]">NET-IT IDENTITY2C · Platform Intelligence</p>
   <h1 className="mt-1 text-2xl font-bold text-[#173f35]">Relazioni societarie · Italia</h1>
   <p className="mt-2 max-w-4xl text-sm leading-6 text-[#52615b]">
    Esamina possibili duplicazioni di dominio, marchi e collegamenti di gruppo nella raccolta italiana.
    Le schede rimangono distinte. Nessuna proposta è una verifica della persona giuridica,
    una decisione di fusione o un&apos;autorizzazione a riutilizzare i contenuti.
   </p>
  </header>
  {!current?<p role="alert" className="rounded-xl border border-[#e5c8a4] bg-white p-4 text-sm text-[#7b4b1b]">
   Registro temporaneamente non disponibile. Nessun conteggio viene interpretato come zero.
  </p>:<>
   <section aria-label="Sintesi relazioni candidate" className="grid gap-3 sm:grid-cols-3">
    <article className="rounded-xl border border-[#d7e3dc] bg-white p-4">
     <p className="text-xs font-semibold text-[#52615b]">Collegamenti candidati</p>
     <p className="mt-1 text-3xl font-bold tabular-nums text-[#173f35]">{current.total}</p>
     <p className="text-xs text-[#52615b]">Source-linked, non duplicati confermati</p>
    </article>
    <article className="rounded-xl border border-[#d7e3dc] bg-white p-4">
     <p className="text-xs font-semibold text-[#52615b]">Identità confermate da questa coda</p>
     <p className="mt-1 text-3xl font-bold tabular-nums text-[#173f35]">0</p>
     <p className="text-xs text-[#52615b]">La verifica legale è un processo distinto</p>
    </article>
    <article className="rounded-xl border border-[#d7e3dc] bg-white p-4">
     <p className="text-xs font-semibold text-[#52615b]">Modalità</p>
     <p className="mt-2 text-base font-bold text-[#175640]">Sola lettura</p>
     <p className="text-xs text-[#52615b]">Nessuna azione di merge o promozione</p>
    </article>
   </section>
   <section className="space-y-3" aria-label="Coppie societarie da riconciliare">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h2 className="text-base font-bold text-[#173f35]">Profili da confrontare</h2>
     <span className="text-xs font-semibold text-[#52615b]">Pagina {page}/{pages} · {current.total} relazioni</span>
    </div>
    {items.map(item=><article key={item.id} className="rounded-2xl border border-[#d7e3dc] bg-white p-4 sm:p-5" data-testid="net-it-identity-pair">
     <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-[#c5dcd0] bg-[#eef7f1] px-2.5 py-1 text-[11px] font-bold text-[#175640]">{relationLabel(item.relation_hint)}</span>
      <span className="rounded-full border border-[#ecdab6] bg-[#fff6e8] px-2.5 py-1 text-[11px] font-bold text-[#7b4b1b]">Solo candidata</span>
     </div>
     <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
      <div className="min-w-0 rounded-xl border border-[#dce8e0] bg-[#f8fbf9] p-3">
       <h3 className="break-words text-sm font-bold text-[#173f35]">{item.name_a}</h3>
       <p className="mt-1 break-all text-xs text-[#52615b]">{item.domain_a}</p>
      </div>
      <div aria-hidden="true" className="flex items-center justify-center text-lg text-[#597467]">↔</div>
      <div className="min-w-0 rounded-xl border border-[#dce8e0] bg-[#f8fbf9] p-3">
       <h3 className="break-words text-sm font-bold text-[#173f35]">{item.name_b}</h3>
       <p className="mt-1 break-all text-xs text-[#52615b]">{item.domain_b}</p>
      </div>
     </div>
     <p className="mt-3 text-sm leading-6 text-[#43524c]">{item.source_note}</p>
     <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e9e2] pt-3">
      {safeNetworkWebsiteUrl(item.source_url)?<a href={safeNetworkWebsiteUrl(item.source_url)||"#"}
       rel="noopener noreferrer" target="_blank"
       className="ui-action ui-action-secondary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold">Apri fonte ufficiale ↗</a>:
       <span className="text-xs text-[#7b4b1b]">Fonte non utilizzabile in sicurezza</span>}
      <p className="text-[11px] text-[#52615b]">Identità e diritti non verificati · Nessuna fusione</p>
     </div>
    </article>)}
    {items.length===0?<p className="rounded-xl border border-[#d7e3dc] bg-white p-5 text-sm text-[#52615b]">Nessun collegamento in questa pagina.</p>:null}
   </section>
   <nav aria-label="Paginazione coppie" className="flex items-center justify-between gap-2 text-sm">
    {page>1?<Link href={link(page-1)} className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 font-semibold">← Precedente</Link>:<span/>}
    {page<pages?<Link href={link(page+1)} className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 font-semibold">Successivo →</Link>:<span/>}
   </nav>
  </>}
 </main>;
}
