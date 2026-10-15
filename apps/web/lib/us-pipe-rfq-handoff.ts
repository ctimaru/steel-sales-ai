/**
 * CALC-INT3C — additive, tab-only US pipe RFQ bridge (v2).
 *
 * The original EN/geometric v1 queue remains completely unchanged.
 * This bridge contains *requested* API/ASTM product identity, a source-located
 * NPS/Schedule designation and selected bar quantity, but never certification.
 *
 * Never trust browser storage: re-resolve every sample id from the governed
 * manufacturer dataset and recalculate theoretical mass before conversion.
 */
import { estimatePublicTubeMass } from "@/lib/international-tube-mass";
import { findUsPipeSample } from "@/lib/us-pipe-catalog-sample";

export const US_PIPE_RFQ_KEY = "sss:us-pipe-rfq-handoff:v2";
export const US_PIPE_RFQ_TTL_MS = 10 * 60 * 1000;
export type UsProductStandard = "api5l" | "astm-a53" | "astm-a106";
type UsPipeRfqBase = {
  version: 2;
  id: string;
  createdAt: number;
  productStandard: UsProductStandard;
  lengthM: number;
  bars: number;
};
/** Existing v2 catalog payload remains wire-compatible; mode is absent. */
export type UsPipeRfqCatalogItem = UsPipeRfqBase & { sampleId: string; mode?: never };
/** Explicitly user-supplied geometry, NOT an NPS/Schedule mapping. */
export type UsPipeRfqCustomItem = UsPipeRfqBase & {
  mode: "custom";
  outerDiameterMm: number;
  thicknessMm: number;
  sampleId?: never;
};
export type UsPipeRfqItem = UsPipeRfqCatalogItem | UsPipeRfqCustomItem;

export type UsPipeRfqSpecification = {
  standardLabel: string;
  designation: string;
  sampleId: string;
  outerDiameterMm: number;
  wallMm: number;
  bars: number;
  lengthM: number;
  theoreticalKgM: number;
  publishedKgM: number | null;
  publisherPage: number | null;
  provenanceNote: string;
};
const productLabels: Record<UsProductStandard,string> = {
  api5l:"API Spec 5L (edition and PSL to confirm)",
  "astm-a53":"ASTM A53/A53M (grade/type to confirm)",
  "astm-a106":"ASTM A106/A106M (grade to confirm)",
};
const obj=(value:unknown):value is Record<string,unknown> =>
  Boolean(value) && typeof value==="object" && !Array.isArray(value);
const validNum=(v:unknown,max:number) =>
  typeof v==="number" && Number.isFinite(v) && v>0 && v<=max;

export function validUsPipeRfqItem(raw:unknown,now=Date.now()):UsPipeRfqItem|null {
  if(!obj(raw) || raw.version!==2 || typeof raw.id!=="string" ||
    !/^[a-zA-Z0-9-]{6,90}$/.test(raw.id) ||
    typeof raw.createdAt!=="number" || !Number.isFinite(raw.createdAt) ||
    raw.createdAt>now+1000 || now-raw.createdAt>US_PIPE_RFQ_TTL_MS ||
    typeof raw.productStandard!=="string" ||
    !["api5l","astm-a53","astm-a106"].includes(raw.productStandard) ||
    !validNum(raw.lengthM,1000) || !validNum(raw.bars,1_000_000) ||
    !Number.isSafeInteger(raw.bars)) return null;
  const common:UsPipeRfqBase = {
    version:2,id:raw.id,createdAt:raw.createdAt,
    productStandard:raw.productStandard as UsProductStandard,
    lengthM:raw.lengthM as number,bars:raw.bars as number,
  };
  if(raw.mode==="custom") {
    if(raw.sampleId!==undefined ||
      !validNum(raw.outerDiameterMm,2500) ||
      !validNum(raw.thicknessMm,250) ||
      (raw.thicknessMm as number)*2 >= (raw.outerDiameterMm as number)) return null;
    // A user dimension is not evidence of a published size or API compliance.
    return {...common,mode:"custom",
      outerDiameterMm:raw.outerDiameterMm as number,
      thicknessMm:raw.thicknessMm as number};
  }
  if(raw.mode!==undefined || typeof raw.sampleId!=="string" ||
    !findUsPipeSample(raw.sampleId))return null;
  return {...common,sampleId:raw.sampleId};
}

