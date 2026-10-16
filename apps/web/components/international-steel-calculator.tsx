"use client";

import { useState } from "react";
import { trackInternationalRfq } from "@/lib/international-rfq-analytics.client";
import { CALCULATOR_PUBLIC_ROUTES } from "@/lib/calculator-international-contract";
import { calculatorRfqFromValues, enqueueCalculatorRfq } from "@/lib/calculator-rfq-handoff";
import { estimatePublicTubeMass, parseTubeNumber } from "@/lib/international-tube-mass";
import {
  CALCULATOR_TRANSLATIONS, type CalculatorLandingLocale,
} from "@/lib/international-calculator-landing";

type Standard="en10219"|"en10210"|"geometric";
type Shape="round"|"square"|"rectangular";
const options:ReadonlyArray<{value:Standard,label:string}>=[
  {value:"en10219",label:"EN 10219"},
  {value:"en10210",label:"EN 10210"},
  {value:"geometric",label:"Geometric"},
];
export type InternationalCalculatorSeed={
  standard?:string;family?:string;od?:string;width?:string;
  height?:string;thickness?:string;length?:string;quantity?:string;target?:string;density?:string;
};
const familyFrom=(v:string|undefined):Shape=>v==="square_tube"?"square":v==="rectangular_tube"?"rectangular":"round";
const familyTo=(v:Shape)=>v==="round"?"round_tube":v==="square"?"square_tube":"rectangular_tube";
const validStandard=(v:string|undefined):Standard=>["en10219","en10210","geometric"].includes(v??"")?v as Standard:"en10219";

const controlClass="mt-2 min-h-12 w-full rounded-xl border border-[#9bb9ab] bg-white px-3 text-base text-[#123b34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#117958]";
// Stable component identity: typing must not remount the text input / lose focus.
function CalcInput({label,value,onChange}:{
  label:string;value:string;onChange:(v:string)=>void;
}){
  return <label className="block min-w-0 text-sm font-semibold text-[#123b34]">{label}
    <input value={value} inputMode="decimal" type="text" onChange={e=>onChange(e.target.value)}
      className={controlClass}/>
  </label>;
}

