/** NET-AUDIT1.1 — URL contract for technical spec filters (pure, client-safe).
 *
 * Parameters: std (norma), grade (grado), shape (round|square|rectangular),
 * od (Ø esterno mm), wt (spessore mm), side (lato mm). Quantities and cut
 * lengths are deliberately NOT part of the contract: they belong to the RFQ.
 */
export type NetworkSpecShape="round"|"square"|"rectangular";
export type NetworkSpecFilters={
  std?:string;grade?:string;shape?:NetworkSpecShape;od?:number;wt?:number;side?:number;
};
export const NETWORK_SPEC_PARAMS=["std","grade","shape","od","wt","side"] as const;
export const NETWORK_SPEC_SHAPES:ReadonlyArray<{key:NetworkSpecShape;label:string}>=[
  {key:"round",label:"Tondo"},{key:"square",label:"Quadro"},{key:"rectangular",label:"Rettangolare"},
];
/** Suggestions only: the server matches any standard code by canonical key. */
export const NETWORK_SPEC_STANDARD_SUGGESTIONS=[
  "EN 10219","EN 10210","EN 10255","EN 10216-1","EN 10217-1","EN 10305","EN 10296","EN 10297",
] as const;

const LIMITS={od:5000,wt:500,side:5000} as const;

/** "60,3" and "60.3 mm" → 60.3; anything invalid or out of range → undefined. */
export function parseSpecMillimetres(value:unknown,max:number):number|undefined{
  if(typeof value!=="string")return undefined;
  const cleaned=value.trim().toLowerCase().replace(/\s*mm$/,"").replace(",",".");
  if(!/^\d{1,4}(\.\d{1,3})?$/.test(cleaned))return undefined;
  const number=Number(cleaned);
  return number>0&&number<=max?number:undefined;
}

function cleanCode(value:unknown,max=40):string|undefined{
  if(typeof value!=="string")return undefined;
  const cleaned=value.replace(/[^\p{L}\p{N}\s.\-/:+]/gu,"").replace(/\s+/g," ").trim().slice(0,max);
  return cleaned||undefined;
}

/** Normalize raw URL values. Contradictory geometry is dropped, never guessed:
 * a diameter belongs to round tubes, a side to square/rectangular sections. */
export function normalizeSpecFilters(raw:Record<string,unknown>):NetworkSpecFilters{
  const shapeRaw=typeof raw.shape==="string"?raw.shape.trim():"";
  const shape=NETWORK_SPEC_SHAPES.some(item=>item.key===shapeRaw)?shapeRaw as NetworkSpecShape:undefined;
  let od=parseSpecMillimetres(raw.od,LIMITS.od);
  let side=parseSpecMillimetres(raw.side,LIMITS.side);
  if(shape==="round")side=undefined;
  if(shape==="square"||shape==="rectangular")od=undefined;
  const result:NetworkSpecFilters={
    std:cleanCode(raw.std),grade:cleanCode(raw.grade),shape,od,
    wt:parseSpecMillimetres(raw.wt,LIMITS.wt),side,
  };
  for(const key of Object.keys(result) as (keyof NetworkSpecFilters)[]){
    if(result[key]===undefined)delete result[key];
  }
  return result;
}

/** A spec search needs at least one technical criterion (shape alone is not one). */
export function hasSpecCriteria(filters:NetworkSpecFilters):boolean{
  return Boolean(filters.std||filters.grade||filters.od||filters.wt||filters.side);
}

export function specFiltersToParams(filters:NetworkSpecFilters):Record<string,string>{
  const params:Record<string,string>={};
  for(const key of NETWORK_SPEC_PARAMS){
    const value=filters[key];
    if(value!==undefined&&value!=="")params[key]=String(value);
  }
  return params;
}

const formatMm=(value:number)=>value.toLocaleString("it-IT",{maximumFractionDigits:3});

/** Short Italian summary for headings and the chat, e.g. "EN 10219 · S235 · Ø 60,3 × 3 mm". */
export function describeSpecFilters(filters:NetworkSpecFilters):string{
  const parts:string[]=[];
  if(filters.std)parts.push(filters.std);
  if(filters.grade)parts.push(filters.grade);
  if(filters.shape)parts.push(NETWORK_SPEC_SHAPES.find(item=>item.key===filters.shape)?.label.toLowerCase()??"");
  const size=[filters.od?"Ø "+formatMm(filters.od):null,filters.side?"lato "+formatMm(filters.side):null]
    .filter(Boolean).join(" ");
  if(size||filters.wt)parts.push([size,filters.wt?(size?"× ":"spessore ")+formatMm(filters.wt):null].filter(Boolean).join(" ")+" mm");
  return parts.filter(Boolean).join(" · ");
}

export type SpecEvidenceProvenance="platform_verified"|"company_declared"|"public_web"|"platform_curated";
export function specProvenanceLabel(kind:string|undefined):string{
  switch(kind){
    case "platform_verified":return "Verificato";
    case "company_declared":return "Dichiarato dall'azienda";
    case "public_web":return "Da fonte pubblica";
    default:return "Curato dalla piattaforma";
  }
}
