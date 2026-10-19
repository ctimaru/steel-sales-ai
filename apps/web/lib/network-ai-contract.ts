import {
  interpretNetworkIntent,networkIntentHref,
  type NetworkIntentFilters,type NetworkIntentTaxonomy,type NetworkIntentResult,
} from "@/lib/network-intent-parser";

/** Model must emit candidates, NEVER evidence or search results. Only the
 * trusted source taxonomy and the server's Network reader decide matches.
 */
export const NETWORK_AI_FORMAT={
  type:"json_schema",json_schema:{
    name:"network_intent_c6",strict:true,schema:{
      type:"object",additionalProperties:false,
      properties:{
        intent:{type:"string",enum:["browse","count","rfq","clarify"]},
        role:{type:"string"},region:{type:"string"},country:{type:"string"},
        product:{type:"string"},capability:{type:"string"},market:{type:"string"},
        uncertain:{type:"boolean"},
        unhandled:{type:"array",items:{type:"string"}},
      },
      required:["intent","role","region","country","product","capability","market","uncertain","unhandled"],
    },
  },
} as const;
const ROLES=new Set(["producer","trader_distributor","processor_service_provider","end_user"]);
const COUNTRIES=new Set(["IT","DE","FR","ES","US","GB","CH"]);
const REGIONS=[
  "Abruzzo","Basilicata","Calabria","Campania","Emilia-Romagna",
  "Friuli-Venezia Giulia","Lazio","Liguria","Lombardia","Marche","Molise",
  "Piemonte","Puglia","Sardegna","Sicilia","Toscana","Trentino-Alto Adige",
  "Umbria","Valle d'Aosta","Veneto",
];
export type NetworkAiValidated={intent:"browse"|"count";filters:NetworkIntentFilters;chips:string[];technicalOnly:boolean;href:string};
type Candidate={intent:string;role:string;region:string;country:string;product:string;capability:string;market:string;uncertain:boolean;unhandled:string[]};
const own=(v:object,key:string)=>Object.prototype.hasOwnProperty.call(v,key);
const has=(set:Set<string>,value:string)=>set.has(value);
const norm=(s:string)=>s.trim().toLocaleLowerCase("it-IT");

/** Reject invented keys, contradictory geography, partial/malformed schemas,
 * conflicts with recognized explicit criteria, unsupported user conditions.
 */
export function validateNetworkAIOutput(
  output:unknown,query:string,taxonomy:NetworkIntentTaxonomy,
):NetworkAiValidated|null{
  if(!output||typeof output!=="object"||Array.isArray(output))return null;
  if(hasUnmappableConditions(query))return null;
  const allowed=new Set(["intent","role","region","country","product","capability","market","uncertain","unhandled"]);
  if(Object.keys(output).some(key=>!allowed.has(key)))return null;
  const x=output as Partial<Candidate>;
  for(const key of ["intent","role","region","country","product","capability","market","uncertain","unhandled"]){
    if(!own(x,key))return null;
  }
  if(x.intent!=="browse"&&x.intent!=="count")return null;
  if(x.uncertain!==false||!Array.isArray(x.unhandled)||x.unhandled.length>0)return null;
  for(const key of ["role","region","country","product","capability","market"] as const){
    if(typeof x[key]!=="string"||x[key]!.length>100)return null;
  }
  const filters:NetworkIntentFilters={};
  if(x.role){if(!has(ROLES,x.role))return null;filters.role=x.role;}
  if(x.country){if(!has(COUNTRIES,x.country))return null;filters.country=x.country;}
  if(x.region){
    const regions=taxonomy.regions?.length?taxonomy.regions:REGIONS;
    const name=regions.find(r=>norm(r)===norm(x.region!));
    if(!name||filters.country&&filters.country!=="IT")return null;
    filters.region=name;filters.country="IT";
  }
  for(const kind of ["product","capability","market"] as const){
    const candidates=taxonomy[kind==="product"?"products":kind==="capability"?"capabilities":"markets"]||[];
    if(x[kind]){
      if(!candidates.some(c=>c.canonical_key===x[kind]))return null;
      filters[kind]=x[kind];
    }
  }
  if(!Object.keys(filters).length)return null;
  const rule=interpretNetworkIntent(query,taxonomy);
  // Never let a model replace or contradict something our trusted parser
  // explicitly recognized, even for an otherwise unsupported query.
  for(const key of ["role","region","country","product","capability","market"] as const){
    if(rule.filters[key]&&rule.filters[key]!==filters[key])return null;
  }
  if(rule.intent==="count"&&x.intent!=="count")return null;
  const technicalOnly=Boolean(filters.product||filters.capability||filters.market||
    (filters.country&&filters.country!=="IT"));
  const chips=Object.entries(filters).map(([key,value])=>{
    const matches=taxonomy[key==="product"?"products":key==="capability"?"capabilities":"markets"];
    const label=Array.isArray(matches)?matches.find(item=>item.canonical_key===value)?.display_name:value;
    return key==="role"?"Ruolo: "+value:key==="country"?"Paese: "+value:
      key==="region"?"Regione: "+value:key==="product"?"Prodotto: "+label:
      key==="capability"?"Capacità: "+label:"Mercato: "+label;
  });
  const intent=x.intent;
  const href=networkIntentHref({status:"ready",intent,filters,chips,unsupported:[],technicalOnly});
  if(!href)return null;
  return {intent,filters,chips,technicalOnly,href};
}
/** Hard, non-representable conditions must not silently disappear even if a
 * model claims to have handled every condition.
 */
