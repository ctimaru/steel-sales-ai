import {extractNetworkSpecIntent} from "@/lib/network-spec-intent";
import {EU_MEMBER_COUNTRIES,OTHER_NETWORK_COUNTRIES} from "@/lib/network-eu-countries";

/** Pure, conservative technical intent parser. The optional model only
 * resolves explicitly present terms; it cannot invent a grade or manufacturer.
 * Geometry is retained for the RFQ but NEVER matched to separate tube ranges.
 */
export type EuProducerSearchIntent={
  standard:string|null;
  grade:string|null;
  shape:"CHS"|"SHS"|"RHS"|null;
  country:string|null;
  requestedSize:boolean;
  unverifiedConditions:string[];
};
const countryEntries=[...EU_MEMBER_COUNTRIES,...OTHER_NETWORK_COUNTRIES].filter(x=>x.code!=="US");
const aliases:Record<string,string[]>={
  BG:["bulgaria","bulgarian"],GR:["grecia","greece","greek"],
  SI:["slovenia","slovenian"],RS:["serbia","serbian"],
  HU:["ungheria","hungary","hungarian"],DE:["germania","germany","german"],
  FR:["france","french"],GB:["united kingdom","britain","uk","england"],
  TR:["turkey","turkiye","türkiye","turkish"],UA:["ukraine","ukrainian"],
  CH:["switzerland","svizzera","swiss"],IT:["italy","italia","italian"],
};
const squash=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function mentioned(haystack:string,word:string){
  const h=" "+squash(haystack).replace(/[^a-z0-9]+/g," ")+" ";
  const w=" "+squash(word).replace(/[^a-z0-9]+/g," ").trim()+" ";
  return h.includes(w);
}
function countryIn(question:string):string|null{
  // Never treat ordinary Italian/English short words ("si", "se", "it")
  // as a country. ISO codes require an explicit location preposition and
  // uppercase letters, while full country names and aliases remain natural.
  const named=countryEntries.filter(row=>
    [row.name,...(aliases[row.code]??[])].some(alias=>mentioned(question,alias))
  );
  const codes=countryEntries.filter(row=>
    new RegExp(String.raw`\\b(?:in|nel|nella|paese|country|from|dal)\\s+${row.code}\\b`).test(question)
  );
  const matches=new Set([...named,...codes].map(item=>item.code));
  return matches.size===1?[...matches][0]:null;
}
function productStandard(question:string,parsed:string|undefined){
  const raw=(parsed||"").toUpperCase().replace(/\s+/g," ").trim();
  if(/^(EN( ISO)? \d{4,5}(-\d{1,2})?|ASTM A\d{2,4}|ISO \d{3,5})$/.test(raw))return raw;
  const astm=question.match(/\bASTM\s*A\s*(\d{2,4})\b/i);
  if(astm)return "ASTM A"+astm[1];
  const iso=question.match(/\bISO\s*(\d{3,5})\b/i);
  if(iso)return "ISO "+iso[1];
  return null;
}
function gradeCode(question:string,parsed:string|undefined){
  const explicit=question.match(/\bAISI\s*(\d{3,4}[A-Z]{0,3})\b/i);
  if(explicit)return "AISI "+explicit[1].toUpperCase();
  const value=parsed?.toUpperCase()||"";
  return /^[SPLE]\d{3}[A-Z0-9+]{0,8}$/.test(value)?value:null;
}
export function parseEuProducerSearchIntent(input:string):EuProducerSearchIntent{
  const question=input.slice(0,400).trim();
  const existing=extractNetworkSpecIntent(question);
  const shape=existing.spec.shape==="round"?"CHS":
    existing.spec.shape==="square"?"SHS":
    existing.spec.shape==="rectangular"?"RHS":
    /\bRHS\b/i.test(question)?"RHS":/\bSHS\b/i.test(question)?"SHS":
    /\bCHS\b/i.test(question)?"CHS":null;
  const requestedSize=Boolean(
    existing.spec.od||existing.spec.wt||existing.spec.side||existing.spec.side2
  );
  return {
    standard:productStandard(question,existing.spec.std),
    grade:gradeCode(question,existing.spec.grade),
    shape,country:countryIn(question),
    requestedSize,
    unverifiedConditions:existing.notApplied.slice(0,5),
  };
}
function sourceContains(question:string,token:string):boolean{
  const q=question.toUpperCase().replace(/[^A-Z0-9]/g,"");
  const x=token.toUpperCase().replace(/[^A-Z0-9]/g,"");
  return x.length>=3&&q.includes(x);
}
/** Model suggestions never weaken the deterministic interpretation or add
 * constraints absent from the user's literal text. */
export function reconcileEuProducerModelIntent(
  question:string,parsed:EuProducerSearchIntent,raw:unknown,
):EuProducerSearchIntent{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return parsed;
  const o=raw as Record<string,unknown>;
  if(["standard","grade","shape","country"].some(k=>typeof o[k]!=="string"))return parsed;
  const next={...parsed};
  const standard=String(o.standard).trim().toUpperCase().replace(/\s+/g," ");
  const grade=String(o.grade).trim().toUpperCase().replace(/\s+/g," ");
  const shape=String(o.shape).trim().toUpperCase();
  const country=String(o.country).trim().toUpperCase();
  if(!next.standard && /^(EN( ISO)? \d{4,5}(-\d{1,2})?|ASTM A\d{2,4}|ISO \d{3,5})$/.test(standard)
    && sourceContains(question,standard))next.standard=standard;
  if(!next.grade && /^([SPLE]\d{3}[A-Z0-9+]{0,8}|AISI \d{3,4}[A-Z]{0,3})$/.test(grade)
    && sourceContains(question,grade))next.grade=grade;
  // Only reuse a shape when it appears literally. No morphology inference
  // from unconstrained model text.
  if(!next.shape && ["RHS","SHS","CHS"].includes(shape)
    && sourceContains(question,shape))next.shape=shape as "CHS"|"SHS"|"RHS";
  if(!next.country && countryEntries.some(x=>x.code===country) &&
    countryIn(question)===country)next.country=country;
  return next;
}
