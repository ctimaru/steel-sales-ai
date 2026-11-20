"use client";

import {useEffect,useRef,useState,type ReactNode,type KeyboardEvent} from "react";

/**
 * NET-AI-TOOLBAR1 — the AI assistant shares the search surface, while the
 * geographic map remains unobstructed. Conversation stays mounted while the
 * panel is hidden, so closing it does not erase the local transcript/draft.
 *
 * A non-modal region (not a dialog) preserves access to the results and map.
 */
export function NetworkAiSearchDock({
  search,assistant,
}:{
  search:ReactNode;
  assistant:ReactNode;
}){
  const [open,setOpen]=useState(false);
  const toggleRef=useRef<HTMLButtonElement>(null);
  const panelRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(open)panelRef.current?.querySelector<HTMLInputElement>("#network-chat-input")?.focus();
  },[open]);
  const close=()=>{
    setOpen(false);
    toggleRef.current?.focus();
  };
  const onPanelKeyDown=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==="Escape"){
      event.preventDefault();
      close();
    }
  };
  return <div className="min-w-0 space-y-2" data-testid="network-ai-search-dock">
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch"
      data-testid="network-ai-search-row">
      <div className="min-w-0 flex-1">{search}</div>
      <button ref={toggleRef} type="button" aria-expanded={open}
        aria-controls="network-ai-assistant-panel"
        onClick={()=>setOpen(value=>!value)}
        data-testid="network-ai-launcher"
        className={"ui-action inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] "+
          (open?"ui-action-primary":"ui-action-secondary")}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z"/>
          <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/>
        </svg>
        {open?"Chiudi AI":"Chiedi all’AI"}
      </button>
    </div>
    <div id="network-ai-assistant-panel" ref={panelRef} hidden={!open}
      role="region" aria-label="Assistente AI del Network"
      onKeyDown={onPanelKeyDown}
      data-testid="network-ai-assistant-panel"
      className="min-w-0 rounded-2xl border border-[#b7d1c4] bg-white shadow-[0_6px_24px_rgba(20,75,53,0.08)]">
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-[#e3ebe5] bg-[#f7faf8] px-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-[#175640]">
          <span aria-hidden="true">✦</span>
          <span>Assistente Network</span>
          <span className="rounded-full bg-[#e4f0e9] px-2 py-0.5 text-[10px]">AI · voce opzionale</span>
        </div>
        <button type="button" onClick={close} aria-label="Chiudi assistente AI"
          className="ui-action ui-action-secondary inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold">
          Chiudi
        </button>
      </div>
      {assistant}
    </div>
  </div>;
}
