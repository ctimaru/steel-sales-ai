import {calculateBuyerDistintaLine,type BuyerDistintaDraftLine} from "@/lib/buyer-distinta";

/** User+tenant scoped, same-tab, 15-minute *reviewed* Network -> Commercial
 * bridge. No URL text, server persistence, auto-save, dispatch or contact data.
 * Existing Commerciale importer and RFQ server actions revalidate the rows.
 */
const PREFIX="smart-steel-sales:netux6d:reviewed-rfq:";
const MAX_AGE_MS=15*60*1000;
const MAX_BYTES=40_000;
const MAX_LINES=30;
export type NetworkReviewedHandoff={version:1;createdAt:number;lines:BuyerDistintaDraftLine[]};

export function networkReviewedHandoffKey(userId:string,organizationId:string):string{
  if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^[0-9a-f-]{36}$/i.test(organizationId))
    throw new Error("network_handoff_identity_missing");
  return PREFIX+organizationId+":"+userId;
}
function validLine(item:unknown):item is BuyerDistintaDraftLine{
  if(!item||typeof item!=="object"||Array.isArray(item))return false;
  const row=item as Record<string,unknown>;
  const allowed=["id","description","standard","grade","finish","quantityMode","quantity",
    "barLengthM","weightKgM","targetEurT","note"];
  if(Object.keys(row).some(k=>!allowed.includes(k)))return false;
  for(const k of ["id","description","standard","grade","finish","quantity","barLengthM",
    "weightKgM","targetEurT","note"]){
    if(typeof row[k]!=="string"||(row[k] as string).length>(k==="note"?1200:500))return false;
  }
  if(!["bars","meters","tonnes"].includes(String(row.quantityMode)))return false;
  if(row.standard!=="EN 10219"&&row.standard!=="EN 10210")return false;
  if(!String(row.grade).trim()||String(row.id).length>96)return false;
  return calculateBuyerDistintaLine(row as BuyerDistintaDraftLine).complete;
}
export function serializeNetworkReviewedHandoff(
  lines:BuyerDistintaDraftLine[],now=Date.now(),
):string|null{
  if(!Array.isArray(lines)||!lines.length||lines.length>MAX_LINES||
     !Number.isFinite(now)||lines.some(l=>!validLine(l)))return null;
  const ids=new Set(lines.map(l=>l.id));
  if(ids.size!==lines.length)return null;
  const value=JSON.stringify({version:1,createdAt:now,lines} satisfies NetworkReviewedHandoff);
  return value.length<=MAX_BYTES?value:null;
}
export function parseNetworkReviewedHandoff(raw:string|null,now=Date.now()):NetworkReviewedHandoff|null{
  if(!raw||raw.length>MAX_BYTES)return null;
  try{
    const x:unknown=JSON.parse(raw);
    if(!x||typeof x!=="object"||Array.isArray(x))return null;
    const data=x as Record<string,unknown>;
    if(data.version!==1||typeof data.createdAt!=="number"||!Number.isFinite(data.createdAt)||
       data.createdAt>now+60_000||now-data.createdAt>MAX_AGE_MS||!Array.isArray(data.lines)||
       !data.lines.length||data.lines.length>MAX_LINES||data.lines.some(l=>!validLine(l)))return null;
    const lines=data.lines as BuyerDistintaDraftLine[];
    if(new Set(lines.map(l=>l.id)).size!==lines.length)return null;
    return {version:1,createdAt:data.createdAt,lines};
  }catch{return null;}
}
