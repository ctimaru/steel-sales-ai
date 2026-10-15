/**
 * Same opt-in USA deep-link contract for old indexed IT/EN paths and new
 * DE/FR/ES pages. Never reinterpret locale from an untrusted query string.
 * URL variants remain self-canonical to clean landing and noindex.
 */
import type { UsPipeInitialValues } from "@/components/us-pipe-sample-calculator";
type Query = Record<string,string|string[]|undefined>;
const str=(q:Query,key:string)=>typeof q[key]==="string"?(q[key] as string).slice(0,80):undefined;
export const calculatorRegionFromQuery=(q:Query):"us"|"eu"=>str(q,"system")==="us"?"us":"eu";
export const usPipeSeedFromQuery=(q:Query):UsPipeInitialValues=>({
  mode:str(q,"usMode"),units:str(q,"units"),nps:str(q,"nps"),rowId:str(q,"rowId"),
  productStandard:str(q,"productStandard"),
  customDiameter:str(q,"customDiameter"),customWall:str(q,"customWall"),
  length:str(q,"length"),bars:str(q,"quantity"),
  hssReferenceId:str(q,"hssReferenceId"),hssShape:str(q,"hssShape"),
  hssUnits:str(q,"hssUnits"),hssDiameter:str(q,"hssDiameter"),
  hssWidth:str(q,"hssWidth"),hssHeight:str(q,"hssHeight"),
  hssThickness:str(q,"hssThickness"),hssLength:str(q,"hssLength"),
  hssQuantity:str(q,"hssQuantity"),
});
