import type {NetworkSpecFilters,NetworkSpecShape} from "@/lib/network-spec-filters";

/** NET-AUDIT1.1 — deterministic spec extraction for the Network chat (no LLM).
 *
 * Splits a request such as "40 tubi EN 10219 S235 60,3x3 da 3 metri" into:
 *   spec        → Network filters on the published technical scope
 *                 (standard, grade, shape, OD, wall thickness, side);
 *   rfqDetails  → quantity and cut length: they stay in the RFQ, never filters;
 *   notApplied  → requirements the Network cannot filter yet (material finish,
 *                 certificates, delivery, price…): always reported, never dropped.
 * `remainder` is the text without the recognised spec tokens, so the existing
 * role/region parser can still read "commercianti in Piemonte".
 */
export type NetworkSpecIntent={
  spec:NetworkSpecFilters;
  rfqDetails:string[];
  notApplied:string[];
  remainder:string;
};

const num=(value:string)=>Number(value.replace(",","."));
const valid=(value:number,max:number)=>Number.isFinite(value)&&value>0&&value<=max?value:undefined;

const NOT_APPLIED:ReadonlyArray<[RegExp,string]>=[
  [/\b(inox|stainless|edelstahl|acier inoxydable)\b/i,"materiale inox"],
  [/\b(zincat\w*|galvaniz\w*|verzinkt)\b/i,"zincatura"],
  [/\bcorten\b/i,"acciaio corten"],
  [/\b(seamless|senza saldatura|nahtlos)\b/i,"tubo senza saldatura"],
  [/\b(saldat\w*|welded|geschwei\w*)\b/i,"tubo saldato"],
  [/\b(certificat\w*|certificate|certification|3\.1|3\.2|ISO\s*9001)\b/i,"certificato"],
  [/\b(consegna|delivery|deliver|liefer\w*|entro\s+\d+|domani|tomorrow)\b/i,"tempi di consegna"],
  [/\b(prezz\w*|price|preis)\b/i,"prezzo"],
];

export function extractNetworkSpecIntent(raw:string):NetworkSpecIntent{
  let text=` ${raw.slice(0,400).replace(/\s+/g," ")} `;
  const spec:NetworkSpecFilters={};
  const rfqDetails:string[]=[];
  const take=(pattern:RegExp,handler:(match:RegExpMatchArray)=>void)=>{
    const match=text.match(pattern);
    if(!match)return;
    handler(match);
    text=text.replace(match[0]," ");
  };

  // Product standard: EN / UNI EN / DIN EN / EN ISO with optional part ("EN 10219-1").
  // A bare "ISO 9001" is a management certificate, not a product standard.
  take(/\b(?:UNI\s+|DIN\s+)?EN(\s+ISO)?\s*(\d{3,5})(?:\s*-\s*(\d{1,2}))?\b/i,match=>{
    spec.std=`EN${match[1]?" ISO":""} ${match[2]}${match[3]?"-"+match[3]:""}`;
  });
  // Grade: structural (S235, S355J2H), pressure (P235TR1), line pipe (L245), precision (E235).
  take(/\b([SPLE]\d{3}[A-Z0-9+]{0,8})\b/i,match=>{spec.grade=match[1].toUpperCase();});

  // Quantity (RFQ only): "40 tubi", "40 pz", "12 barre", "5 t", "5 tonnellate".
  take(/\b(\d{1,6})\s*(tubi|tubo|tubes?|pipes?|pezzi|pz|pcs|pieces|barre|bars?|t|ton|tonnellate|tonnes?)\b/i,match=>{
    rfqDetails.push(`quantità ${match[1]} ${match[2].toLowerCase()}`);
  });
  // Cut length (RFQ only): "da 3 metri", "lunghezza 6 m", "6 m", "6000 mm lunghezza".
  take(/\b(?:da|lunghezza|length|lunghi|long)?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(metri|metro|meters?|m)\b/i,match=>{
    rfqDetails.push(`lunghezza ${match[1].replace(".",",")} m`);
  });
  take(/\b(?:lunghezza|length)\s*(\d{3,5})\s*mm\b/i,match=>{
    rfqDetails.push(`lunghezza ${match[1]} mm`);
  });

  // Shape words.
  let shape:NetworkSpecShape|undefined;
  if(/\b(quadr\w*|square|quadrat\w*|carr[ée]s?)\b/i.test(text))shape="square";
  else if(/\b(rettangol\w*|rectangular|rechteck\w*)\b/i.test(text))shape="rectangular";
  else if(/\b(tond[oi]|round|rund|ronds?|circolar\w*)\b/i.test(text))shape="round";

  // Explicit labelled dimensions.
  take(/(?:Ø|ø|\bdiametro(?:\s+esterno)?|\bdiameter|\bod)\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:mm)?/i,match=>{
    spec.od=valid(num(match[1]),5000);
  });
  take(/\b(?:spessore|sp\.?|wall(?:\s+thickness)?|wt)\s*(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:mm)?/i,match=>{
    spec.wt=valid(num(match[1]),500);
  });
  take(/\b(?:lato|side)\s*(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:mm)?/i,match=>{
    spec.side=valid(num(match[1]),5000);
  });
  // Compact notation: "100x100x4" (hollow section) or "60,3x3" (round tube).
  take(/\b(\d{1,4}(?:[.,]\d{1,3})?)\s*[x×]\s*(\d{1,4}(?:[.,]\d{1,3})?)(?:\s*[x×]\s*(\d{1,3}(?:[.,]\d{1,3})?))?\s*(?:mm)?\b/i,match=>{
    const a=num(match[1]),b=num(match[2]),c=match[3]?num(match[3]):undefined;
    if(c!==undefined){
      spec.side=spec.side??valid(a,5000);
      spec.wt=spec.wt??valid(c,500);
      shape=shape??(a===b?"square":"rectangular");
    }else if(shape==="square"||shape==="rectangular"){
      spec.side=spec.side??valid(a,5000);
      if(shape==="square")spec.wt=spec.wt??valid(b,500);
    }else{
      spec.od=spec.od??valid(a,5000);
      spec.wt=spec.wt??valid(b,500);
      shape=shape??"round";
    }
  });

  if(shape)spec.shape=shape;
  if(spec.shape==="round")delete spec.side;
  if(spec.shape==="square"||spec.shape==="rectangular")delete spec.od;
  for(const key of Object.keys(spec) as (keyof NetworkSpecFilters)[]){
    if(spec[key]===undefined)delete spec[key];
  }
  const notApplied=NOT_APPLIED.filter(([pattern])=>pattern.test(raw)).map(([,label])=>label);
  return {spec,rfqDetails,notApplied,remainder:text.replace(/\s+/g," ").trim()};
}

/** Short Italian list for answers: "quantità 40 tubi, lunghezza 3 m". */
export function describeRfqDetails(details:string[]):string{
  return details.join(", ");
}