export function InternationalSteelCalculator({locale,seed={}}:{
  locale:CalculatorLandingLocale;seed?:InternationalCalculatorSeed;
}){
  const t=CALCULATOR_TRANSLATIONS[locale];
  const [shape,setShape]=useState<Shape>(familyFrom(seed.family));
  const [standard,setStandard]=useState<Standard>(validStandard(seed.standard));
  const [diameter,setDiameter]=useState(seed.od??"168.3");
  const [width,setWidth]=useState(seed.width??"120");
  const [height,setHeight]=useState(seed.height??"80");
  const [thickness,setThickness]=useState(seed.thickness??"6");
  const [length,setLength]=useState(seed.length??"12");
  const [bars,setBars]=useState(seed.quantity??"1");
  const [density,setDensity]=useState(seed.density??"7850");
  const [status,setStatus]=useState("");
  const outerDiameterMm=parseTubeNumber(diameter);
  const widthMm=parseTubeNumber(width);
  const heightMm=parseTubeNumber(height);
  const thicknessMm=parseTubeNumber(thickness);
  const lengthM=parseTubeNumber(length);
  const pieces=parseTubeNumber(bars);
  const densityKgM3=parseTubeNumber(density);
  const valid=Number.isFinite(thicknessMm) && thicknessMm>0 && thicknessMm<=10000 &&
    Number.isFinite(lengthM) && lengthM>0 && lengthM<=1000 &&
    Number.isSafeInteger(pieces) && pieces>0 && pieces<=1000000 &&
    (standard!=="geometric" || (Number.isFinite(densityKgM3) && densityKgM3>0 && densityKgM3<=30000));
  const result=valid?estimatePublicTubeMass({
    shape,standard,outerDiameterMm,widthMm,heightMm,
    thicknessMm,lengthM,bars:pieces,densityKgM3:standard==="geometric"?densityKgM3:7850,
  }):null;
  const calculated=result?.ok?result:null;
  const number=(n:number,digits=3)=>new Intl.NumberFormat(locale==="de"?"de-DE":locale==="fr"?"fr-FR":"es-ES",{maximumFractionDigits:digits}).format(n);
  const description=calculated?[
    `${standard==="geometric"?t.geometric:standard.toUpperCase()} · ${shape==="round"?t.round:shape==="square"?t.square:t.rectangular}`,
    `${shape==="round"?`D ${diameter}`:`B ${width}${shape==="rectangular"?`, H ${height}`:""}`}, t ${thickness} mm`,
    `${t.result}: ${number(calculated.weightKgM)} kg/m`,
    `${t.perBar}: ${number(calculated.weightKgBar)} kg`,
    `${t.totalTonnes}: ${number(calculated.totalTonnes)} t`,
    t.disclaimer,
  ].join("\n"):"";
  async function copy(){
    if(!calculated)return;
    try{await navigator.clipboard.writeText(description);setStatus(t.copied);}
    catch{setStatus(t.copyFailed);}
  }
  function addToBill(){
    if(!calculated)return;
    // The existing v1 EN/IT browser contract uses original numeric values,
    // revalidates them and never claims a certified catalog/product weight.
    const item=calculatorRfqFromValues({
      family:familyTo(shape),standard,outerDiameter:diameter,width,height,
      thickness,length,quantity:bars,density:standard==="geometric"?density:"7850",
      kgM:calculated.weightKgM,
    },crypto.randomUUID());
    if(!item || !enqueueCalculatorRfq(window.sessionStorage,item)){
      setStatus(t.addFailed);return;
    }
    trackInternationalRfq("handoff",locale,{system:"eu",standard});
    // The public bill matches the calculator language; no RFQ is dispatched.
    window.location.assign(CALCULATOR_PUBLIC_ROUTES[locale].rfqBill);
  }
  return <section id="calcolatore-pesi" className="space-y-5 rounded-2xl border border-[#cfe2d7] bg-white p-4 shadow-sm sm:p-6" aria-label={t.title}>
    <p className="text-xs font-bold uppercase tracking-wider text-[#17644c]">EN 10219 · EN 10210 · kg/m</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-[#123b34]">{t.shape}
        <select aria-label={t.shape} className={controlClass} value={shape} onChange={e=>{setShape(e.target.value as Shape);setStatus("");}}>
          <option value="round">{t.round}</option><option value="square">{t.square}</option>
          <option value="rectangular">{t.rectangular}</option>
        </select>
      </label>
      <label className="block text-sm font-semibold text-[#123b34]">{t.standard}
        <select aria-label={t.standard} className={controlClass} value={standard} onChange={e=>{setStandard(e.target.value as Standard);setStatus("");}}>
          {options.map(o=><option key={o.value} value={o.value}>{o.value==="geometric"?t.geometric:o.value==="en10219"?t.cold:t.hot}</option>)}
        </select>
      </label>
      {shape==="round"?<CalcInput label={t.diameter} value={diameter} onChange={v=>{setDiameter(v);setStatus("");}}/>:<>
        <CalcInput label={t.width} value={width} onChange={v=>{setWidth(v);setStatus("");}}/>
        {shape==="rectangular"?<CalcInput label={t.height} value={height} onChange={v=>{setHeight(v);setStatus("");}}/>:null}
      </>}
      <CalcInput label={t.wall} value={thickness} onChange={v=>{setThickness(v);setStatus("");}}/>
      <CalcInput label={t.length} value={length} onChange={v=>{setLength(v);setStatus("");}}/>
      <CalcInput label={t.bars} value={bars} onChange={v=>{setBars(v);setStatus("");}}/>
      {standard==="geometric"?<CalcInput label={t.density} value={density} onChange={v=>{setDensity(v);setStatus("");}}/>:null}
    </div>
    {calculated?<div role="status" aria-live="polite" className="grid gap-3 rounded-xl bg-[#edf7f1] p-4 sm:grid-cols-2">
      {[{label:t.result,n:calculated.weightKgM,unit:"kg/m"},
        {label:t.perBar,n:calculated.weightKgBar,unit:"kg"},
        {label:t.totalKg,n:calculated.totalKg,unit:"kg"},
        {label:t.totalTonnes,n:calculated.totalTonnes,unit:"t"}].map(item=>(
        <div key={item.label}><p className="text-xs text-[#3b5a4e]">{item.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#123b34]">{number(item.n)} {item.unit}</p>
        </div>
      ))}
    </div>:<p role="status" className="rounded-lg bg-[#fff5e7] p-3 text-sm text-[#82461a]">{t.invalid}</p>}
    <p className="text-xs leading-6 text-[#4d6257]">{t.disclaimer}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!calculated} onClick={copy}
        className="min-h-12 rounded-xl border border-[#16664c] px-4 text-sm font-semibold text-[#16664c] disabled:opacity-50">{t.copy}</button>
      <button type="button" disabled={!calculated} onClick={addToBill}
        className="min-h-12 rounded-xl bg-[#155943] px-4 text-sm font-semibold text-white disabled:opacity-50">{t.addBill} →</button>
    </div>
    <p role="status" aria-live="polite" className="text-xs text-[#3c6654]">{status}</p>
    <p className="text-xs leading-6 text-[#52615b]">{t.noLogin} {t.rfqEnglish}</p>
    <p className="text-sm font-semibold text-[#176c53]">{t.readMore}</p>
  </section>;
}
