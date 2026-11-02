/** NET-AUDIT1.3 — Network → RFQ Hub supplier selection handoff (contract v1).
 *
 * PROPOSAL shared with lane B (GPT, Commerciale/RFQ Hub). Network writes, RFQ
 * Hub reads. Same safety model as the NETUX6D reviewed distinta handoff:
 *   - same tab only (sessionStorage), scoped to organization + user;
 *   - expires after 15 minutes; the receiver deletes it once used or dismissed
 *     (kept meanwhile so the buyer can create a distinta and come back);
 *   - carries only Network company IDs (UUID) and an optional spec summary:
 *     no names, contacts, prices or free text that could be trusted blindly;
 *   - at most 20 suppliers, only companies the readiness RPC reported as
 *     "available" or "connected" when selected;
 *   - the receiver MUST revalidate every ID server-side (RLS, entitlement,
 *     readiness) and show the list for explicit confirmation: nothing is
 *     created or sent automatically.
 * NET-AUDIT1.3b: the RFQ Hub receiver exists (owned by lane A by founder
 * decision 2026-11-02), so selection is ON by default.
 * NEXT_PUBLIC_NETAUDIT1_RFQ_SELECTION="false" remains an emergency switch.
 */
const PREFIX="smart-steel-sales:netaudit1:rfq-suppliers:";
export const NETWORK_RFQ_HANDOFF_MAX_AGE_MS=15*60*1000;
export const NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS=20;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NetworkRfqSupplierHandoff={
  version:1;createdAt:number;source:"network";
  companyIds:string[];
  /** Human summary of the spec search that produced the list, e.g. "EN 10219 · S355". */
  specSummary?:string;
};

export function networkRfqHandoffKey(userId:string,organizationId:string):string{
  if(!UUID.test(userId)||!UUID.test(organizationId))throw new Error("network_rfq_handoff_identity_missing");
  return PREFIX+organizationId+":"+userId;
}

export function serializeNetworkRfqHandoff(
  companyIds:string[],specSummary?:string,now=Date.now(),
):string|null{
  const ids=[...new Set(companyIds)];
  if(!ids.length||ids.length>NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS||ids.some(id=>!UUID.test(id))||!Number.isFinite(now))return null;
  const summary=typeof specSummary==="string"?specSummary.replace(/[\u0000-\u001f<>]/g,"").trim().slice(0,160):"";
  const value:NetworkRfqSupplierHandoff={version:1,createdAt:now,source:"network",companyIds:ids,
    ...(summary?{specSummary:summary}:{})};
  return JSON.stringify(value);
}

export function parseNetworkRfqHandoff(raw:string|null,now=Date.now()):NetworkRfqSupplierHandoff|null{
  if(!raw||raw.length>4000)return null;
  try{
    const data=JSON.parse(raw) as Record<string,unknown>;
    if(!data||typeof data!=="object"||Array.isArray(data))return null;
    const allowed=new Set(["version","createdAt","source","companyIds","specSummary"]);
    if(Object.keys(data).some(key=>!allowed.has(key)))return null;
    if(data.version!==1||data.source!=="network"||typeof data.createdAt!=="number"||!Number.isFinite(data.createdAt)
       ||data.createdAt>now+60_000||now-data.createdAt>NETWORK_RFQ_HANDOFF_MAX_AGE_MS)return null;
    const ids=data.companyIds;
    if(!Array.isArray(ids)||!ids.length||ids.length>NETWORK_RFQ_HANDOFF_MAX_SUPPLIERS
       ||ids.some(id=>typeof id!=="string"||!UUID.test(id))||new Set(ids).size!==ids.length)return null;
    if(data.specSummary!==undefined&&(typeof data.specSummary!=="string"||data.specSummary.length>160))return null;
    return {version:1,createdAt:data.createdAt,source:"network",companyIds:ids as string[],
      ...(typeof data.specSummary==="string"?{specSummary:data.specSummary}:{})};
  }catch{
    return null;
  }
}

/** Only these readiness states can be selected for an RFQ. */
export function isRfqSelectable(status:string|undefined):boolean{
  return status==="available"||status==="connected";
}

export const NETWORK_RFQ_RECEIVER_PATH="/rfq-hub?from=network#network-suppliers";
export function networkRfqSelectionEnabled():boolean{
  return process.env.NEXT_PUBLIC_NETAUDIT1_RFQ_SELECTION!=="false";
}
