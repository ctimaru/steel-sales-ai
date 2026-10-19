"use client";

import {useEffect,useRef,useState,useTransition} from "react";
import type {FormEvent} from "react";
import {useRouter} from "next/navigation";
import type {CompactNetworkFilters} from "@/lib/network-compact-directory";

/** Debounced server search. Backend remains the source of truth for counts,
 * RLS, ranking and search results; the client only navigates.
 */
export function NetworkLiveSearch({filters}: {filters:CompactNetworkFilters}) {
  const router=useRouter();
  const [draft,setDraft]=useState(filters.q??"");
  const [pending,startTransition]=useTransition();
  const field=useRef<HTMLInputElement>(null);
  const composing=useRef(false);
  const serverQuery=(filters.q??"").trim();

  const navigate=(value:string)=>{
    const next=value.trim().slice(0,120);
    if(next===serverQuery)return;
    const query=new URLSearchParams();
    for(const key of ["role","region","persona","product","capability","market","country"] as const){
      if(filters[key])query.set(key,filters[key]);
    }
    if(next)query.set("q",next);
    // Reset np to page 1, preserve the user's selected filters.
    const href="/network"+(query.size?"?"+query.toString():"");
    startTransition(()=>router.replace(href,{scroll:false}));
  };

  useEffect(()=>{
    // Avoid overwriting an active user's typing with an older server response.
    if(document.activeElement!==field.current)setDraft(filters.q??"");
  },[filters.q]);

  useEffect(()=>{
    if(composing.current||draft.trim()===serverQuery)return;
    const handle=window.setTimeout(()=>navigate(draft),350);
    return ()=>window.clearTimeout(handle);
    // Depend on the current server query to cancel a stale timer after navigation.
  },[draft,serverQuery,filters.role,filters.region,filters.persona,
     filters.product,filters.capability,filters.market,filters.country]);

  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    if(!composing.current)navigate(draft);
  };
  const clear=()=>{
    setDraft("");
    field.current?.focus();
    navigate("");
  };

  return <form role="search" onSubmit={submit} action="/network" method="get"
    className="flex min-w-0 items-center gap-2">
    <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#a7c7b8] bg-white px-3 transition-colors focus-within:border-[#1f6b5a] focus-within:ring-2 focus-within:ring-[#b6d8ca]">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#175640]">
        <circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>
      </svg>
      <label htmlFor="network-compact-search" className="sr-only">Cerca aziende per nome o dominio</label>
      <input ref={field} id="network-compact-search" name="q" type="search"
        value={draft} maxLength={120} autoComplete="off" spellCheck={false}
        onChange={e=>setDraft(e.target.value)}
        onCompositionStart={()=>{composing.current=true;}}
        onCompositionEnd={e=>{composing.current=false;setDraft(e.currentTarget.value);navigate(e.currentTarget.value);}}
        placeholder="Nome azienda o dominio (es. Padana Tubi, acciaitubi.it)"
        className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#173f35] outline-none placeholder:text-[#647269] focus:outline-none"
        aria-label="Nome azienda o dominio"/>
      {draft?<button type="button" onClick={clear} aria-label="Cancella ricerca"
        className="ui-action ui-action-secondary inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
        title="Cancella ricerca">×</button>:null}
    </div>
    <button type="submit"
      className="ui-action ui-action-primary inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-semibold"
      aria-label="Cerca subito">Cerca</button>
    <span role="status" aria-live="polite" className="sr-only">
      {pending?"Aggiornamento dei risultati in corso":"Ricerca automatica attiva"}
    </span>
  </form>;
}
