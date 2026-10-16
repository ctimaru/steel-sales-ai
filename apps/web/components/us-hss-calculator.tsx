"use client";

import { useState } from "react";
import { trackInternationalRfq } from "@/lib/international-rfq-analytics.client";
import { US_HSS_I18N, usLocaleTag, usRfqBillPath, type UsCalculatorLocale } from "@/lib/us-calculator-i18n";

import { estimatePublicTubeMass } from "@/lib/international-tube-mass";
import { buildUsPipeRfqItem, enqueueUsPipeRfq } from "@/lib/us-pipe-rfq-handoff";
import {
  findHssReference, hssReferenceRowsForShape, hssNominalPublishedKgM,
  hssAtlasSourceUrl, searchHssReferences, hssAvailableWalls,
} from "@/lib/us-hss-reference-samples";

type HssShape="round"|"square"|"rectangular";
type Locale=UsCalculatorLocale;
const text={
  it:{
    title:"HSS strutturali ASTM A500",
    summary:"Profilati tondi, quadri e rettangolari. Massa indicativa calcolata con le convenzioni AISC per le proprietà di sezione; non è il peso effettivo certificato dal produttore.",
    shape:"Sezione",round:"Tondo HSS",square:"Quadro SHS",rectangular:"Rettangolare RHS",
    searchLabel:"Cerca misura HSS",searchPlaceholder:"Es. 6x4, 1/4, 0.375",wallFilter:"Spessore nominale",allWalls:"Tutti gli spessori",clearFilters:"Azzera filtri",noMatches:"Nessuna misura verificata per questi filtri; usa dimensioni personalizzate.",matches:"misure trovate",selectedOutside:"Misura selezionata (fuori dai filtri)",
    library:"Libreria misure USA · Atlas Tube",free:"Dimensioni personalizzate",sourceWeight:"Peso nominale pubblicato Atlas",comparison:"Differenza rispetto alla massa AISC",sourceRow:"Tabella Atlas Tube, pagina",libraryCaveat:"Peso nominale di catalogo, NON massa AISC, peso effettivo o certificazione. Disponibilità e conformità da confermare.",
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
    searchLabel:"Search HSS sizes",searchPlaceholder:"e.g. 6x4, 1/4, 0.375",wallFilter:"Nominal wall filter",allWalls:"All wall sizes",clearFilters:"Clear filters",noMatches:"No source-backed size matches; use custom dimensions.",matches:"sizes found",selectedOutside:"Selected size (outside filters)",
    library:"US size library · Atlas Tube",free:"Custom dimensions",sourceWeight:"Atlas published nominal weight",comparison:"Difference from AISC estimate",sourceRow:"Atlas Tube table, page",libraryCaveat:"Manufacturer nominal catalog weight, NOT AISC design mass, delivered weight or certification. Verify availability and conformity.",
    unit:"Units",od:"Outside diameter",width:"Outside width",height:"Outside height",
    thickness:"Nominal wall",length:"Bar length (m)",bars:"Number of bars",
    model:"AISC model: design wall = 0.93 × nominal wall; outside radius = 2 × design wall for SHS/RHS.",
    status:"ASTM A500 describes product requirements; user dimensions do not establish certification. Confirm grade, producer, tolerances, radii and delivered mass.",
    weight:"AISC indicative mass",total:"Indicative total mass",invalid:"Check geometry, thickness, maximum 88-inch perimeter and quantities.",
    copy:"Copy HSS specification",add:"Add HSS to RFQ bill",
    copied:"Specification copied",copyError:"Copy unavailable",error:"Could not prepare RFQ bill in this tab.",
    source:"Technical sources: Steel Tube Institute and AISC",
  },
  ...US_HSS_I18N,
} as const;
const parse=(s:string)=>{
  const v=s.trim().replace(",",".");
  return /^\d+(?:\.\d+)?$/.test(v)?Number(v):NaN;
};
const format=(n:number,loc:Locale)=>new Intl.NumberFormat(usLocaleTag(loc),{maximumFractionDigits:3}).format(n);
const SOURCE="https://steeltubeinstitute.org/resources/filling-the-void-a-central-resource-for-designing-concrete-filled-hss-columns/";

