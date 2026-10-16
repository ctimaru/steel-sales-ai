import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { stageEndUserTarget, reviewEndUserTargets, enqueueEndUserTargets } from "./actions";

export const dynamic="force-dynamic";

type Lead={
 id:string;company_name:string;canonical_domain:string;evidence_url:string;
 evidence_summary:string;segment:string;proposed_role:string;material_signal:string;
 status:string;review_note:string|null;
};
type Queue={
 contract:"netcov1-targets-v1";total:number;needs_review:number;ready_for_crawler:number;
 enqueued:number;published_end_users:number;items:Lead[];
};

const statusLabel:Record<string,string>={
 needs_review:"Da qualificare",ready_for_crawler:"Pronto per fonte approvata",
 enqueued_for_crawler:"Inserito nel percorso crawler",duplicate_existing:"Duplicato",rejected:"Scartato",
};
const segmentLabel:Record<string,string>={
 furniture:"Arredo",urban_furniture:"Arredo urbano",scaffolding:"Ponteggi",
 industrial_equipment:"Macchine industriali",agricultural_equipment:"Macchine agricole",other:"Altro",
};
const input="min-h-11 w-full rounded-xl border border-[#cedbd2] bg-white px-3 text-sm text-[#173f35]";
const cta="min-h-11 rounded-xl bg-[#173f35] px-4 py-2 text-sm font-semibold text-white";

