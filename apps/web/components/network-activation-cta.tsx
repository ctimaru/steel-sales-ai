"use client";

import Link from "next/link";
import { actionClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/product-analytics-events.client";

export type NetworkActivationMode = "published" | "discovered";

export function networkActivationHref(
  mode: NetworkActivationMode,companyId:string,companyName:string,canReconcile=false,
):string {
  if(mode==="published") return "/network/"+encodeURIComponent(companyId)+"/claim";
  if(canReconcile)return "/network/"+encodeURIComponent(companyId)+"/reconcile";
  const name=companyName.trim().slice(0,120);
  // A provisional discovery ID is intentionally NOT passed as a claim_ref.
  // Registration verifies the legal identity and may create an application.
  return "/register"+(name?"?company="+encodeURIComponent(name):"")+"#company-check";
}

/** Explicit commercial activation funnel: no one-click identity assignment. */
export function NetworkActivationCta({
 mode,companyId,companyName,source="network_profile",compact=false,canReconcile=false,
}:{
 mode:NetworkActivationMode;companyId:string;companyName:string;
 source?:"network_profile"|"network_free_results"|"network_pro_results"|"network_discoveries";
 compact?:boolean;canReconcile?:boolean;
}) {
 const published=mode==="published";
 const href=networkActivationHref(mode,companyId,companyName,canReconcile);
 return <Link href={href}
   onClick={()=>trackProductEvent(
     published||canReconcile?"company_claim_start":"network_activation_registration_click",
     {source,profile_state:mode}
   )}
   className={cn(actionClasses({ variant: compact ? "soft" : "default", size: compact ? "sm" : "md" }), compact ? "min-h-10" : "min-h-11")}>
   {published?"Rivendica il profilo":"Rivendica azienda"}
 </Link>;
}

/** Keeps a provisional source separate from a claimable published identity. */
export function NetworkActivationHelp({mode,canReconcile=false}:{mode:NetworkActivationMode;canReconcile?:boolean}){
 return <p className="text-xs leading-5 text-[#5c7165]">
  {canReconcile ? "Richiedi il collegamento tra questa scheda da fonti pubbliche e la tua azienda registrata. Revisione e claim canonico sono obbligatori: nessun controllo è assegnato automaticamente." : mode==="published"
    ?"La richiesta verifica che rappresenti legalmente l’azienda. Il profilo sarà gestibile solo dopo l’approvazione, senza diventare automaticamente verificato."
    :"Per iniziare registri la tua impresa. Il controllo della rappresentanza e il collegamento con questa scheda precedono qualsiasi modifica: nessuna assegnazione è automatica. Norme, dimensioni e capacità dichiarate saranno verificate separatamente."}
 </p>;
}
