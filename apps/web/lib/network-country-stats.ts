import "server-only";

import {createClient} from "@/lib/supabase/server";
import {isSupportedNetworkCountry} from "@/lib/network-eu-countries";

/** NET-UX-MAP1: one server-side RPC, one clear denominator per country.
 * Includes published canonical companies plus eligible Italian provisional
 * records already browseable in Network. No private research candidates.
 */
export type NetworkCountryStats={
  countryCode:string;
  total:number;published:number;sourced:number;
  producer:number;trader:number;processor:number;endUser:number;other:number;
};

const count=(value:unknown):number|null=>
  typeof value==="number" && Number.isSafeInteger(value) && value>=0?value:null;

export function parseNetworkCountryStats(payload:unknown):NetworkCountryStats[]{
  if(!payload || typeof payload!=="object")return [];
  const obj=payload as {contract?:unknown;countries?:unknown};
  if(obj.contract!=="netux-map1-country-stats-v1" || !Array.isArray(obj.countries))return [];
  const seen=new Set<string>();
  const result:NetworkCountryStats[]=[];
  for(const row of obj.countries){
    if(!row || typeof row!=="object")continue;
    const data=row as Record<string,unknown>;
    const countryCode=typeof data.country_code==="string"?data.country_code.toUpperCase():"";
    if(!isSupportedNetworkCountry(countryCode)||seen.has(countryCode))continue;
    const total=count(data.total),published=count(data.published),sourced=count(data.sourced);
    const producer=count(data.producer),trader=count(data.trader),processor=count(data.processor);
    const endUser=count(data.end_user),other=count(data.other);
    if([total,published,sourced,producer,trader,processor,endUser,other].some(n=>n===null))continue;
    if(total===0 || published!+sourced! !==total ||
       producer!+trader!+processor!+endUser!+other! !==total)continue;
    seen.add(countryCode);
    result.push({countryCode,total:total!,published:published!,sourced:sourced!,
      producer:producer!,trader:trader!,processor:processor!,endUser:endUser!,other:other!});
  }
  return result.sort((a,b)=>b.total-a.total || a.countryCode.localeCompare(b.countryCode));
}

export async function getNetworkCountryStats(
  organizationId:string,accessMode:"free"|"pro",
):Promise<NetworkCountryStats[]>{
  try{
    const supabase=await createClient();
    const {data,error}=await supabase.rpc("netux_map1_country_stats",{
      p_organization_id:organizationId,p_access:accessMode,
    });
    if(error)return [];
    return parseNetworkCountryStats(data);
  }catch{
    return [];
  }
}
