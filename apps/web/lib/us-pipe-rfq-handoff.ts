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
export type UsPipeRfqItem = {
  version: 2;
  id: string;
  createdAt: number;
  sampleId: string;
  productStandard: UsProductStandard;
  lengthM: number;
  bars: number;
};
export type UsPipeRfqSpecification = {
  standardLabel: string;
  designation: string;
  sampleId: string;
  outerDiameterMm: number;
  wallMm: number;
  bars: number;
  lengthM: number;
  theoreticalKgM: number;
  publishedKgM: number;
  publisherPage: number;
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
    typeof raw.sampleId!=="string" || !findUsPipeSample(raw.sampleId) ||
    typeof raw.productStandard!=="string" || !(raw.productStandard in productLabels) ||
    !validNum(raw.lengthM,1000) || !validNum(raw.bars,1_000_000) ||
    !Number.isSafeInteger(raw.bars)) return null;
  return {
    version:2,id:raw.id,createdAt:raw.createdAt,sampleId:raw.sampleId,
    productStandard:raw.productStandard as UsProductStandard,
    lengthM:raw.lengthM as number,bars:raw.bars as number,
  };
}

export function buildUsPipeRfqItem(
  selection:{sampleId:string;productStandard:UsProductStandard;lengthM:number;bars:number},
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

/** Only resolves catalog manufacturer evidence and recomputes theoretical mass. */
export function usPipeRfqSpecification(input:UsPipeRfqItem):UsPipeRfqSpecification|null {
  const valid=validUsPipeRfqItem(input);
  if(!valid)return null;
  const row=findUsPipeSample(valid.sampleId);
  if(!row)return null;
  const mass=estimatePublicTubeMass({
    shape:"round",standard:"geometric",outerDiameterMm:row.outerDiameterMm,
    thicknessMm:row.thicknessMm,lengthM:valid.lengthM,bars:valid.bars,densityKgM3:7850,
  });
  if(!mass.ok)return null;
  return {
    standardLabel:productLabels[valid.productStandard],
    designation:`NPS ${row.nps} Sch/Class ${row.schedule}`,
    sampleId:row.id,outerDiameterMm:row.outerDiameterMm,wallMm:row.thicknessMm,
    bars:valid.bars,lengthM:valid.lengthM,theoreticalKgM:mass.weightKgM,
    publishedKgM:row.publishedWeightKgM,publisherPage:row.sourcePage,
    provenanceNote:`Theoretical geometric mass (7850 kg/m³), not certified; U.S. Steel manufacturer sample p.${row.sourcePage} supplies the nominal NPS/Schedule geometry. Product grade, edition, PSL and tolerance require supplier confirmation.`,
  };
}
