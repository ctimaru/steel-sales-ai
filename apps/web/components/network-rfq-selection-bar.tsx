"use client";

import {useEffect,useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {
  NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS,NETWORK_RFQ_RECEIVER_PATH,
  networkRfqHandoffKey,serializeNetworkRfqHandoff,
} from "@/lib/network-rfq-supplier-handoff";

/** NET-AUDIT1.3 — selection bar for the Network → RFQ handoff.
 * Row checkboxes belong to the form "network-rfq-selection" (they live in
 * server-rendered rows). Rendered only when the feature flag is on.
 * Writing the handoff never creates or sends an RFQ: the RFQ Hub asks for
 * explicit confirmation after revalidating every supplier server-side.
 */
/** Suppliers checked among the rows currently rendered. Selection is per page by design. */
function checkedSuppliers():string[]{
  return Array.from(document.querySelectorAll<HTMLInputElement>(
    'input[form="network-rfq-selection"][name="supplier"]:checked')).map(input=>input.value);
}

export function NetworkRfqSelectionBar({userId,organizationId,specSummary}:{
  userId:string;organizationId:string;specSummary?:string;
}){
  const router=useRouter();
  const [selected,setSelected]=useState<string[]>([]);
  const [issue,setIssue]=useState("");
  useEffect(()=>{
    const read=()=>setSelected(checkedSuppliers());
    document.addEventListener("change",read);
    // Codex review (#1078): page changes, chip removal or live search replace
    // the rows without a change event. Reconcile with what is on screen, so a
    // supplier that is no longer listed can never be handed to the RFQ Hub.
    const observer=new MutationObserver(read);
    observer.observe(document.body,{childList:true,subtree:true});
    read();
    return ()=>{document.removeEventListener("change",read);observer.disconnect();};
  },[]);
  if(!selected.length)return null;
  const tooMany=selected.length>NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS;
  const send=()=>{
    // The DOM is the source of truth at submit time, not the last state snapshot.
    const visible=checkedSuppliers();
    setSelected(visible);
    if(!visible.length)return;
    const value=serializeNetworkRfqHandoff(visible,specSummary);
    if(!value){setIssue("Selezione non valida: massimo "+NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS+" aziende.");return;}
    try{
      window.sessionStorage.setItem(networkRfqHandoffKey(userId,organizationId),value);
    }catch{
      setIssue("Il browser non consente di passare la selezione. Aggiungi i fornitori dall'RFQ Hub.");
      return;
    }
    router.push(NETWORK_RFQ_RECEIVER_PATH);
  };
  return <form id="network-rfq-selection" onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();send();}}
    className="sticky bottom-3 z-20 mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-2 rounded-xl border border-[#b8d2c8] bg-white px-4 py-3 shadow-lg"
    data-testid="network-rfq-selection-bar" aria-live="polite">
    <p className="text-sm font-semibold text-[#173f35]">
      {selected.length} {selected.length===1?"azienda selezionata":"aziende selezionate"}
      {tooMany?<span className="ml-2 text-xs font-normal text-[#875117]">· massimo {NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS}</span>:null}
    </p>
    <div className="flex items-center gap-2">
      <button type="submit" disabled={tooMany}
        className="ui-action ui-action-primary inline-flex min-h-10 items-center rounded-lg px-4 text-xs font-semibold disabled:opacity-50">
        Prepara RFQ con i selezionati →
      </button>
    </div>
    <p className="w-full text-[11px] text-[#52615b]">La selezione vale per i risultati mostrati. Nell&apos;RFQ Hub rivedi fornitori e distinta prima dell&apos;invio. Nessuna richiesta parte automaticamente.</p>
    {issue?<p role="alert" className="w-full text-[11px] text-[#875117]">{issue}</p>:null}
  </form>;
}