export type UsHssSeed={
  hssShape?:string;hssUnits?:string;hssDiameter?:string;hssWidth?:string;
  hssHeight?:string;hssThickness?:string;hssLength?:string;hssQuantity?:string;
};
export function UsHssCalculator({locale,initialReferenceId,initialValues={}}:{
  locale:Locale;initialReferenceId?:string;initialValues?:UsHssSeed;
}){
  const initialReference=initialReferenceId?findHssReference(initialReferenceId):null;
  const initialUnits=initialValues.hssUnits==="mm"?"mm":"in";
  const seedDimension=(referenceIn:number|undefined,queryValue:string|undefined,fallback:number)=>{
    if(referenceIn===undefined)return String(queryValue??fallback);
    return String(Number((referenceIn*(initialUnits==="mm"?25.4:1)).toFixed(4)));
  };
  const t=text[locale];
  const [shape,setShape]=useState<HssShape>(initialReference?.shape??(["round","square","rectangular"].includes(initialValues.hssShape??"")?initialValues.hssShape as HssShape:"square"));
  const [referenceId,setReferenceId]=useState(initialReference?.id??"");
  const [searchText,setSearchText]=useState("");
  const [wallFilter,setWallFilter]=useState("");
  const [units,setUnits]=useState<"mm"|"in">(initialUnits);
  const [diameter,setDiameter]=useState(seedDimension(initialReference?.diameterIn,initialValues.hssDiameter,6));
  const [width,setWidth]=useState(seedDimension(initialReference?.widthIn,initialValues.hssWidth,6));
  const [height,setHeight]=useState(seedDimension(initialReference?.heightIn,initialValues.hssHeight,4));
  const [thickness,setThickness]=useState(seedDimension(initialReference?.nominalWallIn,initialValues.hssThickness,0.25));
  const [length,setLength]=useState(initialValues.hssLength??"12");
  const [bars,setBars]=useState(initialValues.hssQuantity??"1");
  const [status,setStatus]=useState("");
  const factor=units==="in"?25.4:1;
  const normalize=(value:string)=>Number((parse(value)*factor).toFixed(4));
  const d=normalize(diameter),w=normalize(width),h=normalize(height),nominalT=normalize(thickness);
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
  const reference=referenceId ? findHssReference(referenceId) : null;
  const filteredReferences=searchHssReferences({
    shape,query:searchText,nominalWallIn:wallFilter?Number(wallFilter):null,
  });
  const referenceOutsideFilter=reference && !filteredReferences.some(row=>row.id===reference.id);
  const walls=hssAvailableWalls(shape);
  const publishedKgM=reference ? hssNominalPublishedKgM(reference) : null;
  const i18n=locale==="it"||locale==="en"?null:US_HSS_I18N[locale];
  const descriptor=shape==="round"?`HSS round OD ${d}`:shape==="square"
    ?`HSS square ${w} × ${w}`:`HSS rectangular ${w} × ${h}`;
  const specification=calculated?[
    `${i18n?.specRequired??"Requested standard"}: ASTM A500/A500M-23 (${i18n?.specGrade??"grade and certificate to confirm"})`,
    `${descriptor} mm; ${i18n?.specThickness??"nominal thickness"} ${nominalT} mm`,
    `${i18n?.specAisc??"AISC 0.93 wall design-section proxy"}: ${calculated.weightKgM.toFixed(3)} kg/m`,
    `${pieces} ${i18n?.specBars??"bars"} × ${metres} m; ${i18n?.specTotal??"indicative total"} ${calculated.totalKg.toFixed(3)} kg`,
    ...(reference ? [
      `${i18n?.specPublished??"Atlas Tube published nominal reference"}: ${reference.manufacturerNominalLbFt} lb/ft; ${publishedKgM?.toFixed(3)} kg/m (PDF p.${reference.sourcePage}; ${reference.sourceRow}). NOT certified or design mass.`,
    ] : [i18n?.specNoPublished??"No manufacturer-published reference for user-entered geometry."]),
    i18n?.specCaveat??"The AISC calculation is not an ASTM compliance assessment.",
    "Confirm specified grade, mill tolerances, availability, and certified delivered weight.",
  ].join("\n"):"";
  function chooseReference(id:string){
    setReferenceId(id);
    const selected=findHssReference(id);
    if(!selected)return;
    setShape(selected.shape);
    setUnits("in");
    if(selected.diameterIn!==undefined)setDiameter(String(selected.diameterIn));
    if(selected.widthIn!==undefined)setWidth(String(selected.widthIn));
    if(selected.heightIn!==undefined)setHeight(String(selected.heightIn));
    setThickness(String(selected.nominalWallIn));
    setStatus("");
  }
  function editMeasurement(update:(value:string)=>void,value:string){
    // Immediately revoke manufacturer provenance if any dimension is edited.
    setReferenceId("");
    update(value);setStatus("");
  }
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
      ...(reference ? {hssReferenceId:reference.id} : {}),
    };
    const item=buildUsPipeRfqItem(selection,crypto.randomUUID());
    if(!item || !enqueueUsPipeRfq(window.sessionStorage,item)){
      setStatus(t.error);return;
    }
    if(locale!=="it")trackInternationalRfq("handoff",locale,{system:"us",standard:"astm-a500"});
    window.location.assign(usRfqBillPath(locale));
  }
  return (
    <section aria-label={t.title} className="rounded-xl border border-[#b4d2c4] bg-white p-4 sm:p-5">
      <h3 className="text-lg font-bold text-[#123b34]">{t.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">{t.summary}</p>
      <div className="mt-4 rounded-xl border border-[#d1e2d8] bg-[#f4faf6] p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <label className="text-xs font-semibold text-[#123b34]">{t.searchLabel}
            <input type="search" autoComplete="off" maxLength={64} value={searchText}
              placeholder={t.searchPlaceholder}
              onChange={e=>setSearchText(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
          <label className="text-xs font-semibold text-[#123b34]">{t.wallFilter}
            <select aria-label={t.wallFilter} value={wallFilter}
              onChange={e=>setWallFilter(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]">
              <option value="">{t.allWalls}</option>
              {walls.map(wall=>(
                <option key={wall} value={String(wall)}>{wall} in</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="text-xs font-semibold text-[#1a5144]">
            {filteredReferences.length} / {hssReferenceRowsForShape(shape).length} {t.matches}
          </p>
          {(searchText || wallFilter) ? <button type="button"
            onClick={()=>{setSearchText("");setWallFilter("");}}
            className="min-h-10 rounded-lg border border-[#9bb8a9] bg-white px-3 text-xs font-semibold text-[#165544]">
            {t.clearFilters}
          </button> : null}
        </div>
        <label className="mt-3 block text-xs font-semibold text-[#123b34]">{t.library}
          <select aria-label={t.library} value={referenceId}
            onChange={e=>chooseReference(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]">
            <option value="">{t.free}</option>
            {referenceOutsideFilter ? <option value={reference.id}>{reference.designation} · {t.selectedOutside}</option> : null}
            {filteredReferences.map(item=>(
              <option key={item.id} value={item.id}>{item.designation}</option>
            ))}
          </select>
        </label>
        {filteredReferences.length===0 ? <p role="status" className="mt-2 text-xs text-[#76542e]">{t.noMatches}</p> : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-[#123b34]">{t.shape}
          <select value={shape} onChange={e=>{setShape(e.target.value as HssShape);setReferenceId("");setSearchText("");setWallFilter("");setStatus("");}}
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
              onChange={e=>editMeasurement(update as (v:string)=>void,e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
        ))}
        <label className="text-xs font-semibold text-[#123b34]">{t.thickness} ({units})
          <input type="text" inputMode="decimal" value={thickness} onChange={e=>editMeasurement(setThickness,e.target.value)}
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
      {calculated && reference && publishedKgM!==null ? (
        <div className="mt-3 rounded-xl border border-[#b4d2c4] bg-[#f8fbf9] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[#52615b]">{t.sourceWeight}</p>
              <p className="text-lg font-bold text-[#123b34]">{format(reference.manufacturerNominalLbFt,locale)} lb/ft</p>
              <p className="text-xs text-[#52615b]">{format(publishedKgM,locale)} kg/m</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#52615b]">{t.comparison}</p>
              <p className="text-lg font-bold text-[#123b34]">{format(100*(publishedKgM/calculated.weightKgM-1),locale)}%</p>
              <p className="text-xs text-[#52615b]">{t.libraryCaveat}</p>
            </div>
          </div>
          <a href={hssAtlasSourceUrl(reference.shape)}
            rel="noopener noreferrer" target="_blank"
            className="mt-2 inline-block text-xs font-semibold text-[#156449] underline">
            {t.sourceRow} {reference.sourcePage} · {reference.sourceRow} ↗
          </a>
        </div>
      ) : null}
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
