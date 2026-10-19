/** NET-UX COMPACT6B: bounded, explainable multilingual discovery.
 * This is a deterministic parser, not an LLM. Unknown or ambiguous constraints
 * always block navigation; real tenant-authorized reads alone produce results.
 */
export type NetworkIntentFilters={
  role?:string;region?:string;country?:string;
  product?:string;capability?:string;market?:string;
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
export type NetworkIntentTaxonomy={
  regions?:string[];
  products?:NetworkIntentProduct[];
  capabilities?:NetworkIntentProduct[];
  markets?:NetworkIntentProduct[];
};

const REGIONS=[
  "Abruzzo","Basilicata","Calabria","Campania","Emilia-Romagna",
  "Friuli-Venezia Giulia","Lazio","Liguria","Lombardia","Marche",
  "Molise","Piemonte","Puglia","Sardegna","Sicilia","Toscana",
  "Trentino-Alto Adige","Umbria","Valle d'Aosta","Veneto",
];
const REGIONAL_ALIASES:Record<string,string[]>={
  Lombardia:["lombardy","lombardie","lombardei"],
  Piemonte:["piedmont","piemont","piedmontese"],
  Veneto:["venetia","venetien","veneto"],
  Toscana:["tuscany","toscane","toskana"],
  "Emilia-Romagna":["emilia romagna","emilie romagne"],
  Sicilia:["sicily","sicile","sizilien","sicilia"],
  Sardegna:["sardinia","sardaigne","sardinien","cerdena"],
  Puglia:["apulia","pouilles"],
  Lazio:["latium"],
};
const ROLES=[
  {key:"trader_distributor",label:"Commercianti",terms:[
    "commercianti","commerciante","distributori","distributore","grossisti","rivenditori",
    "traders","trader","distributors","distributor","wholesalers","wholesaler",
    "negociants","distributeurs","distributeur","commercants","commercant",
    "comerciantes","comerciante","distribuidores","distribuidor",
    "handler","haendler","händler","grosshandler","grosshaendler","rohrhandler","rohrhaendler","rohrhändler",
  ]},
  {key:"producer",label:"Produttori",terms:[
    "produttori","produttore","fabbricanti","fabbricante","manufacturers","manufacturer",
    "producers","producer","fabricants","fabricant","fabricantes","fabricante",
    "productores","productor","hersteller","produzenten","produzent",
  ]},
  {key:"processor_service_provider",label:"Terzisti",terms:[
    "terzisti","terzista","lavorazioni conto terzi","subcontractors","subcontractor",
    "processors","processor","sous traitants","sous traitant","subcontratistas",
    "subcontratista","lohnfertiger",
  ]},
  {key:"end_user",label:"Utilizzatori",terms:[
    "utilizzatori","utilizzatore","aziende utilizzatrici","end users","end user",
    "industrial users","utilisateurs finaux","utilisateur final","usuarios finales",
    "usuario final","endverbraucher",
  ]},
];
const COUNTRIES=[
  {key:"IT",label:"Italia",terms:["italia","italiano","italiana","italy","italie","italien"]},
  {key:"DE",label:"Germania",terms:["germania","tedeschi","germany","deutschland","allemagne","alemania"]},
  {key:"FR",label:"Francia",terms:["francia","france","frankreich"]},
  {key:"ES",label:"Spagna",terms:["spagna","spain","espana","españa","spanien","espagne"]},
  {key:"US",label:"Stati Uniti",terms:["stati uniti","usa","united states","etats unis","estados unidos"]},
  {key:"GB",label:"Regno Unito",terms:["regno unito","gran bretagna","united kingdom","great britain","royaume uni","reino unido","vereinigtes konigreich"]},
  {key:"CH",label:"Svizzera",terms:["svizzera","switzerland","suisse","suiza","schweiz"]},
];
const TUBE_TERMS=["tubi","tubo","tubazioni","tubazione","tubolari",
  "steel tubes","steel pipes","tubes","tube","pipes","pipe","tuyaux","tuyau",
  "tubos","rohre","rohr"];
const FILLER=new Set([
  "cerco","cerca","cercami","cercando","sto","trova","trovami","trovare",
  "mostra","mostrami","elenca","elencami","dimmi","vorrei","voglio",
  "quanti","quante","quanto","numero","ci","sono","esistono","presenti",
  "aziende","azienda","imprese","impresa","operatori",
  "di","dei","degli","delle","del","della","da","a","ad","e","ed","o",
  "in","nel","nella","nei","nelle","sul","sulla","per","che","con",
  "i","gli","le","un","una","il","la","lo","queste","questi",
  "network","steel","acciaio","vendono","vende","commercializzano","offrono",
  "find","show","list","looking","search","seeking","want","need","are","there",
  "how","many","number","of","the","a","an","and","or","for","with","in","from",
  "companies","company","businesses","business","suppliers","supplier","sector","market","markets",
  "producing","selling","supply","offering","working","who","me",
  "je","cherche","trouve","montre","combien","entreprises","entreprise","societes",
  "de","des","du","en","dans","avec","sur","et","pour","qui","les","aux",
  "busco","buscar","encuentra","muestrame","cuantos","cuantas","empresas",
  "empresa","proveedores","proveedor","en","de","del","con","que","para","las","los",
  "ich","suche","zeige","mir","wie","viele","anzahl","firmen","firma","unternehmen",
  "in","der","den","dem","das","die","mit","und","von","fur","fuer","aus","nach",
  "industrie","industry","industrial","industrieunternehmen",
  "mercato","mercati","settore","settori","capability","capacita","capacidades","capabilities",
]);
function normalize(value:string):string{
  return value.replace(/ß/g,"ss").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("it-IT").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function removePhrase(text:string,term:string):{remainder:string;found:boolean}{
  const padded=" "+text+" ";
  const needle=" "+normalize(term)+" ";
  const found=padded.includes(needle);
  if(!found)return {remainder:text,found:false};
  return {remainder:padded.split(needle).join(" ").trim().replace(/\s+/g," "),found:true};
}
function collect<T extends {key:string;label:string;terms:string[]}>(
  text:string,options:T[],
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
type FacetType="product"|"capability"|"market";
type Facet={type:FacetType;key:string;label:string;term:string};
/** Match *only exact source-taxonomy display names*. Never guess a translation
 * for an arbitrary technical category; collisions or multi-values are blocked.
 */
function extractTaxonomy(text:string,taxonomy:NetworkIntentTaxonomy){
  const candidates:Facet[]=[];
  for(const type of ["product","capability","market"] as const){
    for(const item of taxonomy[type]||[]){
      const term=normalize(item.display_name);
      if(term.length<4||!item.canonical_key)continue;
      if(type==="product"&&item.canonical_key==="tubes_pipes")continue;
      candidates.push({type,key:item.canonical_key,label:item.display_name,term});
    }
  }
  const groups=new Map<string,Facet[]>();
  for(const candidate of candidates){
    const list=groups.get(candidate.term)||[];
    list.push(candidate);
    groups.set(candidate.term,list);
  }
  let remainder=text;
  const matches:Facet[]=[];
  const unsupported:string[]=[];
  for(const [term,group] of [...groups.entries()].sort((a,b)=>b[0].length-a[0].length)){
    const cut=removePhrase(remainder,term);
    if(!cut.found)continue;
    remainder=cut.remainder;
    const distinct=new Set(group.map(item=>item.type+":"+item.key));
    if(distinct.size!==1)unsupported.push("attributo ambiguo: "+group[0].label);
    else matches.push(group[0]);
  }
  return {matches,remainder,unsupported};
}

export function interpretNetworkIntent(
  raw:string,
  {regions=[],products=[],capabilities=[],markets=[]}:NetworkIntentTaxonomy={},
):NetworkIntentResult{
  const text=normalize(raw.slice(0,240));
  const empty:NetworkIntentResult={status:"empty",intent:"browse",filters:{},chips:[],unsupported:[],technicalOnly:false};
  if(!text)return empty;
  const intent=/\b(quanti|quante|numero|combien|cuantos|cuantas|anzahl)\b/.test(text)||
    /\bhow many\b|\bwie viele\b/.test(text)?"count":"browse";
  const roles=collect(text,ROLES);
  const countries=collect(roles.remainder,COUNTRIES);
  const availableRegions=regions.length?regions:REGIONS;
  const regionEntries=availableRegions.map(name=>({
    key:name,label:name,terms:[name,...(REGIONAL_ALIASES[name]||[])],
  })).sort((a,b)=>b.key.length-a.key.length);
  const regional=collect(countries.remainder,regionEntries);
  // Prefer exact longest public taxonomy labels before colloquial tube aliases,
  // so a genuine "stainless steel tubes" product is not truncated to "tubes".
  const taxonomy=extractTaxonomy(regional.remainder,{products,capabilities,markets});
  let remaining=taxonomy.remainder;
  let tubeMentioned=false;
  for(const term of TUBE_TERMS){
    const out=removePhrase(remaining,term);
    if(out.found){tubeMentioned=true;remaining=out.remainder;}
  }
  const unsupported=[...taxonomy.unsupported,...remaining.split(" ").filter(word=>word&&!FILLER.has(word))];
  const filters:NetworkIntentFilters={};
  const chips:string[]=[];
  if(roles.matches.length===1){
    filters.role=roles.matches[0].key;chips.push(roles.matches[0].label);
  }else if(roles.matches.length>1)unsupported.push("più ruoli");
  if(countries.matches.length===1){
    filters.country=countries.matches[0].key;chips.push(countries.matches[0].label);
  }else if(countries.matches.length>1)unsupported.push("più paesi");
  if(regional.matches.length===1){
    if(filters.country&&filters.country!=="IT")unsupported.push("regione italiana con paese estero");
    else {
      filters.region=regional.matches[0].key;
      filters.country="IT";
      chips.push(regional.matches[0].label);
    }
  }else if(regional.matches.length>1)unsupported.push("più regioni");
  if(tubeMentioned){
    if(products.some(product=>product.canonical_key==="tubes_pipes")){
      filters.product="tubes_pipes";chips.push("Tubi (prodotti dichiarati)");
    }else unsupported.push("tubi: filtro tecnico non disponibile");
  }
  for(const type of ["product","capability","market"] as const){
    const matches=taxonomy.matches.filter(item=>item.type===type);
    if(matches.length>1||(type==="product"&&tubeMentioned&&matches.length)){
      unsupported.push("più "+(type==="product"?"prodotti":type==="capability"?"capacità":"mercati"));
    }else if(matches.length===1){
      filters[type]=matches[0].key;
      chips.push((type==="capability"?"Capacità: ":type==="market"?"Mercato: ":"Prodotto: ")+matches[0].label);
    }
  }
  const hasFilters=Boolean(filters.role||filters.region||filters.country||filters.product||filters.capability||filters.market);
  return {
    status:unsupported.length||!hasFilters?"unsupported":"ready",
    intent,filters,chips,unsupported:unsupported.slice(0,8),
    technicalOnly:Boolean(filters.product||filters.capability||filters.market||(filters.country&&filters.country!=="IT")),
  };
}
export function networkIntentHref(intent:NetworkIntentResult):string|null{
  if(intent.status!=="ready")return null;
  const query=new URLSearchParams();
  for(const key of ["role","region","country","product","capability","market"] as const){
    if(intent.filters[key])query.set(key,intent.filters[key]);
  }
  return "/network?"+query.toString()+"#network-results";
}
