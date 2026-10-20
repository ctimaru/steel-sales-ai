import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
import {requirePlatformPermission} from "@/lib/platform-admin";
import {safeNetworkWebsiteUrl} from "@/lib/network-free";

export const dynamic="force-dynamic";
const SIZE=25;
type CompanyAuditRow={
 company_id:string;kind:"canonical"|"discovered";name:string;domain:string;
 role_key:string|null;site:string|null;source_state:string;
 technical_source_present:boolean;accepted_source_present:boolean;
 company_identity_verified:false;commercial_capability_verified:false;
 reuse_rights:"not_assessed"|"requires_review";governance_hold:string|null;priority_band:number;
 audit_outcome:string|null;audit_source_url:string|null;role_suggestion:string|null;
};
type Coverage={
 contract:"netux-data1b5-source-coverage-v1";
 total:number;published:number;discovered:number;source_backed:number;
 accepted_source_profiles:number;missing_technical:number;shared_domain_profiles:number;
 scan_candidates:number;explicit_governance_holds:number;selected_total:number;source_rights_verified:false;
 source_assessed_profiles:number;audit_followup_profiles:number;role_suggestions_pending:number;
 companies_verified_by_data1b5:0;items:CompanyAuditRow[];
};
const intPage=(v:string|undefined)=>v&&/^\d{1,4}$/.test(v)&&+v>0&&+v<=400?+v:1;
const roleName=(key:string|null)=>({
 producer:"Produttore",trader_distributor:"Commerciante",
 processor_service_provider:"Terzista",end_user:"Utilizzatore",
 } as Record<string,string>)[key||""]||"Da confermare";
const stateName=(key:string)=>({
 shared_domain_identity_review:"Dominio condiviso: verifica identità",
 identity_hold_manual_review:"Identità societaria da riconciliare",
 source_reuse_rights_hold:"Riuso della fonte bloccato, revisione necessaria",
 needs_official_site:"Fonte ufficiale da trovare",
 needs_technical_source:"Evidenza industriale mancante",
 technical_source_candidate_or_accepted:"Evidenza presente (stato separato)",
 } as Record<string,string>)[key]||"Da approfondire";
const href=(mode:string,page:number)=>"/platform/company-discovery/steel-coverage?mode="+mode+"&bp="+page;

