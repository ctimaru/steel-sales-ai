import "server-only";

import {createClient} from "@/lib/supabase/server";
import {NETWORK_PRO_MODULES,type NetworkProModuleKey} from "@/lib/network-pro-catalog";
import {isSupportedNetworkCountry} from "@/lib/network-eu-countries";

export type NetworkProModuleCounts=Record<NetworkProModuleKey,number>;
export type NetworkProCountryCoverage={
  countryCode:string;
  published:number;
  classified:number;
  unclassified:number;
  provisional:number;
  publishedModules:NetworkProModuleCounts;
  provisionalModules:NetworkProModuleCounts;
};
export type NetworkProCoverage={
  contract:"netpro1b-coverage-v1";
  asOf:string;
  countries:NetworkProCountryCoverage[];
};
export type NetworkProAccess={
  contract:"netpro1b-access-v1";
  legacyFullNetwork:boolean;
  modules:Record<NetworkProModuleKey,{italy:boolean;europe:boolean}>;
};
export type NetworkProDirectory={
  contract:"netpro1b-scoped-directory-v1";
  module:NetworkProModuleKey;
  country:string;
  total:number;
  page:number;
  limit:number;
  items:{id:string;name:string;countryCode:string;websiteUrl:string|null}[];
};
export type NetworkProDirectoryResult=
  |{status:"ready";data:NetworkProDirectory}
  |{status:"locked"|"unavailable";data:null};

const modules=NETWORK_PRO_MODULES.map(module=>module.key);
const known=new Set<string>(modules);
const counts=(value:unknown):NetworkProModuleCounts|null=>{
  if(!value||typeof value!=="object")return null;
  const v=value as Record<string,unknown>;
  const result={} as NetworkProModuleCounts;
  for(const key of modules){
    if(typeof v[key]!=="number"||!Number.isSafeInteger(v[key])||(v[key] as number)<0)return null;
    result[key]=v[key] as number;
  }
  return result;
};
const number=(x:unknown):x is number=>typeof x==="number"&&Number.isSafeInteger(x)&&x>=0;
const record=(x:unknown):Record<string,unknown>|null=>
  x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;
const isEuropean=(country:string)=>country!=="US"&&isSupportedNetworkCountry(country);

export function parseNetworkProCoverage(payload:unknown):NetworkProCoverage|null {
  const data=record(payload);
  if(data?.contract!=="netpro1b-coverage-v1"||!Array.isArray(data.countries)||
     typeof data.as_of!=="string"||!Number.isFinite(Date.parse(data.as_of)))return null;
  const seen=new Set<string>();
  const result:NetworkProCountryCoverage[]=[];
  for(const item of data.countries){
    const row=record(item);
    if(!row||typeof row.country_code!=="string")return null;
    const countryCode=row.country_code.toUpperCase();
    if(!isEuropean(countryCode)||seen.has(countryCode))return null;
    seen.add(countryCode);
    const {published,classified,unclassified,provisional}=row;
    const publishedModules=counts(row.published_modules);
    const provisionalModules=counts(row.provisional_modules);
    if(!number(published)||!number(classified)||!number(unclassified)||
       !number(provisional)||classified+unclassified!==published||
       !publishedModules||!provisionalModules)return null;
    if(modules.some(key=>publishedModules[key]>published||
                         provisionalModules[key]>provisional))return null;
    result.push({countryCode,published,classified,unclassified,provisional,
      publishedModules,provisionalModules});
  }
  return {contract:"netpro1b-coverage-v1",asOf:data.as_of,countries:result};
}

export function parseNetworkProAccess(payload:unknown):NetworkProAccess|null {
  const obj=record(payload);
  if(obj?.contract!=="netpro1b-access-v1"||typeof obj.legacy_full_network!=="boolean"||
     !Array.isArray(obj.modules))return null;
  const map={} as NetworkProAccess["modules"];
  const seen=new Set<string>();
  for(const item of obj.modules){
    const row=record(item);
    if(!row||typeof row.module!=="string"||!known.has(row.module)||
       seen.has(row.module)||typeof row.italy!=="boolean"||
       typeof row.europe!=="boolean")return null;
    const key=row.module as NetworkProModuleKey;
    map[key]={italy:row.italy,europe:row.europe};
    seen.add(key);
  }
  return seen.size===modules.length
    ?{contract:"netpro1b-access-v1",legacyFullNetwork:obj.legacy_full_network,modules:map}
    :null;
}

export function parseNetworkProDirectory(payload:unknown):NetworkProDirectory|null {
  const obj=record(payload);
  if(obj?.contract!=="netpro1b-scoped-directory-v1"||
     typeof obj.module!=="string"||!known.has(obj.module)||
     typeof obj.country!=="string"||!isEuropean(obj.country)||
     !number(obj.total)||!number(obj.page)||obj.page<1||
     !number(obj.limit)||obj.limit<1||obj.limit>24||
     !Array.isArray(obj.items)||obj.items.length>obj.limit)return null;
  const items:NetworkProDirectory["items"]=[];
  for(const item of obj.items){
    const row=record(item);
    if(!row||typeof row.id!=="string"||typeof row.name!=="string"||
      row.name.length>600||row.country_code!==obj.country||
      (row.website_url!==null&&typeof row.website_url!=="string"))return null;
    items.push({id:row.id,name:row.name,countryCode:row.country_code as string,
      websiteUrl:row.website_url as string|null});
  }
  return {contract:"netpro1b-scoped-directory-v1",module:obj.module as NetworkProModuleKey,
    country:obj.country,total:obj.total,page:obj.page,limit:obj.limit,items};
}

/** Calls execute under the viewer's real tenant token; service keys forbidden. */
export async function getNetworkProCoverage(organizationId:string):Promise<NetworkProCoverage|null>{
  try {
    const db=await createClient();
    const {data,error}=await db.rpc("netpro1b_catalog_coverage",{p_organization_id:organizationId});
    if(error)return null;
    return parseNetworkProCoverage(data);
  }catch{return null;}
}
export async function getNetworkProAccess(organizationId:string):Promise<NetworkProAccess|null>{
  try {
    const db=await createClient();
    const {data,error}=await db.rpc("netpro1b_access_state",{p_organization_id:organizationId});
    if(error)return null;
    return parseNetworkProAccess(data);
  }catch{return null;}
}

export async function getNetworkProScopedDirectory(args:{
  organizationId:string;module:NetworkProModuleKey;country:string;q?:string;page?:number;
}):Promise<NetworkProDirectoryResult>{
  if(!known.has(args.module)||!isEuropean(args.country)||
     (args.q?.length??0)>120)return {status:"locked",data:null};
  try{
    const db=await createClient();
    const {data,error}=await db.rpc("netpro1b_scoped_directory",{
      p_organization_id:args.organizationId,
      p_module:args.module,
      p_country:args.country,
      p_query:args.q?.trim().slice(0,120)||null,
      p_page:args.page??1,
      p_limit:18,
    });
    if(error)return {status:error.code==="42501"?"locked":"unavailable",data:null};
    const parsed=parseNetworkProDirectory(data);
    if(!parsed||parsed.module!==args.module||parsed.country!==args.country)
      return {status:"unavailable",data:null};
    return {status:"ready",data:parsed};
  }catch{return {status:"unavailable",data:null};}
}
