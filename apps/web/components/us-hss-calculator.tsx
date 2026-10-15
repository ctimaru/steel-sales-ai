"use client";

import { useState } from "react";

import { estimatePublicTubeMass } from "@/lib/international-tube-mass";
import { buildUsPipeRfqItem, enqueueUsPipeRfq } from "@/lib/us-pipe-rfq-handoff";

type HssShape="round"|"square"|"rectangular";
type Locale="it"|"en";
const text={
  it:{
    title:"HSS strutturali ASTM A500",
    summary:"Profilati tondi, quadri e rettangolari. Massa indicativa calcolata con le convenzioni AISC per le proprietà di sezione; non è il peso effettivo certificato dal produttore.",
    shape:"Sezione",round:"Tondo HSS",square:"Quadro SHS",rectangular:"Rettangolare RHS",
    unit:"Unità",od:"Diametro esterno",width:"Larghezza esterna",height:"Altezza esterna",
    thickness:"Spessore nominale",length:"Lunghezza barra (m)",bars:"Numero barre",
    model:"Modello AISC: t progetto = 0,93 × t nominale; r esterno = 2 × t progetto per quadri/rettangolari.",
    status:"ASTM A500 è una specifica di prodotto, non una certificazione delle misure digitate. Confermare grado, produttore, spessori, raggi e massa per le forniture.",
    weight:"Massa indicativa AISC",total:"Massa totale stimata",invalid:"Controlla geometria, spessore, perimetro massimo 88 pollici e quantità.",
    copy:"Copia specifica HSS",add:"Aggiungi HSS alla distinta RFQ",
    copied:"Specifica copiata",copyError:"Impossibile copiare",error:"Impossibile preparare la distinta in questa scheda.",
    source:"Riferimenti tecnici: Steel Tube Institute e AISC",
  },
  en:{
    title:"ASTM A500 structural HSS",
    summary:"Round, square and rectangular hollow sections. Indicative mass based on AISC design section-property conventions, not certified as-delivered manufacturer weight.",
    shape:"Shape",round:"Round HSS",square:"Square HSS",rectangular:"Rectangular HSS",
    unit:"Units",od:"Outside diameter",width:"Outside width",height:"Outside height",
    thickness:"Nominal wall",length:"Bar length (m)",bars:"Number of bars",
    model:"AISC model: design wall = 0.93 × nominal wall; outside radius = 2 × design wall for SHS/RHS.",
    status:"ASTM A500 describes product requirements; user dimensions do not establish certification. Confirm grade, producer, tolerances, radii and delivered mass.",
    weight:"AISC indicative mass",total:"Indicative total mass",invalid:"Check geometry, thickness, maximum 88-inch perimeter and quantities.",
    copy:"Copy HSS specification",add:"Add HSS to RFQ bill",
    copied:"Specification copied",copyError:"Copy unavailable",error:"Could not prepare RFQ bill in this tab.",
    source:"Technical sources: Steel Tube Institute and AISC",
  },
} as const;
const parse=(s:string)=>{
  const v=s.trim().replace(",",".");
  return /^\d+(?:\.\d+)?$/.test(v)?Number(v):NaN;
};
const format=(n:number,loc:Locale)=>new Intl.NumberFormat(loc==="it"?"it-IT":"en-US",{maximumFractionDigits:3}).format(n);
const SOURCE="https://steeltubeinstitute.org/resources/filling-the-void-a-central-resource-for-designing-concrete-filled-hss-columns/";