export default async function SteelCompanyCoveragePage({searchParams}:{
 searchParams:Promise<{mode?:string;bp?:string}>
}){
 await requirePlatformPermission("discovery.read");
 const params=await searchParams;
 const onlyMissing=params.mode!=="all";
 const requested=intPage(params.bp);
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netdata1b5_coverage_queue",{
  p_limit:SIZE,p_offset:(requested-1)*SIZE,p_only_missing:onlyMissing,
 });
 const v=data as Coverage|null;
 const valid=!error&&v?.contract==="netux-data1b5-source-coverage-v1"&&
   Number.isInteger(v.total)&&Number.isInteger(v.source_backed)&&
   v.total===v.published+v.discovered&&
   v.total===v.source_backed+v.missing_technical&&
   Number.isInteger(v.source_assessed_profiles)&&Number.isInteger(v.audit_followup_profiles)&&
   Number.isInteger(v.role_suggestions_pending)&&
   v.source_assessed_profiles>=0&&v.source_assessed_profiles<=v.total&&
   Array.isArray(v.items)&&v.items.length<=SIZE;
 const snapshot=valid?v:null;
 const pages=snapshot?Math.max(1,Math.ceil(snapshot.selected_total/SIZE)):1;
 const page=Math.min(requested,pages);
 const pct=snapshot?.total?Math.round(snapshot.source_backed/snapshot.total*1000)/10:0;
 const auditPct=snapshot?.total?Math.round(snapshot.source_assessed_profiles/snapshot.total*1000)/10:0;
 const items=page===requested?snapshot?.items||[]:[];
 const mode=onlyMissing?"missing":"all";
 return <main className="mx-auto w-full max-w-[1340px] space-y-4 px-4 py-6" data-testid="network-steel-coverage-cockpit">
  <Link href="/platform/company-discovery" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">
   ← Discovery aziende
  </Link>
  <div className="flex justify-end"><Link href="/platform/company-discovery/italian-identities" className="ui-action ui-action-secondary inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-semibold">Relazioni societarie · Italia →</Link></div>
  <header className="rounded-2xl border border-[#d4e2da] bg-white p-4 sm:p-5">
   <p className="text-xs font-bold uppercase tracking-wider text-[#175640]">NET-UX DATA1B.5 · Company Intelligence</p>
   <h1 className="mt-1 text-2xl font-bold text-[#173f35]">Copertura industriale del Network</h1>
   <p className="mt-2 max-w-4xl text-sm leading-6 text-[#52615b]">
    Coda di lavoro su tutte le aziende censite. Le fonti candidate non attestano identità legale,
    utilizzo commerciale dei tubi, acquisti, capacità di fornitura o diritti di riutilizzo.
    La pagina è in sola lettura: non avvia scansioni e non approva aziende.
   </p>
  </header>
  {!snapshot?<p role="alert" className="rounded-xl border border-[#e5c8a4] bg-white p-4 text-sm text-[#7b4b1b]">
   Copertura non disponibile: controlla la migrazione DATA1B.5 e la permission Platform. Nessun valore mancante viene interpretato come zero.
  </p>:<>
   <section aria-label="Stato copertura industriale" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
    {[
      {name:"Schede Network",value:snapshot.total,note:snapshot.published+" pubblicate · "+snapshot.discovered+" censite"},
      {name:"Con fonte tecnica",value:snapshot.source_backed,note:"Candidate o accettate, non certificate"},
      {name:"Fonti esaminate",value:snapshot.source_assessed_profiles,note:"Visita documentata, non accettazione"},
      {name:"Da approfondire",value:snapshot.audit_followup_profiles,note:"Verifica sospesa, non fonte assente"},
      {name:"Senza evidenza",value:snapshot.missing_technical,note:"Nessuna prova tecnica registrata"},
      {name:"Blocchi governance",value:snapshot.shared_domain_profiles+snapshot.explicit_governance_holds,note:snapshot.shared_domain_profiles+" domini condivisi · "+snapshot.explicit_governance_holds+" altri blocchi"},
    ].map(metric=><article key={metric.name} className="min-w-0 rounded-xl border border-[#d7e3dc] bg-white p-3">
     <p className="text-[11px] font-semibold leading-4 text-[#52615b]">{metric.name}</p>
     <p className="mt-1 text-2xl font-bold tabular-nums text-[#173f35]">{metric.value.toLocaleString("it-IT")}</p>
     <p className="mt-1 text-[11px] leading-4 text-[#52615b]">{metric.note}</p>
    </article>)}
   </section>
   <section className="rounded-xl border border-[#d7e3dc] bg-white p-4" aria-label="Avanzamento documentale">
    <div className="flex items-center justify-between gap-2 text-xs">
     <span className="font-semibold text-[#173f35]">Copertura con evidenza industriale</span>
     <span className="font-bold tabular-nums text-[#175640]">{snapshot.source_backed}/{snapshot.total} · {pct}%</span>
    </div>
    <progress className="mt-2 h-3 w-full accent-[#175640]" value={snapshot.source_backed} max={Math.max(1,snapshot.total)}
     aria-label="Aziende con evidenza tecnica privata candidata o accettata"/>
    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
     <span className="font-semibold text-[#173f35]">Fonti effettivamente esaminate</span>
     <span className="font-bold tabular-nums text-[#175640]">{snapshot.source_assessed_profiles}/{snapshot.total} · {auditPct}%</span>
    </div>
    <progress className="mt-2 h-2 w-full accent-[#175640]" value={snapshot.source_assessed_profiles} max={Math.max(1,snapshot.total)}
     aria-label="Profili con visita documentale della fonte, non qualifica certificata"/>
    <p className="mt-2 text-[11px] leading-4 text-[#52615b]">
     {snapshot.scan_candidates} siti tecnicamente candidabili a verifica, non autorizzazioni al crawl.
     {snapshot.accepted_source_profiles} profili con almeno un attributo tecnico già accettato.
     {snapshot.role_suggestions_pending} proposte di ruolo da riesaminare.
     Diritti di riutilizzo non accertati; nessuna certificazione aziendale prodotta da DATA1B.5.
    </p>
   </section>
   <section className="overflow-hidden rounded-2xl border border-[#d7e3dc] bg-white" aria-label="Prossimo lotto di aziende">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe9e2] px-4 py-3">
     <div>
      <h2 className="text-base font-bold text-[#173f35]">Coda di verifica delle fonti</h2>
      <p className="text-[11px] text-[#52615b]">Lotti da 25 · priorità industriale indicativa · revisione manuale obbligatoria</p>
     </div>
     <div className="flex flex-wrap gap-2 text-xs">
      <Link href={href("missing",1)} aria-current={onlyMissing?"page":undefined}
       className={"ui-action inline-flex min-h-9 items-center rounded-lg px-3 font-semibold "+(onlyMissing?"ui-action-primary":"ui-action-secondary")}>Da documentare</Link>
      <Link href={href("all",1)} aria-current={!onlyMissing?"page":undefined}
       className={"ui-action inline-flex min-h-9 items-center rounded-lg px-3 font-semibold "+(!onlyMissing?"ui-action-primary":"ui-action-secondary")}>Tutte le aziende</Link>
     </div>
    </div>
    <div className="divide-y divide-[#edf1ee]">
     {items.map((item,i)=><article key={item.company_id} className="grid gap-2 px-4 py-3 md:grid-cols-[2.1fr_1fr_1.7fr_auto] md:items-center" data-testid="network-steel-coverage-item">
      <div className="min-w-0">
       <h3 className="truncate text-sm font-semibold text-[#173f35]">{(page-1)*SIZE+i+1}. {item.name}</h3>
       <p className="truncate text-xs text-[#52615b]">{item.domain} · {item.kind==="canonical"?"Pubblicata":"Censita"}</p>
      </div>
      <p className="text-xs text-[#43524c]">{roleName(item.role_key)}</p>
      <div className="min-w-0">
       <p className="text-xs font-semibold text-[#173f35]">{stateName(item.source_state)}</p>
       {item.audit_outcome==="source_observed"?<p className="mt-0.5 text-[11px] font-semibold text-[#175640]">Fonte esaminata · diritti non verificati</p>:
        item.audit_outcome==="needs_followup"?<p className="mt-0.5 text-[11px] font-semibold text-[#85541c]">Fonte da riesaminare · esito non conclusivo</p>:
        <p className="text-[11px] text-[#52615b]">Verifica esterna non registrata</p>}
       {item.role_suggestion&&item.role_suggestion!==item.role_key?<p className="mt-0.5 text-[11px] font-semibold text-[#85541c]">Ruolo suggerito: {roleName(item.role_suggestion)} · revisione richiesta</p>:null}
       <p className="text-[11px] text-[#52615b]">Identità giuridica e riuso non certificati</p>
      </div>
      {safeNetworkWebsiteUrl(item.site)?<a target="_blank" rel="noopener noreferrer"
       href={safeNetworkWebsiteUrl(item.site)||"#"} className="ui-action ui-action-secondary inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold">Esamina sito ↗</a>:
       <span className="text-xs text-[#805721]">Sito escluso dal batch automatico</span>}
     </article>)}
    </div>
    {items.length===0?<p className="p-6 text-sm text-[#52615b]">Nessuna azienda nel lotto richiesto. Torna alla prima pagina.</p>:null}
    <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e9e2] px-4 py-3 text-xs" aria-label="Paginazione aziende per verifica">
     <span className="font-medium text-[#52615b]">Lotto {page}/{pages} · {snapshot.selected_total} schede nel filtro</span>
     <div className="flex gap-2">
      {page>1?<Link href={href(mode,page-1)} className="ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-lg px-3 font-semibold">← Precedente</Link>:null}
      {page<pages?<Link href={href(mode,page+1)} className="ui-action ui-action-secondary inline-flex min-h-9 items-center rounded-lg px-3 font-semibold">Successivo →</Link>:null}
     </div>
    </nav>
   </section>
   <p className="text-xs leading-5 text-[#52615b]">Fonte = indizio. Stato “senza evidenza” significa soltanto che non abbiamo ancora documentato l'attività industriale; non significa che l'azienda non utilizzi acciaio.</p>
  </>}
 </main>;
}
