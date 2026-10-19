/** NET-UX COMPACT6A: bounded, explainable Italian intent parsing.
 * This is NOT an LLM. Unknown constraints are never silently discarded,
 * and no company result, count or capability is invented here.
 */
export type NetworkIntentFilters={
  role?:string;region?:string;country?:string;product?:string;
};
export type NetworkIntentResult={
  status:"ready"|"unsupported"|"empty";
  intent:"browse"|"count";
  filters:NetworkIntentFilters;
  chips:string[];
  unsupported:string[];
  technicalOnly:boolean;
};
export type NetworkIntentProduct={canonical_key:string;display_name:string};

const REGIONS=[
  "Abruzzo","Basilicata","Calabria","Campania","Emilia-Romagna",
  "Friuli-Venezia Giulia","Lazio","Liguria","Lombardia","Marche",
  "Molise","Piemonte","Puglia","Sardegna","Sicilia","Toscana",
  "Trentino-Alto Adige","Umbria","Valle d'Aosta","Veneto",
];
const ROLES=[
  {key:"trader_distributor",label:"Commercianti",terms:["commercianti","commerciante","distributori","distributore","grossisti","rivenditori"]},
  {key:"producer",label:"Produttori",terms:["produttori","produttore","fabbricanti","fabbricante"]},
  {key:"processor_service_provider",label:"Terzisti",terms:["terzisti","terzista","lavorazioni conto terzi"]},
  {key:"end_user",label:"Utilizzatori",terms:["utilizzatori","utilizzatore","aziende utilizzatrici"]},
];
const COUNTRIES=[
  {key:"IT",label:"Italia",terms:["italia","italiano","italiana"]},
  {key:"DE",label:"Germania",terms:["germania","tedeschi"]},
  {key:"FR",label:"Francia",terms:["francia"]},
  {key:"ES",label:"Spagna",terms:["spagna"]},
  {key:"US",label:"Stati Uniti",terms:["stati uniti","usa"]},
  {key:"GB",label:"Regno Unito",terms:["regno unito","gran bretagna"]},
  {key:"CH",label:"Svizzera",terms:["svizzera"]},
];
const TUBE_TERMS=["tubi","tubo","tubazioni","tubazione","tubolari"];
const FILLER=new Set([
  "cerco","cerca","cercami","cercando","sto","trova","trovami","trovare",
  "mostra","mostrami","elenca","elencami","dimmi","vorrei","voglio",
  "quanti","quante","quanto","numero","ci","sono","esistono","presenti",
  "aziende","azienda","imprese","impresa","operatori","operatori",
  "di","dei","degli","delle","del","della","da","a","ad","e","ed","o",
  "in","nel","nella","nei","nelle","sul","sulla","per","che","con",
  "i","gli","le","un","una","il","la","lo","queste","questi",
  "network","steel","vendono","vende","commercializzano","offrono",
]);

function normalize(value:string):string{
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("it-IT").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function removePhrase(text:string,term:string):{remainder:string;found:boolean}{
  const padded=" "+text+" ";
  const needle=" "+normalize(term)+" ";
  const found=padded.includes(needle);
  if(!found)return {remainder:text,found:false};
  // Remove all exact token-sequence occurrences, preserving other terms.
  return {remainder:padded.split(needle).join(" ").trim().replace(/\s+/g," "),found:true};
}
function collect<T extends {key:string;label:string;terms:string[]}>(
  text:string, options:T[],
):{matches:T[];remainder:string}{
  let remainder=text;
  const matches:T[]=[];
  for(const option of options){
    let seen=false;
    for(const term of [...option.terms].sort((a,b)=>b.length-a.length)){
      const removed=removePhrase(remainder,term);
      if(removed.found){seen=true;remainder=removed.remainder;}
    }
    if(seen)matches.push(option);
  }
  return {matches,remainder};
}

export function interpretNetworkIntent(
  raw:string,
  {regions=[],products=[]}:{regions?:string[];products?:NetworkIntentProduct[]}={},
):NetworkIntentResult{
  const text=normalize(raw.slice(0,240));
  const empty:NetworkIntentResult={status:"empty",intent:"browse",filters:{},chips:[],unsupported:[],technicalOnly:false};
  if(!text)return empty;
  const intent=/\b(quanti|quante|numero)\b/.test(text)?"count":"browse";
  const roles=collect(text,ROLES);
  const countries=collect(roles.remainder,COUNTRIES);
  const availableRegions=regions.length?regions:REGIONS;
  const regionEntries=availableRegions.map(name=>({key:name,label:name,terms:[name]}))
    .sort((a,b)=>b.key.length-a.key.length);
  const regional=collect(countries.remainder,regionEntries);
  let remaining=regional.remainder;
  let tubeMentioned=false;
  for(const term of TUBE_TERMS){
    const out=removePhrase(remaining,term);
    if(out.found){tubeMentioned=true;remaining=out.remainder;}
  }
  const unsupported=remaining.split(" ").filter(word=>word&&!FILLER.has(word));
  const filters:NetworkIntentFilters={};
  const chips:string[]=[];
  if(roles.matches.length===1){
    filters.role=roles.matches[0].key;
    chips.push(roles.matches[0].label);
  }else if(roles.matches.length>1){
    unsupported.push("più ruoli");
  }
  if(countries.matches.length===1){
    filters.country=countries.matches[0].key;
    chips.push(countries.matches[0].label);
  }else if(countries.matches.length>1){
    unsupported.push("più paesi");
  }
  if(regional.matches.length===1){
    if(filters.country&&filters.country!=="IT")unsupported.push("regione italiana con paese estero");
    else {
      filters.region=regional.matches[0].key;
      filters.country="IT";
      chips.push(regional.matches[0].label);
    }
  }else if(regional.matches.length>1){
    unsupported.push("più regioni");
  }
  if(tubeMentioned){
    if(products.some(product=>product.canonical_key==="tubes_pipes")){
      filters.product="tubes_pipes";
      chips.push("Tubi (prodotti dichiarati)");
    }else unsupported.push("tubi: filtro tecnico non disponibile");
  }
  const hasFilters=Boolean(filters.role||filters.region||filters.country||filters.product);
  return {
    status:unsupported.length||!hasFilters?"unsupported":"ready",
    intent,filters,chips,unsupported:unsupported.slice(0,8),
    technicalOnly:Boolean(filters.product||(filters.country&&filters.country!=="IT")),
  };
}
export function networkIntentHref(intent:NetworkIntentResult):string|null{
  if(intent.status!=="ready")return null;
  const query=new URLSearchParams();
  for(const key of ["role","region","country","product"] as const){
    if(intent.filters[key])query.set(key,intent.filters[key]);
  }
  return "/network?"+query.toString()+"#network-results";
}
