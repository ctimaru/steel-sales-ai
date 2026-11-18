"use client";

import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import {createClient} from "@/lib/supabase/client";

type Item={catalog_id:string;name:string;edition:string;format:string;state:string;created_at:string};
type State={contract:string;eligible:boolean;items:Item[]};
const bucket="producer-authorized-catalogs";
const input="mt-2 w-full rounded-xl border border-[#d1dfd6] bg-white px-3 py-3 text-sm text-[#294c3c] outline-none focus:border-[#1d6b4f] focus:ring-2 focus:ring-[#e1f0e7]";
const labels:Record<string,string>={
  awaiting_upload:"Caricamento incompleto",pending_provenance:"In attesa di verifica della fonte",
  withdrawn:"Revocato"
};
const errorMessage=(err:unknown)=>{
  const code=(err&&typeof err==="object"&&"code" in err)?String(err.code):"";
  return code==="42501"?"Accesso negato: verifica identità, diritti o scadenza.":
    code==="22023"?"Controlla URL ufficiale, edizione e formato del documento.":
    "Operazione non completata. Riprovare o contattare l'assistenza.";
};
function hex(bytes:ArrayBuffer){
  return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,"0")).join("");
}

export function ProducerCatalogueUpload({companyId,companyName}:{
  companyId:string|null;companyName:string|null;
}){
  const [state,setState]=useState<State|null>(null);
  const [file,setFile]=useState<File|null>(null);
  const [url,setUrl]=useState("");
  const [edition,setEdition]=useState("2026");
  const [rights,setRights]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  const refresh=useCallback(async()=>{
    if(!companyId)return;
    const db=createClient();
    const {data,error:failure}=await db.rpc("netproducers1_b3c2_catalog_submission",{
      p_operation:"status",p_payload:{company_id:companyId}
    });
    if(failure){setError(errorMessage(failure));return;}
    if(data?.contract!=="netproducers-b3c2-v1"||
      typeof data.eligible!=="boolean"||!Array.isArray(data.items)){
      setError("Stato cataloghi non disponibile.");return;
    }
    setState(data as State);
  },[companyId]);
  useEffect(()=>{void refresh();},[refresh]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setNotice("");setError("");
    if(!companyId||!state?.eligible||!rights||!file)return;
    const ext=file.name.toLowerCase().endsWith(".pdf")?"pdf":
      file.name.toLowerCase().endsWith(".csv")?"csv":null;
    if(!ext){setError("Utilizza un file PDF o CSV.");return;}
    const max=ext==="pdf"?8*1024*1024:2*1024*1024;
    if(file.size<1||file.size>max){setError("Dimensione massima: PDF 8 MB, CSV 2 MB.");return;}
    if(ext==="pdf"&&file.type&&file.type!=="application/pdf"){
      setError("Formato PDF non valido.");return;
    }
    if(!url.startsWith("https://")){setError("Inserisci il link ufficiale https del catalogo.");return;}
    const name=file.name.replace(/[^a-zA-Z0-9 ._-]/g,"_").slice(0,140).trim();
    if(name.length<5){setError("Nome documento non valido.");return;}

    setBusy(true);
    try{
      const db=createClient();
      const sha=hex(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()));
      const {data:prepared,error:prepareError}=await db.rpc(
        "netproducers1_b3c2_catalog_submission",{
          p_operation:"prepare",
          p_payload:{
            company_id:companyId,source_url:url.trim(),
            edition:edition.trim(),name,format:ext,sha256:sha,
            rights_declaration:true
          }
        });
      if(prepareError)throw prepareError;
      const expectedPath=companyId+"/"+prepared?.catalog_id+"/"+sha+"."+ext;
      if(prepared?.contract!=="netproducers-b3c2-v1"||
         prepared?.status!=="prepared"||prepared?.rights_verified!==false||
         prepared?.published_claims!==0||prepared?.bucket!==bucket||
         prepared?.object_path!==expectedPath){
        throw new Error("invalid_upload_reservation");
      }
      const {error:uploadError}=await db.storage.from(bucket).upload(
        expectedPath,file,{
          contentType:ext==="pdf"?"application/pdf":"text/csv",
          upsert:false,cacheControl:"0"
        });
      if(uploadError)throw uploadError;
      const {data:done,error:finalizeError}=await db.rpc(
        "netproducers1_b3c2_catalog_submission",{
          p_operation:"finalize",
          p_payload:{company_id:companyId,catalog_id:prepared.catalog_id}
        });
      if(finalizeError)throw finalizeError;
      if(done?.contract!=="netproducers-b3c2-v1"||
         done?.status!=="pending_provenance"||done?.rights_verified!==false||
         done?.published_claims!==0)throw new Error("invalid_finalized_receipt");
      setNotice("Catalogo ricevuto. Verifichiamo la fonte e i diritti prima dell'analisi.");
      setFile(null);setRights(false);
      const control=document.getElementById("producer-catalog-file") as HTMLInputElement|null;
      if(control)control.value="";
      await refresh();
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }

  async function withdraw(id:string){
    if(!companyId||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const {data,error:failure}=await createClient().rpc(
        "netproducers1_b3c2_catalog_submission",{
          p_operation:"withdraw",p_payload:{company_id:companyId,catalog_id:id}
        });
      if(failure)throw failure;
      if(!["withdrawn","already_withdrawn"].includes(data?.status))
        throw new Error("invalid_revoke_response");
      setNotice("Catalogo revocato.");
      await refresh();
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }

  if(!companyId)return <div className="rounded-2xl border border-[#d9e7de] bg-[#f5faf6] p-5">
    <h2 className="font-semibold text-[#214e3b]">Verifica prima la tua azienda</h2>
    <p className="mt-2 text-sm text-[#5a6d62]">
      È necessario un profilo produttore gestito da un amministratore autorizzato.
    </p>
    <Link href="/network" className="mt-4 inline-flex rounded-xl bg-[#19543f] px-4 py-3 text-sm font-semibold text-white">
      Cerca e verifica la tua azienda</Link>
  </div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 text-xs font-semibold">
      <span className="rounded-full bg-[#e8f4ec] px-3 py-2 text-[#175440]">{companyName}</span>
      <span className="rounded-full bg-[#f1f3f2] px-3 py-2 text-[#4c6358]">
        {state?.eligible?"Identità aziendale verificata":"Verifica aziendale necessaria"}
      </span>
      <span className="rounded-full bg-[#f1f3f2] px-3 py-2 text-[#4c6358]">
        Dati privati fino a verifica
      </span>
    </div>
    {state?.eligible===false?
      <div className="rounded-2xl border border-[#e4d7b8] bg-[#fffbf3] p-5">
        <h2 className="font-semibold text-[#79551d]">Autorizzazione aziendale da completare</h2>
        <p className="mt-2 text-sm leading-6 text-[#706149]">
          Per caricare cataloghi occorre un claim aziendale approvato,
          con prova di identità verificata, e il ruolo di amministratore.
        </p>
        <Link className="mt-3 inline-block text-sm font-semibold text-[#1d6b4f] underline"
          href="/network/manage">Gestisci la verifica aziendale</Link>
      </div>
    :state?.eligible?
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#dbe6df] bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#28513f] sm:col-span-2">
          1. Seleziona il catalogo PDF o CSV
          <input id="producer-catalog-file" type="file" required disabled={busy}
            accept=".pdf,.csv,application/pdf,text/csv"
            onChange={e=>setFile(e.target.files?.[0]??null)}
            className="mt-2 block w-full rounded-xl border border-dashed border-[#9dbbab] bg-[#f5faf6] p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#dcece2] file:px-3 file:py-2"/>
          <span className="mt-1 block text-xs font-normal text-[#637569]">
            PDF massimo 8 MB · CSV massimo 2 MB
          </span>
        </label>
        <label className="text-sm font-semibold text-[#28513f]">
          Edizione
          <input className={input} value={edition} onChange={e=>setEdition(e.target.value)}
            maxLength={80} required disabled={busy} placeholder="2026"/>
        </label>
        <label className="text-sm font-semibold text-[#28513f] sm:col-span-2">
          2. URL ufficiale del catalogo (sito aziendale)
          <input type="url" className={input} value={url} onChange={e=>setUrl(e.target.value)}
            maxLength={1200} required disabled={busy}
            placeholder="https://www.tuaproduzione.it/catalogo/prodotti.pdf"/>
          <span className="mt-1 block text-xs font-normal text-[#637569]">
            Non utilizzare link di altri produttori o di portali terzi.
          </span>
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-xl bg-[#f5faf6] p-4 text-sm leading-6 text-[#335746]">
        <input type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}
          disabled={busy} required className="mt-1 h-4 w-4 accent-[#19543f]"/>
        <span><strong>3. Dichiaro i diritti del produttore.</strong> Sono autorizzato dall'azienda
          a fornire questo catalogo e a consentirne l'estrazione tecnica, la conservazione
          dei dati derivati e il loro uso nella ricerca industriale Smart Steel Sales.
          L'origine e i diritti saranno verificati prima della lavorazione.</span>
      </label>
      <button type="submit" disabled={busy||!rights||!file}
        className="min-h-11 w-full rounded-xl bg-[#19543f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#257758] disabled:opacity-40 sm:w-auto">
        {busy?"Caricamento in corso…":"Invia il catalogo"}</button>
    </form>:<p className="text-sm text-[#5d7567]">Verifica dell'accesso in corso…</p>}
    {notice&&<p role="status" className="text-sm font-semibold text-[#1c6c4b]">{notice}</p>}
    {error&&<p role="alert" className="text-sm font-semibold text-[#9a3935]">{error}</p>}
    {state?.eligible&&<section className="rounded-2xl border border-[#dce8df] bg-white p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[#294b39]">Cataloghi della mia azienda</h2>
        <button type="button" onClick={()=>void refresh()}
          className="text-xs font-semibold text-[#1f7150] underline">Aggiorna</button>
      </div>
      {!state.items.length?<p className="text-sm text-[#637569]">Nessun catalogo inviato.</p>:
        <ul className="space-y-2">
          {state.items.map(item=><li key={item.catalog_id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1e9e4] px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-[#294638]">{item.name}</p>
              <p className="text-xs text-[#62796a]">{item.format.toUpperCase()} · {item.edition} · {labels[item.state]??"In verifica"}</p>
            </div>
            {item.state!=="withdrawn"&&<button type="button" disabled={busy}
              onClick={()=>void withdraw(item.catalog_id)}
              className="rounded-lg border border-[#d8aaaa] px-3 py-2 text-xs font-semibold text-[#a24441]">
              Revoca
            </button>}
          </li>)}
        </ul>}
    </section>}
  </div>;
}
