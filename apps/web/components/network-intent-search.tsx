"use client";

import {useMemo,useState,useTransition} from "react";
import type {FormEvent} from "react";
import {useRouter} from "next/navigation";
import {
  interpretNetworkIntent,networkIntentHref,
  type NetworkIntentProduct,
} from "@/lib/network-intent-parser";

const examples=[
  "Quanti commercianti in Lombardia?",
  "Cerco produttori in Veneto",
  "Trova utilizzatori in Piemonte",
];

/** Bounded discovery preview. An intent is applied only after explicit submit.
 * Existing Free/Pro APIs remain authoritative for results, totals and access.
 */
export function NetworkIntentSearch({
  regions=[],products=[],
}:{regions?:string[];products?:NetworkIntentProduct[]}){
  const router=useRouter();
  const [draft,setDraft]=useState("");
  const [pending,startTransition]=useTransition();
  const parsed=useMemo(()=>interpretNetworkIntent(draft,{regions,products}),[draft,regions,products]);
  const href=networkIntentHref(parsed);
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(href)startTransition(()=>router.push(href));
  };
  return <details className="group mt-2 rounded-xl border border-[#c6d9cf] bg-white/80" data-testid="network-intelligent-discovery">
    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
      <span>Ricerca per frase <span className="ml-1 rounded-full bg-[#e4f0e9] px-2 py-0.5 text-[10px] font-semibold text-[#175640]">Anteprima</span></span>
      <span aria-hidden="true" className="text-base transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <div className="border-t border-[#e6efea] px-3 pb-3 pt-2">
      <p className="mb-2 text-xs leading-5 text-[#52615b]">
        Scrivi cosa cerchi: interpreto ruolo, Paese, regione e tubi. Conferma i filtri prima di vedere i risultati reali del Network.
      </p>
      <form onSubmit={submit} className="flex min-w-0 flex-col gap-2 sm:flex-row" aria-label="Ricerca Network per frase">
        <label htmlFor="network-intent-query" className="sr-only">Descrivi le aziende da cercare</label>
        <input id="network-intent-query" type="search" maxLength={240} autoComplete="off"
          value={draft} onChange={event=>setDraft(event.target.value)}
          placeholder="Es. commercianti di tubi in Lombardia"
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#b7cfc2] bg-white px-3 text-sm text-[#173f35] outline-none placeholder:text-[#647269] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"/>
        <button type="submit" disabled={!href||pending}
          className="ui-action ui-action-primary min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60">
          {pending?"Caricamento…":parsed.intent==="count"?"Mostra conteggio":"Trova aziende"}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Esempi di ricerca">
        {examples.map(value=><button key={value} type="button" onClick={()=>setDraft(value)}
          className="ui-action ui-action-secondary inline-flex min-h-8 items-center rounded-full px-2.5 text-[11px] font-medium">
          {value}
        </button>)}
      </div>
      {parsed.status==="ready"?
        <div className="mt-2" role="status" aria-live="polite">
          <p className="text-[11px] font-semibold text-[#175640]">
            {parsed.intent==="count"?"Il conteggio sarà calcolato sui risultati autorizzati.":"Filtri riconosciuti"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5" data-testid="network-intent-filters">
            {parsed.chips.map(chip=><span key={chip} className="rounded-full border border-[#bbd5c8] bg-[#eaf4ee] px-2 py-1 text-[11px] font-semibold text-[#175640]">{chip}</span>)}
          </div>
          {parsed.technicalOnly?<p className="mt-1 text-[11px] leading-4 text-[#52615b]">
            Il filtro per prodotti dichiarati o Paesi esteri include solo i profili pubblicati con dati strutturati: le aziende censite senza tali dati non sono conteggiate.
          </p>:null}
          <p className="mt-1 text-[11px] text-[#52615b]">La ricerca per frase sostituisce i filtri attuali. Puoi modificarli nei risultati.</p>
        </div>:parsed.status==="unsupported"?
          <p role="status" className="mt-2 text-[11px] leading-5 text-[#875117]">
            {parsed.unsupported.length?
              "Non posso applicare senza perdere vincoli: "+parsed.unsupported.join(", ")+". Riformula usando ruolo, regione, Paese o tubi.":
              "Non ho riconosciuto filtri applicabili. Per un nome aziendale usa il campo Cerca sopra."}
          </p>:null}
    </div>
  </details>;
}