export function buildUsPipeRfqItem(
  selection:
    | {sampleId:string;productStandard:UsProductStandard;lengthM:number;bars:number}
    | {mode:"custom";outerDiameterMm:number;thicknessMm:number;productStandard:UsProductStandard;lengthM:number;bars:number},
  id:string,now=Date.now(),
):UsPipeRfqItem|null {
  return validUsPipeRfqItem({version:2,id,createdAt:now,...selection},now);
}

export function readUsPipeRfqQueue(storage:Pick<Storage,"getItem">,now=Date.now()):UsPipeRfqItem[] {
  try {
    const raw=storage.getItem(US_PIPE_RFQ_KEY);
    if(!raw || raw.length>18000)return [];
    const values:unknown=JSON.parse(raw);
    if(!Array.isArray(values))return [];
    const ids=new Set<string>();
    return values.slice(0,20).map(v=>validUsPipeRfqItem(v,now))
      .filter((v):v is UsPipeRfqItem=>{
        if(!v || ids.has(v.id))return false;
        ids.add(v.id);return true;
      });
  }catch{return [];}
}
export function enqueueUsPipeRfq(storage:Pick<Storage,"getItem"|"setItem">,value:UsPipeRfqItem):boolean {
  try {
    const valid=validUsPipeRfqItem(value);
    if(!valid)return false;
    const existing=readUsPipeRfqQueue(storage);
    if(existing.length>=20 || existing.some(v=>v.id===valid.id))return false;
    storage.setItem(US_PIPE_RFQ_KEY,JSON.stringify([...existing,valid]));
    return true;
  }catch{return false;}
}
export function consumeUsPipeRfqIds(
  storage:Pick<Storage,"getItem"|"setItem"|"removeItem">,ids:readonly string[],
):void {
  try{
    const ignored=new Set(ids);
    const remaining=readUsPipeRfqQueue(storage).filter(v=>!ignored.has(v.id));
    if(remaining.length) storage.setItem(US_PIPE_RFQ_KEY,JSON.stringify(remaining));
    else storage.removeItem(US_PIPE_RFQ_KEY);
  }catch{/* Do not dispatch, and never interfere with v1. */}
}

/** Recalculate all masses; never trust client-side displayed kg/m. */
export function usPipeRfqSpecification(input:UsPipeRfqItem):UsPipeRfqSpecification|null {
  const valid=validUsPipeRfqItem(input);
  if(!valid)return null;
  const row=valid.mode==="custom"?null:findUsPipeSample(valid.sampleId);
  if(valid.mode!=="custom" && !row)return null;
  const diameter=valid.mode==="custom"?valid.outerDiameterMm:row!.outerDiameterMm;
  const thickness=valid.mode==="custom"?valid.thicknessMm:row!.thicknessMm;
  const mass=estimatePublicTubeMass({
    shape:"round",standard:"geometric",outerDiameterMm:diameter,
    thicknessMm:thickness,lengthM:valid.lengthM,bars:valid.bars,densityKgM3:7850,
  });
  if(!mass.ok)return null;
  const designation=row
    ? `NPS ${row.nps} Sch/Class ${row.schedule}`
    : `User dimensions OD ${diameter} × wall ${thickness} mm (no NPS/Schedule verification)`;
  const sourceEvidence=row
    ? (row.sourcePage!=null ? `U.S. Steel manufacturer sample p.${row.sourcePage}`
      : `U.S. Steel public ${row.sourceLocation ?? "Pipe Tables"}`)
    : "User-entered geometry with no manufacturer dimension source";
  return {
    standardLabel:productLabels[valid.productStandard],
    designation,sampleId:row?.id ?? "custom",
    outerDiameterMm:diameter,wallMm:thickness,
    bars:valid.bars,lengthM:valid.lengthM,theoreticalKgM:mass.weightKgM,
    publishedKgM:row?.publishedWeightKgM ?? null,
    publisherPage:row?.sourcePage ?? null,
    provenanceNote:`Theoretical geometric mass (7850 kg/m³), not certified; ${sourceEvidence}. Product grade, edition, PSL and tolerance require supplier confirmation.`,
  };
}
