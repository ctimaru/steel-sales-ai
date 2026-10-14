"use client";

import { useState } from "react";

type Source = {
 id:string;source_name:string;governance_status:string;terms_status:string;
 database_rights_status:string;personal_data_policy:string;
};
type Feedback = {
 status:string;digest?:string;original_rows:number;rows_unique_in_file:number;
 duplicates_in_file:number;source_rights_ready:boolean;batches:number;
 eligible_new:number;inserted:number;existing_companies:number;
 existing_candidates:number;already_staged:number;duplicate_within_chunk:number;
 skipped_existing_batch:number;published:number;
};
export function ItalianCompanyBulkImport({sources}:{sources:Source[]}) {
 const [source,setSource]=useState(sources[0]?.id ?? "");
 const [role,setRole]=useState<"trader_distributor"|"end_user">("trader_distributor");
 const [ateco,setAteco]=useState<""|"2022"|"2025">("");
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState<Feedback|null>(null);
 const [outcome,setOutcome]=useState<Feedback|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [confirm,setConfirm]=useState(false);
 const reset=()=>{setPreview(null);setOutcome(null);setConfirm(false);setError("");};
 async function send(mode:"preview"|"stage") {
   if(!file||!source){setError("Seleziona una fonte registrata e un CSV.");return;}
   setBusy(true);setError("");
   const body=new FormData();
   body.set("file",file);body.set("source_id",source);body.set("default_role",role);
   body.set("ateco_version",ateco);body.set("mode",mode);
   if(mode==="stage"){body.set("preview_digest",preview?.digest??"");body.set("attested",confirm?"true":"false");}
   try {
     const response=await fetch("/api/platform/company-discovery/bulk-intake",{
       method:"POST",credentials:"same-origin",body,cache:"no-store"
     });
     const result=await response.json() as Feedback & {error?:string;chunks_completed?:number};
     if(!response.ok)throw Error(result.error || "Importazione non riuscita.");
     if(mode==="preview")setPreview(result);
     else {setOutcome(result);setPreview(null);setConfirm(false);}
   }catch(e){setError(e instanceof Error?e.message:"Impossibile completare la richiesta.");}
   finally{setBusy(false);}
 }
 const selected=sources.find(s=>s.id===source);
 const ready=selected?.governance_status==="approved"&&
   ["allows_reuse","allows_limited_reuse"].includes(selected.terms_status)&&
   ["licensed","low_risk"].includes(selected.database_rights_status)&&
   ["exclude_personal_data","company_data_only"].includes(selected.personal_data_policy);
 return <div className="space-y-5">
   <div className="grid gap-4 md:grid-cols-2">
     <label className="block text-sm font-semibold text-[#203b43]">
       Fonte dei dati
       <select value={source} onChange={e=>{setSource(e.target.value);reset();}}
         className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-[#18263d]">
         {sources.length===0?<option value="">Nessuna fonte CSV registrata</option>:null}
         {sources.map(s=><option key={s.id} value={s.id}>{s.source_name} ({s.governance_status})</option>)}
       </select>
     </label>
     <label className="block text-sm font-semibold text-[#203b43]">
       Segmento proposto
       <select value={role} onChange={e=>{setRole(e.target.value as typeof role);reset();}}
         className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-[#18263d]">
         <option value="trader_distributor">Commercianti / distributori</option>
         <option value="end_user">Utilizzatori industriali</option>
       </select>
     </label>
     <label className="block text-sm font-semibold text-[#203b43]">
       Versione ATECO del file (se contiene codici)
       <select value={ateco} onChange={e=>{setAteco(e.target.value as typeof ateco);reset();}}
         className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-[#18263d]">
         <option value="">Non specificata</option><option value="2025">ATECO 2025</option><option value="2022">ATECO 2022</option>
       </select>
     </label>
     <label className="block text-sm font-semibold text-[#203b43]">
       File CSV (max 2.000 righe / 768 KB)
       <input type="file" accept=".csv,text/csv" onChange={e=>{setFile(e.target.files?.[0]??null);reset();}}
         className="mt-2 block min-h-11 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"/>
     </label>
   </div>
   <p className="text-sm text-[#52615b]">
     Intestazioni supportate: <code>company_name</code> (o denominazione),
     <code> website</code>, <code>vat_id</code>, <code>province</code>,
     <code> municipality</code>, <code>ateco_code</code>, <code>ateco_version</code>,
     <code> source_record_id</code>, <code>evidence_url</code>. CSV separato da punto e virgola o virgola.
     Non caricare nomi di persone, contatti, PEC, email o numeri telefonici.
   </p>
   {!ready&&sources.length>0?<p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
     La fonte non dispone ancora di tutti i requisiti di licenza e riuso approvati.
     È consentita soltanto l&apos;anteprima; il salvataggio verrà rifiutato.
   </p>:null}
   {error?<p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>:null}
   <button type="button" disabled={busy||!file||!source} onClick={()=>void send("preview")}
     className="platform-primary min-h-11 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50">
     {busy?"Verifica in corso…":"1. Anteprima e deduplicazione (nessun salvataggio)"}
   </button>
   {preview?<section className="rounded-2xl border border-[#a5c8be] bg-[#f5faf8] p-5 space-y-4">
      <h2 className="text-lg font-semibold text-[#16382f]">Anteprima completata: nessuna azienda pubblicata</h2>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
       <p><strong className="block text-xl">{preview.original_rows}</strong>Righe lette</p>
       <p><strong className="block text-xl">{preview.eligible_new}</strong>Nuove potenziali</p>
       <p><strong className="block text-xl">{preview.existing_companies+preview.existing_candidates+preview.already_staged}</strong>Già note</p>
       <p><strong className="block text-xl">{preview.duplicates_in_file+preview.duplicate_within_chunk}</strong>Duplicati nel CSV</p>
      </div>
      <p className="text-sm text-[#3d514a]">Fonte con diritti confermati: <strong>{preview.source_rights_ready?"Sì":"No"}</strong>.
        Le categorie sono proposte dall&apos;operatore e richiedono ulteriore verifica.</p>
      <label className="flex items-start gap-3 text-sm text-[#203b43]">
       <input className="mt-1 h-4 w-4" type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>
       Confermo che il file contiene esclusivamente dati aziendali autorizzati e accetto che le righe non duplicate siano salvate solo in staging per revisione.
      </label>
      <button type="button" disabled={busy||!confirm||!preview.source_rights_ready}
       onClick={()=>void send("stage")} className="platform-primary min-h-11 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50">
       2. Conferma importazione in staging (nessuna pubblicazione)
      </button>
    </section>:null}
   {outcome?<section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
     <strong>Importazione completata.</strong> Nuove righe in staging: {outcome.inserted}.
     Lotti elaborati: {outcome.batches}. Lotti già acquisiti: {outcome.skipped_existing_batch}.
     Nessuna azienda pubblicata. La revisione resta obbligatoria.
   </section>:null}
 </div>;
}
