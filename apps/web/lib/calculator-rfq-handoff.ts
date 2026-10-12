/**
 * CALC-UX2: tab-scoped, short-lived, validated calculator -> RFQ bill bridge.
 * No URLs, cookies, network writes, auth state, prices or customer data.
 * All payloads are untrusted, even when read from sessionStorage.
 */
import type { BuyerDistintaDraftLine } from "@/lib/buyer-distinta";

export const CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1";
export const CALC_RFQ_HANDOFF_TTL_MS = 10 * 60 * 1000;
export type CalcRfqStandard = "en10219" | "en10210" | "geometric";
export type CalcRfqFamily = "round_tube" | "square_tube" | "rectangular_tube";
export type CalculatorRfqItem = {
  version: 1;
  id: string;
  createdAt: number;
  family: CalcRfqFamily;
  standard: CalcRfqStandard;
  outerDiameter: number | null;
  width: number | null;
  height: number | null;
  thickness: number;
  length: number;
  bars: number;
  density: number;
  kgM: number;
};
const isObject = (v: unknown): v is Record<string,unknown> => !!v && typeof v==="object" && !Array.isArray(v);
const positive = (v: unknown, max: number) => typeof v==="number" && Number.isFinite(v) && v>0 && v<=max;
const num = (v: unknown): number => typeof v==="string" && /^[0-9]+(?:[.,][0-9]+)?$/.test(v.trim()) ? Number(v.trim().replace(",",".")) : Number.NaN;
const safeDim = (v: unknown): v is number | null => v===null || positive(v,100000);

export function validatedCalculatorRfqItem(value: unknown, now=Date.now()): CalculatorRfqItem | null {
  if (!isObject(value) || value.version!==1 || typeof value.id!=="string" ||
      !/^[a-zA-Z0-9-]{6,90}$/.test(value.id) ||
      typeof value.createdAt!=="number" || !Number.isFinite(value.createdAt) ||
      value.createdAt>now+1000 || now-value.createdAt>CALC_RFQ_HANDOFF_TTL_MS ||
      !["round_tube","square_tube","rectangular_tube"].includes(String(value.family)) ||
      !["en10219","en10210","geometric"].includes(String(value.standard)) ||
      !safeDim(value.outerDiameter) || !safeDim(value.width) || !safeDim(value.height) ||
      !positive(value.thickness,10000) || !positive(value.length,1000) ||
      !positive(value.bars,1_000_000) || !Number.isSafeInteger(value.bars) ||
      !positive(value.kgM,1_000_000) || !positive(value.density,30000)) return null;
  const v=value as CalculatorRfqItem;
  const first=v.family==="round_tube"?v.outerDiameter:v.width;
  const second=v.family==="rectangular_tube"?v.height:first;
  if(first===null || second===null || first<=2*v.thickness || second<=2*v.thickness) return null;
  // Do not infer a published/verified mass from the handoff.
  if(v.standard!=="geometric" && v.density!==7850) return null;
  return {version:1,id:v.id,createdAt:v.createdAt,family:v.family,standard:v.standard,
    outerDiameter:v.outerDiameter,width:v.width,height:v.height,
    thickness:v.thickness,length:v.length,bars:v.bars,density:v.density,kgM:v.kgM};
}

export function calculatorRfqFromValues(input: {
  family: CalcRfqFamily; standard: CalcRfqStandard;
  outerDiameter: string; width: string; height: string; thickness: string;
  length: string; quantity: string; density: string; kgM: number;
}, id: string, now=Date.now()): CalculatorRfqItem | null {
  const value = {
    version:1,id,createdAt:now,family:input.family,standard:input.standard,
    outerDiameter:input.family==="round_tube"?num(input.outerDiameter):null,
    width:input.family==="round_tube"?null:num(input.width),
    height:input.family==="rectangular_tube"?num(input.height):null,
    thickness:num(input.thickness),length:num(input.length),bars:num(input.quantity),
    density:input.standard==="geometric"?num(input.density):7850,kgM:input.kgM,
  };
  return validatedCalculatorRfqItem(value,now);
}

export function readCalculatorRfqQueue(storage: Pick<Storage,"getItem">, now=Date.now()): CalculatorRfqItem[] {
  try {
    const raw=storage.getItem(CALC_RFQ_HANDOFF_KEY);
    if(!raw) return [];
    if(raw.length>20000) return [];
    const decoded:unknown=JSON.parse(raw);
    if(!Array.isArray(decoded)) return [];
    const ids=new Set<string>();
    return decoded.slice(0,20).map(v=>validatedCalculatorRfqItem(v,now)).filter((v):v is CalculatorRfqItem=>{
      if(!v||ids.has(v.id))return false;ids.add(v.id);return true;
    });
  } catch {return [];}
}

export function enqueueCalculatorRfq(storage: Pick<Storage,"getItem"|"setItem">, value:CalculatorRfqItem): boolean {
  try {
    const valid=validatedCalculatorRfqItem(value);
    if(!valid)return false;
    const queue=readCalculatorRfqQueue(storage);
    if(queue.length>=20)return false;
    storage.setItem(CALC_RFQ_HANDOFF_KEY,JSON.stringify([...queue,valid]));
    return true;
  } catch {return false;}
}
export function consumeCalculatorRfqIds(storage: Pick<Storage,"getItem"|"setItem"|"removeItem">, ids:readonly string[]) {
  try {
    const consumed=new Set(ids);
    const remaining=readCalculatorRfqQueue(storage).filter(v=>!consumed.has(v.id));
    if(remaining.length)storage.setItem(CALC_RFQ_HANDOFF_KEY,JSON.stringify(remaining));
    else storage.removeItem(CALC_RFQ_HANDOFF_KEY);
  } catch { /* Storage denial never sends anything */ }
}

export function calculatorItemToBuyerLine(item:CalculatorRfqItem,id:string):BuyerDistintaDraftLine {
  const f=(n:number)=>String(n);
  const shape=item.family==="round_tube"?"Tubo tondo":item.family==="square_tube"?"Tubo quadro":"Tubo rettangolare";
  const sizes=item.family==="round_tube"?"Ø "+f(item.outerDiameter!):
    item.family==="square_tube"?f(item.width!)+" × "+f(item.width!):
    f(item.width!)+" × "+f(item.height!);
  return {
    id,description:shape+" "+sizes+" × "+f(item.thickness)+" mm",
    standard:item.standard==="en10219"?"EN 10219":item.standard==="en10210"?"EN 10210":"Calcolo geometrico libero",
    grade:"",finish:"",quantityMode:"bars",quantity:f(item.bars),
    barLengthM:f(item.length),weightKgM:item.kgM.toLocaleString("it-IT",{maximumFractionDigits:3}),
    targetEurT:"",
    note:item.standard==="geometric"
      ?"Peso teorico da calcolo geometrico, densità "+f(item.density)+" kg/m³. Norma di prodotto e grado da confermare."
      :"Peso teorico da calcolatore Smart Steel Sales; grado acciaio e peso effettivo da confermare con il fornitore.",
  };
}
