import {recommendedNetworkRoles,type NetworkCompanyRole} from "@/lib/network-experience";
import {networkRoleLabels} from "@/lib/network-role-discovery";

type Role={key:string};
/** Transparent, local-to-page presentation only; not lead scoring or industrial qualification. */
export function explainPublishedRelevance(roles:readonly Role[],persona:NetworkCompanyRole|null,sharedProducts:readonly string[]){
 const priority=recommendedNetworkRoles(persona);
 const match=persona?priority.slice(0,3).find(role=>roles.some(r=>r.key===role)):null;
 const roleIndex=match?priority.indexOf(match):-1;
 const roleEvidence=match?networkRoleLabels[match]+" · categoria rilevante per la vista":null;
 const productEvidence=sharedProducts.length
  ?"Famiglie prodotto presenti in entrambi i profili: "+sharedProducts.slice(0,2).join(", "):null;
 return {
  relevanceRank:(roleIndex>=0?3-roleIndex:0)*10+Math.min(sharedProducts.length,2),
  reasons:[roleEvidence,productEvidence].filter((x):x is string=>Boolean(x)),
 };
}