export function hasUnmappableConditions(text:string):boolean{
  return /\b(?:EN\s*\d{4,5}|ISO\s*\d{3,5}|ASTM\s*[A-Z]?\d+|[SPL]\d{3}[A-Z0-9]*|\d+(?:[.,]\d+)?\s*(?:mm|cm|meters?|metri|meter|km)|consegna|delivery|deliver|tomorrow|domani|prezzo|prezzi|price|certificat\w*|certificate|certification|radius|raggio|distance|distanza|entro\s+\d+|within\s+\d+)\b/i.test(text);
}
export function looksLikeRfqRequest(text:string):boolean{
  const quantity=/\b\d{1,6}\s*(?:tubi|tubo|tubes|pipes|pezzi|pieces|pz|pcs)\b/i.test(text);
  const length=/\b\d+(?:[.,]\d+)?\s*(?:metri|meter|meters|m|mm)\b/i.test(text);
  const standard=/\bEN\s*10\d{3}(?:-\d+)?\b/i.test(text);
  const grade=/\b(?:S|P|L)\d{3}[A-Z0-9]*\b/i.test(text);
  const dimensions=/\b\d{2,5}\s*[x×]\s*\d{1,5}(?:\s*[x×]\s*\d{1,5})?\b/i.test(text);
  return (quantity&&(length||standard||grade||dimensions))||(standard&&dimensions);
}
export function acceptedFollowup(text:string):boolean{
  return /^(?:e\s+|invece\b|solo\s+|what about\b|and\s+|et\s+|y\s+|und\s+)/i.test(text.trim());
}
export function mergeNetworkFollowup(
  result:NetworkAiValidated,previous:NetworkIntentFilters|undefined,
  query:string,taxonomy:NetworkIntentTaxonomy,
):NetworkAiValidated{
  if(!previous||!acceptedFollowup(query))return result;
  const proposed={...previous,...result.filters};
  // When changing country, never retain an obsolete Italian region.
  if(result.filters.country&&result.filters.country!=="IT")delete proposed.region;
  if(result.filters.region)proposed.country="IT";
  const safe:NetworkIntentFilters={};
  if(proposed.role&&ROLES.has(proposed.role))safe.role=proposed.role;
  const c=proposed.country;
  if(c&&COUNTRIES.has(c))safe.country=c;
  const regs=taxonomy.regions?.length?taxonomy.regions:REGIONS;
  if(proposed.region&&regs.includes(proposed.region)&&(!safe.country||safe.country==="IT")){
    safe.region=proposed.region;safe.country="IT";
  }
  for(const kind of ["product","capability","market"] as const){
    const items=taxonomy[kind==="product"?"products":kind==="capability"?"capabilities":"markets"]||[];
    if(proposed[kind]&&items.some(t=>t.canonical_key===proposed[kind]))safe[kind]=proposed[kind];
  }
  const technicalOnly=Boolean(safe.product||safe.capability||safe.market||(safe.country&&safe.country!=="IT"));
  const href=networkIntentHref({status:"ready",intent:result.intent,filters:safe,chips:result.chips,unsupported:[],technicalOnly});
  return href?{...result,filters:safe,technicalOnly,href}:result;
}
