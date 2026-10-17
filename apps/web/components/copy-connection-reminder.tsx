"use client";
import {useState} from "react";
/** User-initiated local copy only. Never writes a follow-up to Network or email. */
export function CopyConnectionReminder({recipient,purpose,createdAt}:{
 recipient:string;purpose:string;createdAt:string;
}){
 const [result,setResult]=useState<"idle"|"copied"|"error">("idle");
 async function copy(){
  const day=new Date(createdAt);
  const date=Number.isNaN(day.getTime())?"data non disponibile":new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"2-digit",year:"numeric"}).format(day);
  const value="Promemoria della nostra richiesta commerciale\n"+
   "Azienda destinataria: "+recipient+"\n"+
   "Oggetto: "+purpose+"\n"+
   "Richiesta inviata il "+date+"\n\n"+
   "Buongiorno, vi contattiamo per sapere se avete avuto modo di valutare la nostra precedente proposta. "+
   "Rimaniamo a disposizione per eventuali informazioni. Cordiali saluti.";
  try{
   await navigator.clipboard.writeText(value);
   setResult("copied");
  }catch{setResult("error");}
 }
 return <div className="flex flex-wrap items-center gap-2">
  <button type="button" onClick={copy}
   className="inline-flex min-h-10 items-center rounded-xl border border-[#cadbcf] bg-[#f6faf7] px-3 text-xs font-semibold text-[#175640]">
   {result==="copied"?"Riepilogo copiato ✓":"Copia promemoria"}
  </button>
  <span role="status" className="text-[11px] text-[#607067]">
   {result==="error"?"Copia non disponibile su questo dispositivo.": "Solo negli appunti: nessun invio automatico"}
  </span>
 </div>;
}
