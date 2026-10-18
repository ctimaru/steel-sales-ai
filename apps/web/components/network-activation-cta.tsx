"use client";

import Link from "next/link";
import { actionClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackProductEvent } from "@/lib/product-analytics-events.client";

export type NetworkActivationMode = "published" | "discovered";

export function networkActivationHref(
  mode: NetworkActivationMode,companyId:string,companyName:string,
):string {
  if(mode==="published") return "/network/"+encodeURIComponent(companyId)+"/claim";
  const name=companyName.trim().slice(0,120);
  // A provisional discovery ID is intentionally NOT passed as a claim_ref.
  // Registration verifies the legal identity and may create an application.
  return "/register"+(name?"?company="+encodeURIComponent(name):"")+"#company-check";
}

/** Explicit commercial activation funnel: no one-click identity assignment. */
export function NetworkActivationCta({
 mode,companyId,companyName,source="network_profile",compact=false,
}:{
 mode:NetworkActivationMode;companyId:string;companyName:string;
 source?:"network_profile"|"network_free_results"|"network_pro_results"|"network_discoveries";
 compact?:boolean;
}) {
 const published=mode==="published";
 const href=networkActivationHref(mode,companyId,companyName);
 return <Link href={href}
   onClick={()=>trackProductEvent(
     published?"company_claim_start":"network_activation_registration_click",
     {source,profile_state:mode}
   )}
   className={cn(actionClasses({ variant: compact ? "soft" : "default", size: compact ? "sm" : "md" }), compact ? "min-h-10" : "min-h-11")}>
   {published?"Rivendica il profilo":"Registra la tua azienda"}
 </Link>;
}

/** Keeps a provisional source separate from a claimable published identity. */
export function NetworkActivationHelp({mode}:{mode:NetworkActivationMode}){
 return <p className="text-xs leading-5 text-[#5c7165]">
  {mode==="published"
    ?"La richiesta verifica che rappresenti legalmente l’azienda. Il profilo sarà gestibile solo dopo l’approvazione, senza diventare automaticamente verificato."
    :"Questa scheda è ancora da confermare. La registrazione verifica ragione sociale e dati aziendali: non assegna automaticamente questa scheda e non invia connessioni."}
 </p>;
}
