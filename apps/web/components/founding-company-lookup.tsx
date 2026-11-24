"use client";
import {useRef,useState,type FormEvent} from "react";
import {initialFoundingCompanyLookup,type FoundingCompanyIdentity,type FoundingCompanyLookupState} from "@/lib/founding-company-lookup-contract";
const copy={
 it:{label:"Ragione sociale o partita IVA",placeholder:"Es. nome della tua azienda",search:"Cerca",pending:"Ricerca…",invalid:"Inserisci almeno 3 caratteri o la partita IVA completa.",error:"Ricerca momentaneamente non disponibile. Riprova.",none:"Nessuna corrispondenza. Puoi continuare a configurare i moduli senza selezionare un’azienda.",choose:"Seleziona",change:"Cambia azienda",selected:"Azienda selezionata",note:"Selezione temporanea per l’anteprima. Nessuna rivendicazione o registrazione.",foreign:"Le condizioni indicative Early Access riguardano l’Italia.",vat:"P.IVA"},
 en:{label:"Company name or VAT number",placeholder:"E.g. your company name",search:"Search",pending:"Searching…",invalid:"Enter at least 3 characters or a complete VAT number.",error:"Company search is temporarily unavailable. Try again.",none:"No matches. You can still configure modules without choosing a company.",choose:"Select",change:"Change company",selected:"Selected company",note:"Temporary preview selection. No claim or registration.",foreign:"Indicative Early Access terms apply to Italy.",vat:"VAT"}
} as const;
export function FoundingCompanyLookup({locale}:{locale:"it"|"en"}){
 const c=copy[locale];
 const [state,setState]=useState<FoundingCompanyLookupState>(initialFoundingCompanyLookup);
 const [selected,setSelected]=useState<FoundingCompanyIdentity|null>(null);
 const [pending,setPending]=useState(false);
 const busy=useRef(false);
 async function search(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current)return;
  const form=new FormData(e.currentTarget);
  busy.current=true;setPending(true);setState(initialFoundingCompanyLookup);
  try{
   const res=await fetch("/api/platform/marketing/founding-company-lookup",{method:"POST",body:form,cache:"no-store",signal:AbortSignal.timeout(10000)});
   if(!res.ok)throw Error("lookup");
   const data=await res.json() as FoundingCompanyLookupState;
   if(!["ok","not_found","invalid","error"].includes(data?.status)||!Array.isArray(data.items))throw Error("lookup");
   setState(data);
  }catch{setState({status:"error",items:[]});}
  finally{busy.current=false;setPending(false);}
 }
 return <div className="mt-2 min-w-0" data-testid="founding-company-lookup">
 {selected?<div className="rounded-xl border border-[#9cc5b7] bg-[#edf6f1] p-3" data-testid="founding-company-selected">
   <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#315b4f]">{c.selected}</p><p className="mt-1 break-words text-sm font-bold text-[#123b34]">{selected.legal_name}</p><p className="mt-1 text-xs text-[#496158]">{selected.country_code}{selected.vat_hint?" · "+c.vat+" "+selected.vat_hint:""}</p></div><button type="button" className="min-h-11 rounded-lg border border-[#a4b8af] px-3 text-xs font-semibold text-[#123b34]" onClick={()=>{setSelected(null);setState(initialFoundingCompanyLookup)}}>{c.change}</button></div>
   {selected.country_code!=="IT"?<p className="mt-2 text-xs font-semibold text-[#496158]">{c.foreign}</p>:null}
  </div>:<>
  <form onSubmit={search} className="min-w-0">
   <div aria-hidden="true" className="sr-only"><label>Website<input name="company_website" tabIndex={-1} autoComplete="off"/></label></div>
   <label className="block text-xs font-semibold text-[#315b4f]">{c.label}<div className="mt-1 flex flex-wrap gap-2 sm:flex-nowrap"><input data-testid="founding-company-query" name="company_query" type="search" required minLength={3} maxLength={120} autoComplete="organization" placeholder={c.placeholder} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#a4b8af] bg-white px-3 text-sm text-[#20332e]"/><button data-testid="founding-company-search" type="submit" disabled={pending} className="min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-60" style={{backgroundColor:"#123b34",color:"#fff",WebkitTextFillColor:"#fff"}}>{pending?c.pending:c.search}</button></div></label>
  </form>
  <div aria-live="polite" className="mt-2 space-y-2">
   {state.status==="error"||state.status==="invalid"||state.status==="not_found"?<p data-testid="founding-company-message" className="rounded-lg border border-[#d5dedb] bg-[#f7faf8] p-3 text-xs leading-5 text-[#496158]">{state.status==="error"?c.error:state.status==="invalid"?c.invalid:c.none}</p>:null}
   {state.status==="ok"?state.items.map((item,index)=><article key={item.legal_name+item.country_code+index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d5dedb] p-3" data-testid="founding-company-result"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.legal_name}</p>{item.trading_name&&item.trading_name!==item.legal_name?<p className="break-words text-xs text-[#496158]">{item.trading_name}</p>:null}<p className="mt-1 text-xs text-[#496158]">{item.country_code}{item.vat_hint?" · "+c.vat+" "+item.vat_hint:""}</p></div><button type="button" className="min-h-11 rounded-lg border border-[#a4b8af] px-3 text-xs font-semibold text-[#123b34]" onClick={()=>{setSelected(item);setState(initialFoundingCompanyLookup)}}>{c.choose}</button></article>):null}
  </div></>}
  <p className="mt-2 text-xs leading-5 text-[#496158]">{c.note}</p>
 </div>;
}