export default async function NetworkCoreCoveragePage({
 searchParams,
}:{searchParams:Promise<{message?:string;error?:string}>}){
 await requirePlatformPermission("discovery.read");
 const access=await getPlatformAccessContext();
 const permissions=access?.permissions??[];
 const canEnrich=permissions.includes("discovery.enrich");
 const canReview=permissions.includes("discovery.governance_review");
 const canEnqueue=canReview&&permissions.includes("discovery.run");
 const params=await searchParams;
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netcov1_targets_queue");
 const queue= !error && (data as Queue|null)?.contract==="netcov1-targets-v1" ? data as Queue : null;
 const pending=queue?.items.filter(item=>item.status==="needs_review")??[];
 const ready=queue?.items.filter(item=>item.status==="ready_for_crawler")??[];

 return <main className="mx-auto max-w-6xl space-y-6 px-4 pb-12">
  <Link href="/platform/company-discovery" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline">← Company Discovery</Link>
  <header className="space-y-2">
    <p className="platform-kicker">NET-COV1 · CORE NETWORK</p>
    <h1 className="text-3xl font-semibold text-[#173f35]">Densità utilizzatori e commercianti</h1>
    <p className="max-w-3xl text-sm leading-6 text-[#52615b]">
      Acquisisci aziende industriali reali che costruiscono prodotti con tubi e profili d'acciaio.
      Raccogli fonti aziendali, qualifica gruppi di domini, poi trasferisci i lead
      alle scansioni già governate. Nessuna azienda viene pubblicata da questa pagina.
    </p>
  </header>
  {params.error ? <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{params.error}</p>:null}
  {params.message ? <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">{params.message}</p>:null}
  {!queue ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
     Coda NET-COV1 non disponibile. Le aziende non vengono conteggiate come assenti se la lettura non riesce.
  </p>:null}

  <section aria-label="Copertura utilizzatori" className="grid gap-3 sm:grid-cols-4">
   {[
    ["Utilizzatori pubblicati",queue?.published_end_users,"Profili Network reali"],
    ["Da qualificare",queue?.needs_review,"Fonti ufficiali da controllare"],
    ["Pronti per il crawler",queue?.ready_for_crawler,"Solo dopo revisione Platform"],
    ["Inoltrati al crawler",queue?.enqueued,"Non ancora aziende pubblicate"],
   ].map(([label,value,note])=><div key={String(label)} className="rounded-2xl border bg-white p-4">
      <p className="text-xs font-semibold text-[#52615b]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[#173f35]">{value??"—"}</p>
      <p className="mt-1 text-xs text-[#64766c]">{note}</p>
   </div>)}
  </section>

  {canEnrich ? <section className="rounded-2xl border bg-white p-5">
   <h2 className="text-lg font-semibold">Aggiungi un utilizzatore potenziale</h2>
   <p className="mt-1 text-sm text-[#52615b]">Solo informazioni aziendali ufficiali, senza persone, indirizzi email o dati privati. La categoria è una proposta, non una verifica commerciale.</p>
   <form action={stageEndUserTarget} className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="grid gap-1 text-sm">Azienda / marchio ufficiale
     <input required name="company_name" maxLength={180} className={input} placeholder="Es. produttore di attrezzature"/>
    </label>
    <label className="grid gap-1 text-sm">Dominio aziendale
     <input required name="domain" maxLength={255} className={input} placeholder="esempio.it"/>
    </label>
    <label className="grid gap-1 text-sm sm:col-span-2">Pagina ufficiale del prodotto
     <input required type="url" name="evidence_url" maxLength={1800} className={input} placeholder="https://esempio.it/prodotti/"/>
    </label>
    <label className="grid gap-1 text-sm sm:col-span-2">Sintesi del segnale industriale
     <textarea required name="summary" minLength={25} maxLength={1000} rows={2} className="rounded-xl border p-3 text-sm" placeholder="Prodotto finale dichiarato e componente tubolare in acciaio"/>
    </label>
    <label className="grid gap-1 text-sm">Mercato
     <select name="segment" className={input}>
      {Object.entries(segmentLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}
     </select>
    </label>
    <label className="grid gap-1 text-sm">Qualità evidenza
     <select name="material_signal" className={input}>
      <option value="explicit_steel_tube_product">Tubo d'acciaio esplicito nel prodotto</option>
      <option value="finished_equipment_only">Solo prodotto finito (da approfondire)</option>
     </select>
    </label>
    <label className="grid gap-1 text-sm">Ruolo proposto
     <select name="role" className={input}><option value="end_user">Utilizzatore</option><option value="trader_distributor">Commerciante</option></select>
    </label>
    <button className={cta+" sm:col-span-2"}>Inserisci nella coda commerciale · non pubblica</button>
   </form>
  </section>:null}

  <section className="space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <h2 className="text-xl font-semibold text-[#173f35]">Qualifica il primo lotto ({queue?.total??"—"})</h2>
    <span className="text-xs text-[#64766c]">Evidenze di siti ufficiali, non clienti confermati</span>
   </div>
   {queue && queue.items.length===0 ? <p className="rounded-xl border bg-white p-4 text-sm">Nessun potenziale utilizzatore ancora acquisito.</p>:null}
   <form action={reviewEndUserTargets} className="space-y-3">
    <div className="grid gap-2">
     {queue?.items.map(item=><article key={item.id} className="rounded-xl border bg-white p-4">
      <div className="flex gap-3">
       {canReview && item.status==="needs_review" ?
         <input type="checkbox" name="target_ids" value={item.id} aria-label={"Seleziona "+item.company_name}
           className="mt-1 h-5 w-5 accent-[#17634c]"/>:<div className="w-5" />}
       <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
         <h3 className="font-semibold text-[#173f35]">{item.company_name}</h3>
         <span className="rounded-full bg-[#eaf2ed] px-2 py-0.5 text-xs text-[#315845]">{statusLabel[item.status]??item.status}</span>
         <span className="text-xs text-[#52615b]">{segmentLabel[item.segment]??item.segment} · {item.proposed_role==="end_user"?"Utilizzatore":"Commerciante"}</span>
        </div>
        <p className="mt-1 text-sm text-[#52615b]">{item.evidence_summary}</p>
        <p className="mt-1 text-xs text-[#64766c]">{item.material_signal==="explicit_steel_tube_product"?"Tubo d'acciaio descritto nella fonte":"Materiale tubolare da verificare"}</p>
        <a href={item.evidence_url} rel="noopener noreferrer" target="_blank"
          className="mt-2 inline-block break-all text-sm font-semibold text-[#175640] underline">
           Verifica prodotto sul sito ufficiale ↗
        </a>
        {item.review_note?<p className="mt-1 text-xs">Nota revisione: {item.review_note}</p>:null}
       </div>
      </div>
     </article>)}
    </div>
    {canReview && pending.length>0 ? <div className="rounded-2xl border border-[#b8d3c4] bg-[#f6faf8] p-4">
     <p className="text-sm font-semibold">Decisione in lotto sui profili selezionati</p>
     <p className="mt-1 text-xs text-[#52615b]">Unica attestazione fino a 40 aziende. L'approvazione rende il sito pronto per il crawler, NON pubblica un profilo Network.</p>
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Esito
       <select name="decision" required defaultValue="" className={input}>
        <option value="" disabled>Scegli una decisione</option>
        <option value="ready_for_crawler">Qualificato · pronto per source gate</option>
        <option value="rejected">Scarta candidato</option>
        <option value="duplicate_existing">Duplicato esistente</option>
       </select>
      </label>
      <label className="grid gap-1 text-sm">Motivazione della verifica
       <input name="note" required minLength={15} maxLength={2000} className={input} placeholder="Identità, materiale e fonte ufficiale controllati"/>
      </label>
     </div>
     <label className="mt-3 flex gap-2 text-xs leading-5">
      <input name="attested" type="checkbox" value="yes" required className="h-5 w-5"/>
      <span>Attesto di aver controllato identità aziendale, prova del prodotto e assenza di duplicati. La preparazione non comporta pubblicazione.</span>
     </label>
     <button className={cta+" mt-3"}>Registra qualificazione dei selezionati</button>
    </div>:null}
   </form>
  </section>

  {canEnqueue ? <section className="rounded-2xl border bg-white p-5">
   <h2 className="text-lg font-semibold">Trasferisci al crawler governato ({ready.length} pronti)</h2>
   <p className="mt-1 text-sm leading-6 text-[#52615b]">
    Per partire serve una fonte registrata, abilitata e con diritti esplicitamente approvati
    dalla Platform. Il trasferimento crea soltanto lead da revisionare nel crawler esistente.
    Nessuna scansione, review o pubblicazione parte automaticamente.
   </p>
   <form action={enqueueEndUserTargets} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
    <label className="grid gap-1 text-sm">ID fonte già approvata
     <input name="source_id" required className={input} placeholder="UUID fonte ufficiale approvata"/>
    </label>
    <label className="grid gap-1 text-sm">Numero massimo
     <input type="number" name="limit" min={1} max={40} defaultValue={40} className={input}/>
    </label>
    <button disabled={ready.length===0} className={cta+" disabled:cursor-not-allowed disabled:opacity-50"}>
     Inoltra a Discovery
    </button>
   </form>
   <Link href="/platform/company-discovery/sources" className="mt-3 inline-block text-sm text-[#175640] underline">
    Governance delle fonti →
   </Link>
  </section>:null}
 </main>;
}