export function UsHssCalculator({locale}:{locale:Locale}){
  const t=text[locale];
  const [shape,setShape]=useState<HssShape>("square");
  const [units,setUnits]=useState<"mm"|"in">("in");
  const [diameter,setDiameter]=useState("6");
  const [width,setWidth]=useState("6");
  const [height,setHeight]=useState("4");
  const [thickness,setThickness]=useState("0.25");
  const [length,setLength]=useState("12");
  const [bars,setBars]=useState("1");
  const [status,setStatus]=useState("");
  const factor=units==="in"?25.4:1;
  const d=parse(diameter)*factor, w=parse(width)*factor,h=parse(height)*factor,nominalT=parse(thickness)*factor;
  const metres=parse(length),pieces=parse(bars);
  const perimeter=shape==="round"?Math.PI*d:2*(w+(shape==="square"?w:h));
  const valid=Number.isFinite(perimeter) && perimeter>0 && perimeter<=88*25.4
    && Number.isFinite(nominalT) && nominalT>0 && nominalT<=25.4
    && Number.isFinite(metres) && metres>0 && metres<=1000
    && Number.isSafeInteger(pieces) && pieces>0 && pieces<=1_000_000;
  const result=valid?estimatePublicTubeMass({
    shape,standard:"aisc-a500",outerDiameterMm:d,widthMm:w,heightMm:h,
    thicknessMm:nominalT,lengthM:metres,bars:pieces,
  }):null;
  const calculated=result?.ok?result:null;
  const descriptor=shape==="round"?`HSS round OD ${d}`:shape==="square"
    ?`HSS square ${w} × ${w}`:`HSS rectangular ${w} × ${h}`;
  const specification=calculated?[
    "Requested standard: ASTM A500/A500M-23 (grade and certificate to confirm)",
    `${descriptor} mm; nominal thickness ${nominalT} mm`,
    `AISC 0.93 wall design-section proxy: ${calculated.weightKgM.toFixed(3)} kg/m`,
    `${pieces} bars × ${metres} m; indicative total ${calculated.totalKg.toFixed(3)} kg`,
    "This is NOT manufacturer-published mass or an ASTM compliance assessment.",
    "Confirm specified grade, mill tolerances, availability, and certified delivered weight.",
  ].join("\n"):"";
  function setUnit(next:"mm"|"in"){
    if(units===next)return;
    const conv=(s:string)=>{
      const n=parse(s);
      return Number.isFinite(n)?String(Number((next==="in"?n/25.4:n*25.4).toFixed(next==="in"?6:4))):s;
    };
    setDiameter(conv(diameter));setWidth(conv(width));setHeight(conv(height));
    setThickness(conv(thickness));setUnits(next);setStatus("");
  }
  function addRfq(){
    if(!calculated)return;
    const selection={
      mode:"hss" as const,productStandard:"astm-a500" as const,hssShape:shape,
      ...(shape==="round"?{outerDiameterMm:d}:{widthMm:w,
        ...(shape==="rectangular"?{heightMm:h}:{})}),
      thicknessMm:nominalT,lengthM:metres,bars:pieces,
    };
    const item=buildUsPipeRfqItem(selection,crypto.randomUUID());
    if(!item || !enqueueUsPipeRfq(window.sessionStorage,item)){
      setStatus(t.error);return;
    }
    window.location.assign(locale==="it"?"/distinta":"/en/distinta");
  }
  return (
    <section aria-label={t.title} className="rounded-xl border border-[#b4d2c4] bg-white p-4 sm:p-5">
      <h3 className="text-lg font-bold text-[#123b34]">{t.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">{t.summary}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#123b34]">{t.shape}
          <select value={shape} onChange={e=>setShape(e.target.value as HssShape)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-[#123b34]">
            <option value="round">{t.round}</option>
            <option value="square">{t.square}</option>
            <option value="rectangular">{t.rectangular}</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t.unit}>
          <button type="button" aria-pressed={units==="mm"} onClick={()=>setUnit("mm")}
            className="min-h-12 rounded-lg border border-[#8da99d] px-4 text-sm font-bold text-[#123b34]">mm</button>
          <button type="button" aria-pressed={units==="in"} onClick={()=>setUnit("in")}
            className="min-h-12 rounded-lg border border-[#8da99d] px-4 text-sm font-bold text-[#123b34]">in</button>
        </div>
        {(shape==="round"?[[t.od,diameter,setDiameter]]:shape==="square"
          ?[[t.width,width,setWidth]]:[[t.width,width,setWidth],[t.height,height,setHeight]]).map(([label,value,update])=>(
          <label key={label as string} className="text-xs font-semibold text-[#123b34]">{label as string} ({units})
            <input type="text" inputMode="decimal" value={value as string}
              onChange={e=>(update as (v:string)=>void)(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
        ))}
        <label className="text-xs font-semibold text-[#123b34]">{t.thickness} ({units})
          <input type="text" inputMode="decimal" value={thickness} onChange={e=>setThickness(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
        </label>
        <label className="text-xs font-semibold text-[#123b34]">{t.length}
          <input type="text" inputMode="decimal" value={length} onChange={e=>setLength(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
        </label>
        <label className="text-xs font-semibold text-[#123b34]">{t.bars}
          <input type="text" inputMode="numeric" value={bars} onChange={e=>setBars(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
        </label>
      </div>
      <p className="mt-4 text-xs font-semibold text-[#1a5144]">{t.model}</p>
      {calculated?<div className="mt-3 grid gap-3 rounded-xl bg-[#f1f8f3] p-4 sm:grid-cols-2">
        <div><p className="text-xs text-[#52615b]">{t.weight}</p>
          <p className="text-xl font-bold text-[#123b34]">{format(calculated.weightKgM,locale)} kg/m</p>
          <p className="text-xs text-[#52615b]">{format(calculated.weightKgM/1.48816394357,locale)} lb/ft</p>
        </div>
        <div><p className="text-xs text-[#52615b]">{t.total}</p>
          <p className="text-xl font-bold text-[#123b34]">{format(calculated.totalKg,locale)} kg</p>
          <p className="text-xs text-[#52615b]">{format(calculated.totalTonnes,locale)} t</p>
        </div>
      </div>:<p role="status" className="mt-3 text-sm font-semibold text-[#985c25]">{t.invalid}</p>}
      <p className="mt-3 text-xs leading-6 text-[#52615b]">{t.status}
        {" "}<a href={SOURCE} className="font-semibold text-[#156449] underline" rel="noopener noreferrer" target="_blank">{t.source} →</a>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled={!calculated} type="button" onClick={async()=>{
          try{await navigator.clipboard.writeText(specification);setStatus(t.copied);}
          catch{setStatus(t.copyError);}
        }} className="min-h-12 rounded-xl border border-[#1a5144] px-4 text-sm font-bold text-[#123b34] disabled:opacity-50">
          {t.copy}
        </button>
        <button disabled={!calculated} type="button" onClick={addRfq}
          className="min-h-12 rounded-xl bg-[#123b34] px-4 text-sm font-bold text-white disabled:opacity-50">
          {t.add} →
        </button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs text-[#52615b]">{status}</p>
    </section>
  );
}
