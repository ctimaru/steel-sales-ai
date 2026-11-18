"use client";

import {useCallback,useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type OwnerRow={
 id:string;standard:string;shape:"RHS"|"SHS"|"CHS";
 width_mm:number|null;height_mm:number|null;diameter_mm:number|null;
 review_status:"pending"|"confirmed"|"removed";
};
const n=(v:number|null)=>v===null?"—":new Intl.NumberFormat("it-IT",{maximumFractionDigits:2}).format(v);
const size=(x:OwnerRow)=>x.shape==="CHS"?"Ø "+n(x.diameter_mm):
 n(x.width_mm)+" × "+n(x.height_mm);

export function ProducerPdfSizeOwner({companyId}:{companyId:string|null}){
 const [rows,setRows]=useState<OwnerRow[]>([]);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  if(!companyId)return;
  const {data,error:e}=await createClient().rpc("netproducers_c3_pdf_owner",{
   p_action:"list",p_company:companyId,p_id:null,
  });
  if(e||data?.contract!=="netproducers-c3-pdf-owner-v1"||!Array.isArray(data.items)){
   setError("Queste misure sono gestibili soltanto da un amministratore di produttore verificato.");
   return;
  }
  setRows(data.items as OwnerRow[]);setError("");
 },[companyId]);
 useEffect(()=>{void refresh();},[refresh]);
 const act=async(id:string,action:"confirm"|"remove"|"restore")=>{
  if(!companyId||busy)return;
  setBusy(id);setError("");setNotice("");
  try{
   const {data,error:e}=await createClient().rpc("netproducers_c3_pdf_owner",{
    p_action:action,p_company:companyId,p_id:id,
   });
   if(e||data?.contract!=="netproducers-c3-pdf-owner-v1"||data.status!==action)throw e||Error("failed");
   await refresh();
   setNotice(action==="remove"?"La misura è stata rimossa dalla ricerca pubblica.":
    action==="confirm"?"La misura è ora confermata come dato aziendale; non certifica una combinazione completa.":
    "La misura è nuovamente pubblica, da confermare.");
  }catch{setError("Impossibile aggiornare la misura. Verifica l'accesso e riprova.");}
  finally{setBusy(null);}
 };
 return <section className="space-y-3 rounded-[20px] border border-[#d5e7db] bg-white p-4 sm:p-5" data-testid="pdf-row-owner">
  <div>
   <p className="text-[10px] font-bold uppercase tracking-wider text-[#26704b]">Controllo delle misure estratte dai PDF</p>
   <h2 className="mt-1 text-lg font-extrabold text-[#224d36]">Conferma o elimina una misura</h2>
   <p className="mt-2 text-xs leading-5 text-[#65796b]">
    I valori pubblici possono essere corretti dal produttore senza inviare ticket.
    Una rimozione prevale su qualsiasi successiva scansione automatica.
   </p>
  </div>
  {error?<p role="alert" className="text-xs text-[#a44836]">{error}</p>:null}
  {notice?<p role="status" className="text-xs font-semibold text-[#24724b]">{notice}</p>:null}
  {rows.length?<div className="max-h-[420px] space-y-2 overflow-auto">
   {rows.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e2eae4] bg-[#fcfefc] p-3">
     <span className="text-xs font-semibold text-[#31553e]">
       {x.standard} · {x.shape} {size(x)} mm
       <span className="ml-2 text-[10px] text-[#799080]">
        {x.review_status==="removed"?"Rimossa":x.review_status==="confirmed"?"Attributo confermato":"Da confermare"}
       </span>
     </span>
     <div className="flex flex-wrap gap-2">
      {x.review_status==="removed"?
       <button disabled={!!busy} onClick={()=>void act(x.id,"restore")} type="button"
        className="min-h-9 rounded-lg border border-[#c6daca] px-3 text-[11px] font-bold text-[#1a6947]">Ripubblica</button>:
       <>
        {x.review_status!=="confirmed"?<button disabled={!!busy} type="button"
          onClick={()=>void act(x.id,"confirm")}
          className="min-h-9 rounded-lg bg-[#185d3e] px-3 text-[11px] font-bold text-white">Conferma</button>:null}
        <button disabled={!!busy} type="button" onClick={()=>void act(x.id,"remove")}
          className="min-h-9 rounded-lg border border-[#e5b7ad] px-3 text-[11px] font-bold text-[#a04a38]">Rimuovi</button>
       </>}
     </div>
    </div>)}
  </div>:!error?<p className="text-xs text-[#829182]">Nessuna misura PDF associata a questo produttore.</p>:null}
 </section>;
}