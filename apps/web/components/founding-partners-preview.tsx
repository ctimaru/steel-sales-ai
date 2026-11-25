"use client";

import { useState } from "react";
import { NETWORK_PRO_MODULES, type NetworkProModuleKey } from "@/lib/network-pro-catalog";
import { FOUNDING_PRESETS, FOUNDING_TERM_MONTHS, foundingQuote, type FoundingRole } from "@/lib/founding-partners-preview";

const labels = {
 it:{
  eyebrow:"FOUNDING PARTNERS · 2027",preview:"Anteprima riservata · condizioni indicative",title:"Il futuro dell’acciaio comincia con la tua azienda.",
  intro:"Scegli il Network PRO adatto alla tua attività. Conoscenza tecnica, relazioni industriali e nuove opportunità commerciali.",
  configure:"Configura il tuo Network PRO",company:"La tua azienda",lookup:"Ricerca nel Network in preparazione",role:"Qual è la tua attività?",manual:"Seleziona la tua attività",suggested:"Usa configurazione suggerita",
  roles:{producer:"Produttore",distributor:"Commerciante",processor:"Carpenteria / terzista",end_user:"Utilizzatore industriale"},
  modules:{producers:["Produttori","Intelligence Produttori e ricerca tecnica"],distributors:["Commercianti","Distributori, stockholder e grossisti"],end_users:["Utilizzatori industriali","OEM e consumatori industriali"],processors:["Carpenterie e lavorazioni","Carpenterie metalliche e terzisti"]},
  total:"Il tuo Early Access",monthly:"/mese",vat:"Per azienda, IVA esclusa",reference:"Listino ipotetico di riferimento",difference:"Differenza indicativa su 12 mesi",term:"Condizioni proposte per i primi 12 mesi dall’attivazione.",none:"Seleziona almeno un modulo.",clear:"Azzera selezione",cta:"Prenotazione in preparazione",foot:"Anteprima non vincolante. Nessuna prenotazione, vendita, raccolta dati o diritto di accesso. Prezzi da approvare.",eu:"Europa: disponibilità da validare.",selected:"moduli selezionati",scope:"Italia",benefits:["Ricerca industriale mirata","Intelligence tecnica per il modulo Produttori","Configura solo ciò che ti serve"]
 },
 en:{
  eyebrow:"FOUNDING PARTNERS · 2027",preview:"Private preview · indicative terms",title:"The future of steel starts with your company.",
  intro:"Choose the Network PRO modules that fit your business. Technical knowledge, industrial relationships and new commercial opportunities.",
  configure:"Configure your Network PRO",company:"Your company",lookup:"Network company search in preparation",role:"What does your company do?",manual:"Choose your business type",suggested:"Use suggested configuration",
  roles:{producer:"Producer",distributor:"Distributor",processor:"Fabricator / processor",end_user:"Industrial end user"},
  modules:{producers:["Producers","Producer Intelligence and technical search"],distributors:["Distributors","Stockholders, wholesalers and traders"],end_users:["Industrial end users","OEMs and industrial consumers"],processors:["Fabricators and processing","Metal fabricators and specialist services"]},
  total:"Your Early Access",monthly:"/month",vat:"Per company, excluding VAT",reference:"Indicative reference price",difference:"Illustrative 12-month difference",term:"Proposed terms for the first 12 months after activation.",none:"Select at least one module.",clear:"Clear selection",cta:"Reservations in preparation",foot:"Non-binding preview. No reservation, sale, data collection or access entitlement. Prices subject to approval.",eu:"Europe: availability to be validated.",selected:"modules selected",scope:"Italy",benefits:["Targeted industrial search","Technical intelligence in the Producers module","Configure only what you need"]
 }
} as const;
const euro=(value:number,locale:"it"|"en")=>new Intl.NumberFormat(locale==="it"?"it-IT":"en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(value);
function ModuleIcon({kind}:{kind:NetworkProModuleKey}) {
 return <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
 {kind==="producers"?<path d="M4 27V15l8-5v6l8-6v6l8-5v16H4ZM8 15V5h4v5M9 22h3m4 0h3m4 0h2"/>:kind==="distributors"?<path d="m3 12 13-8 13 8v15H3V12Zm4 15V15h18v12M7 19h18M7 23h18"/>:kind==="end_users"?<path d="M5 27V9h12v18m0-12h10v12H5M9 13h4m-4 5h4m-4 5h4m8-4h3m-3 4h3"/>:<path d="m5 24 13-13-1-5 5-2 5 5-2 5-5-1L7 26l-2-2Zm13-6 8 8m-5-11 6 6"/>}
 </svg>;
}
export function FoundingPartnersPreview({locale="it"}:{locale?:"it"|"en"}) {
 const c=labels[locale];
 const [selected,setSelected]=useState<NetworkProModuleKey[]>([]);
 const [role,setRole]=useState<FoundingRole|"">("");
 const quote=foundingQuote(selected);
 const toggle=(key:NetworkProModuleKey)=>setSelected(old=>old.includes(key)?old.filter(x=>x!==key):[...old,key]);
 return <div lang={locale} data-testid="founding-preview" className="mx-auto w-full min-w-0 max-w-[1160px] overflow-hidden rounded-2xl border border-[#d5dedb] bg-white text-[#20332e]">
   <section className="relative isolate overflow-hidden bg-[#123b34] px-5 py-8 sm:px-8 sm:py-10" style={{color:"#ffffff"}}>
     <svg aria-hidden="true" viewBox="0 0 390 220" className="pointer-events-none absolute -right-8 bottom-0 -z-10 w-[55%] opacity-30" fill="none" stroke="#b1d5c7" strokeWidth="1.2">
       {[0,1,2,3,4,5].map(i=><g key={i} transform={"translate("+(i*48)+" "+(i%2*22)+")"}><path fill="#24574a" d="m5 106 116-66 29 16-116 66z M34 122 150 56v32L34 154z"/><path fill="#9abfae" d="m5 106 29 16v32L5 138z"/><path fill="#123b34" d="m12 118 15 8v16l-15-8z"/></g>)}
     </svg>
     <div className="relative max-w-2xl">
       <p className="text-xs font-bold tracking-widest" style={{color:"#c7e5d9"}}>{c.eyebrow}</p>
       <p className="mt-2 text-xs font-medium" style={{color:"#e0ede7"}}>{c.preview}</p>
       <h1 className="mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl" style={{color:"#ffffff"}}>{c.title}</h1>
       <p className="mt-3 max-w-xl text-sm leading-6 sm:text-base" style={{color:"#e0ede7"}}>{c.intro}</p>
       <a href="#founding-config" className="mt-5 inline-flex min-h-11 max-w-full items-center rounded-lg px-4 py-2 text-sm font-bold" style={{backgroundColor:"#ffffff",color:"#123b34",WebkitTextFillColor:"#123b34"}}>{c.configure}</a>
     </div>
   </section>
   <div className="grid min-w-0 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
     <section id="founding-config" className="min-w-0 scroll-mt-4">
       <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{c.company}</h2><span className="rounded-full border border-[#d5dedb] px-3 py-1 text-xs font-semibold">IT · {c.scope}</span></div>
       <div className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-[#b0c3bb] bg-[#f5f8f7] px-3 py-2 text-sm text-[#466058]"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>{c.lookup}</div>
       <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
         <label className="min-w-0 text-xs font-semibold">{c.role}<select data-testid="founding-role" value={role} onChange={e=>setRole(e.target.value as FoundingRole|"")} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-[#a4b8af] bg-white px-3 py-2 text-sm text-[#20332e]"><option value="">{c.manual}</option>{Object.entries(c.roles).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
         <button type="button" data-testid="founding-preset" disabled={!role} onClick={()=>{if(role)setSelected([...FOUNDING_PRESETS[role]])}} className="min-h-11 rounded-lg border border-[#a4b8af] px-3 py-2 text-sm font-semibold text-[#123b34] disabled:opacity-50">{c.suggested}</button>
       </div>
       <div className="mt-5 flex flex-wrap items-center justify-between gap-1"><h2 className="text-lg font-semibold">{c.configure}</h2><button type="button" data-testid="founding-clear" onClick={()=>setSelected([])} className="min-h-11 px-1 text-xs font-semibold text-[#315b4f] underline">{c.clear}</button></div>
       <div className="mt-1 grid grid-cols-1 gap-2 min-[390px]:grid-cols-2">
       {NETWORK_PRO_MODULES.map(m=>{const active=selected.includes(m.key);return <button type="button" key={m.key} data-testid={"founding-module-"+m.key} aria-pressed={active} onClick={()=>toggle(m.key)} className={"flex min-h-[126px] min-w-0 flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a] "+(active?"border-[#26785d] bg-[#edf6f1]":"border-[#dce5e0] bg-white hover:border-[#8ba99b]")}><div className="flex w-full items-center justify-between gap-2 text-[#1f6b5a]"><ModuleIcon kind={m.key}/><span aria-hidden="true" className={"flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold "+(active?"border-[#1f6b5a] bg-[#1f6b5a] text-white":"border-[#a4b8af] bg-white")}>{active?"✓":""}</span></div><span className="break-words text-sm font-semibold leading-5">{c.modules[m.key][0]}</span><span className="break-words text-xs leading-5 text-[#496158]">{c.modules[m.key][1]}</span></button>})}
       </div>
       <p className="mt-3 text-xs leading-5 text-[#496158]">{c.eu}</p>
     </section>
     <aside className="min-w-0 self-start rounded-xl border border-[#d5dedb] bg-[#f7faf8] p-4 sm:p-5" aria-label={c.total}>
       <p className="text-xs font-bold uppercase tracking-wider text-[#1f6b5a]">{c.total}</p>
       <div aria-live="polite" data-testid="founding-summary" className="mt-3">
         <p className="text-sm text-[#496158]">{quote.count} {c.selected}</p>
         <div className="mt-1 flex flex-wrap items-baseline gap-2"><span data-testid="founding-price" className="text-4xl font-bold tabular-nums tracking-tight text-[#123b34]">{euro(quote.monthly,locale)}</span><span className="text-sm text-[#496158]">{c.monthly}</span></div>
         <p className="mt-1 text-xs text-[#496158]">{c.vat}</p>
         {quote.count>0?<div className="mt-4 space-y-2 border-t border-[#d5dedb] pt-4 text-sm"><div className="flex flex-wrap justify-between gap-1"><span className="text-[#496158]">{c.reference}</span><span data-testid="founding-reference" className="font-semibold tabular-nums">{euro(quote.reference,locale)}</span></div><div className="flex flex-wrap justify-between gap-1"><span className="text-[#496158]">{c.difference}</span><span data-testid="founding-difference" className="font-semibold tabular-nums text-[#1f6b5a]">{euro(quote.annualDifference,locale)}</span></div><p className="text-xs leading-5 text-[#496158]">{c.term}</p></div>:<p className="mt-4 text-sm text-[#496158]">{c.none}</p>}
       </div>
       <button type="button" disabled data-testid="founding-reserve" className="mt-5 min-h-12 w-full rounded-lg border border-[#b8c7bf] bg-[#e5ebe7] px-3 py-3 text-sm font-semibold text-[#465e53]">{c.cta}</button>
       <p className="mt-2 text-xs leading-5 text-[#496158]">{c.foot}</p>
       <div className="mt-4 border-t border-[#d5dedb] pt-3">{c.benefits.map(b=><p key={b} className="mt-2 flex items-start gap-2 text-xs leading-5"><span aria-hidden="true" className="font-bold text-[#1f6b5a]">✓</span>{b}</p>)}</div>
     </aside>
   </div>
 </div>;
}
