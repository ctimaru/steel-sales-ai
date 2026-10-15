"use client";

import Link from "next/link";
import { UsHssCalculator } from "@/components/us-hss-calculator";
import { CalculatorFlagLanguages } from "@/components/calculator-flag-languages";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import { US_PIPE_I18N, usLocaleTag, type UsCalculatorLocale } from "@/lib/us-calculator-i18n";
import { useState } from "react";

import { estimatePublicTubeMass } from "@/lib/international-tube-mass";
import { buildUsPipeRfqItem, enqueueUsPipeRfq } from "@/lib/us-pipe-rfq-handoff";
import { standardById } from "@/lib/calculator-standards-registry";
import {
  US_PIPE_MANUFACTURER_SAMPLE, US_PIPE_MANUFACTURER_SOURCE, US_PIPE_MANUFACTURER_WEB_SOURCE,
  US_PIPE_MASS_CONVERSION, availableUsNps, rowsForNps,
} from "@/lib/us-pipe-catalog-sample";

type Locale = UsCalculatorLocale;
const labels = {
  it: {
    title:"Calcolatore tubi USA: NPS / Schedule e misure libere",
    catalogTab:"Misure NPS / Schedule",customTab:"Dimensioni libere",hssTab:"HSS · ASTM A500",
    customNote:"Inserisci direttamente diametro esterno e spessore, senza attribuire automaticamente NPS o Schedule.",
    units:"Unità", diameter:"Diametro esterno", wall:"Spessore",
    noPublished:"Nessun peso di catalogo: risultato solo teorico.",
    subtitle:"20 combinazioni selezionate dal catalogo U.S. Steel, più calcolo geometrico libero. Non è la tabella normativa ASME completa.",
    nps:"NPS nominale", schedule:"Schedule / Classe", purpose:"Norma di prodotto richiesta (solo contesto)",
    length:"Lunghezza barra (m)", bars:"Numero barre",
    dimension:"Geometria ricavata dal catalogo",
    theoretical:"Massa teorica calcolata", published:"Peso pubblicato da U.S. Steel",
    total:"Peso totale teorico", linear:"kg/m", lbft:"lb/ft",
    intent:"La norma selezionata identifica il prodotto richiesto, non cambia la formula geometrica e non attesta conformità, grado o PSL.",
    provenance:"Fonte produttore", page:"pagina", data:"Dati campione",
    disclaimer:"Il confronto può differire per arrotondamenti e criteri del catalogo. Verificare dimensioni, tolleranze, grado e requisiti con il fornitore.",
    copy:"Copia specifica", copied:"Specifiche copiate", failed:"Impossibile copiare",
    proceed:"Apri il calcolatore geometrico",
    addRfq:"Aggiungi alla distinta RFQ",
    addRfqFailed:"Impossibile aprire la distinta: verifica la sessione del browser.",
    bridge:"La distinta conserva la norma API/ASTM richiesta; NPS/Schedule compare soltanto per misure di catalogo. Massa geometrica teorica, mai certificata.",
    invalid:"Inserisci una lunghezza positiva e un numero intero di barre.",
    source:"Catalogo U.S. Steel — Pipe Tables",
  },
  en: {
    title:"US pipe calculator: NPS / Schedule and custom dimensions",
    catalogTab:"NPS / Schedule samples",customTab:"Custom dimensions",hssTab:"HSS · ASTM A500",
    customNote:"Enter actual outside diameter and wall thickness. No NPS or Schedule is assigned automatically.",
    units:"Units", diameter:"Outside diameter", wall:"Wall thickness",
    noPublished:"No published catalog mass: theoretical result only.",
    subtitle:"20 selected U.S. Steel manufacturer combinations plus custom geometric calculation. Not a complete ASME normative schedule table.",
    nps:"Nominal pipe size",schedule:"Schedule / Class",purpose:"Intended product specification (context only)",
    length:"Bar length (m)",bars:"Number of bars",
    dimension:"Manufacturer-reported geometry",
    theoretical:"Calculated theoretical mass",published:"U.S. Steel published catalog mass",
    total:"Total theoretical mass",linear:"kg/m",lbft:"lb/ft",
    intent:"The selected product standard expresses intended procurement context; it does not change the geometric formula or certify grade, PSL or conformity.",
    provenance:"Manufacturer source",page:"page",data:"Sample data",
    disclaimer:"The calculated and published masses may differ because of rounding and catalog conventions. Verify dimensions, tolerances, grade and delivery requirements with the supplier.",
    copy:"Copy specification",copied:"Specification copied",failed:"Copy unavailable",
    proceed:"Open geometric calculator",
    addRfq:"Add to RFQ bill",
    addRfqFailed:"Could not prepare the RFQ bill; check browser session storage.",
    bridge:"The RFQ carries the requested API/ASTM product context. NPS/Schedule is included only for sourced catalog sizes; mass remains theoretical, never certified.",
    invalid:"Enter a positive bar length and a positive whole number of bars.",
    source:"U.S. Steel Standard & Line Pipe Catalog — Pipe Tables",
  },
  ...US_PIPE_I18N,
} as const;

const productChoices = ["api5l", "astm-a53", "astm-a106"] as const;
const numberFormatter = (value:number, locale:Locale, digits=3) =>
  new Intl.NumberFormat(usLocaleTag(locale), { maximumFractionDigits:digits }).format(value);

export type UsPipeInitialValues={
  mode?:string;units?:string;customDiameter?:string;customWall?:string;
  nps?:string;rowId?:string;productStandard?:string;length?:string;bars?:string;
  hssReferenceId?:string;
};
export function UsPipeSampleCalculator({ locale,initialValues={} }: { locale:Locale;initialValues?:UsPipeInitialValues }) {
  const copy = labels[locale];
  const npsList = availableUsNps();
  const [inputMode,setInputMode] = useState<"catalog"|"custom"|"hss">(["catalog","custom","hss"].includes(initialValues.mode??"")?initialValues.mode as "catalog"|"custom"|"hss":"catalog");
  const [units,setUnits] = useState<"mm"|"in">(initialValues.units==="in"?"in":"mm");
  const [customDiameter,setCustomDiameter] = useState(initialValues.customDiameter??"114.3");
  const [customWall,setCustomWall] = useState(initialValues.customWall??"6.02");
  const [nps,setNps] = useState(availableUsNps().includes(initialValues.nps??"")?initialValues.nps!:"6");
  const [rowId,setRowId] = useState(US_PIPE_MANUFACTURER_SAMPLE.some(x=>x.id===initialValues.rowId)?initialValues.rowId!:"6-40");
  const [productStandard,setProductStandard] = useState<(typeof productChoices)[number]>(productChoices.includes(initialValues.productStandard as typeof productChoices[number])?initialValues.productStandard as typeof productChoices[number]:"api5l");
  const [length,setLength] = useState(initialValues.length??"12");
  const [bars,setBars] = useState(initialValues.bars??"1");
  const [copyState,setCopyState] = useState<"idle"|"copied"|"failed">("idle");
  const [rfqError,setRfqError] = useState(false);
  const row = US_PIPE_MANUFACTURER_SAMPLE.find((r)=>r.id===rowId && r.nps===nps) ?? rowsForNps(nps)[0];
  const parseInput = (v:string) => {
    const cleaned=v.trim().replace(",",".");
    return /^\d+(?:\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
  };
  const quantity=parseInput(bars);
  const metres=parseInput(length);
  const diameterInput=parseInput(customDiameter);
  const wallInput=parseInput(customWall);
  const factor=units==="in"?25.4:1;
  const customDiameterMm=diameterInput*factor;
  const customWallMm=wallInput*factor;
  const activeDiameter=inputMode==="custom"?customDiameterMm:row?.outerDiameterMm;
  const activeWall=inputMode==="custom"?customWallMm:row?.thicknessMm;
  const valid=Number.isSafeInteger(quantity) && quantity>0 && quantity<=1_000_000 &&
    Number.isFinite(metres) && metres>0 && metres<=1000;
  const dimensionValid=Number.isFinite(activeDiameter) && Number.isFinite(activeWall) &&
    activeDiameter! > 0 && activeDiameter!<=2500 && activeWall! > 0 &&
    activeWall!<=250 && activeWall!*2<activeDiameter!;
  const estimate = dimensionValid && valid ? estimatePublicTubeMass({
    shape:"round",standard:"geometric",outerDiameterMm:activeDiameter,
    thicknessMm:activeWall!,lengthM:metres,bars:quantity,
  }) : null;
  const result=estimate?.ok?estimate:null;
  const selectedStandard = standardById(productStandard);
  const params = result ? new URLSearchParams({
    standard:"geometric",family:"round_tube",
    od:String(activeDiameter),thickness:String(activeWall),
    length:String(metres),quantity:String(quantity),density:"7850",
  }) : null;
  const calculatorUrl = `${CALCULATOR_ROUTES[locale]}?${params?.toString() ?? ""}#calcolatore-pesi`;
  const resultLbFt = result ? result.weightKgM / US_PIPE_MASS_CONVERSION : 0;
  const languageQuery=new URLSearchParams({
    system:"us",usMode:inputMode,nps,rowId,productStandard,
    units,customDiameter,customWall,length,quantity:bars,
  }).toString();
  const sampleSource=row?.sourcePage!=null?US_PIPE_MANUFACTURER_SOURCE:US_PIPE_MANUFACTURER_WEB_SOURCE;
  const sampleLocator=row?.sourcePage!=null
    ? `${copy.page} ${row.sourcePage}` : (row?.sourceLocation ?? "Pipe Tables");
  function setMeasurementUnit(next:"mm"|"in") {
    if(next===units)return;
    const convert=(value:string) => {
      const numeric=parseInput(value);
      if(!Number.isFinite(numeric))return value;
      const converted=next==="in"?numeric/25.4:numeric*25.4;
      return String(Number(converted.toFixed(next==="in"?5:3)));
    };
    setCustomDiameter(convert(customDiameter));
    setCustomWall(convert(customWall));
    setUnits(next);
  }

  const addToRfqBill = () => {
    if (!result || !valid) return;
    const selection = inputMode==="custom"
      ? {mode:"custom" as const,outerDiameterMm:customDiameterMm,thicknessMm:customWallMm,
          productStandard,lengthM:metres,bars:quantity}
      : {sampleId:row.id,productStandard,lengthM:metres,bars:quantity};
    const item = buildUsPipeRfqItem(selection,crypto.randomUUID());
    if (!item || !enqueueUsPipeRfq(window.sessionStorage,item)) {
      setRfqError(true);
      return;
    }
    setRfqError(false);
    window.location.assign(locale === "it" ? "/distinta" : "/en/distinta");
  };

  const copiedText = () => {
    if (!result || !selectedStandard) return "";
    return [
      `Requested product specification (to verify): ${selectedStandard.title}`,
      inputMode==="catalog"
        ? `Manufacturer sample designation: NPS ${row.nps}, Sch/Class ${row.schedule}`
        : "User-supplied dimensions: no verified NPS/Schedule designation",
      `OD ${activeDiameter} mm, nominal wall ${activeWall} mm`,
      `Theoretical geometry-only mass: ${result.weightKgM.toFixed(3)} kg/m`,
      inputMode==="catalog"
        ? `Manufacturer-published reference: ${row.publishedWeightKgM} kg/m (U.S. Steel ${sampleLocator})`
        : "No manufacturer-published reference for user-supplied dimensions.",
      `Bars: ${quantity}, length: ${metres} m, theoretical total: ${result.totalKg.toFixed(3)} kg`,
      "Product grade, edition, PSL, tolerances, NPS/Schedule mapping and certification to be confirmed by supplier.",
    ].join("\\n");
  };

  return (
    <section aria-label={copy.title} className="rounded-2xl border border-[#c7ded3] bg-white p-4 shadow-sm sm:p-6">
      {inputMode!=="hss"?<div className="mb-3 flex justify-end">
        <CalculatorFlagLanguages locale={locale} query={languageQuery}/>
      </div>:null}
      <h2 className="text-xl font-bold text-[#123b34]">{copy.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">{copy.subtitle}</p>
      <div role="group" aria-label={locale==="it"?"Modalità dimensionale USA":locale==="en"?"US dimensional mode":copy.dimensionalMode}
        className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-[#eaf3ed] p-1">
        <button type="button" aria-pressed={inputMode==="catalog"} onClick={()=>setInputMode("catalog")}
          className={inputMode==="catalog"?"min-h-12 rounded-lg bg-[#165544] px-3 text-xs font-bold text-white":"min-h-12 rounded-lg px-3 text-xs font-bold text-[#123b34]"}>
          {copy.catalogTab}
        </button>
        <button type="button" aria-pressed={inputMode==="custom"} onClick={()=>setInputMode("custom")}
          className={inputMode==="custom"?"min-h-12 rounded-lg bg-[#165544] px-3 text-xs font-bold text-white":"min-h-12 rounded-lg px-3 text-xs font-bold text-[#123b34]"}>
          {copy.customTab}
        </button>
        <button type="button" aria-pressed={inputMode==="hss"} onClick={()=>setInputMode("hss")}
          className={inputMode==="hss"?"min-h-12 rounded-lg bg-[#165544] px-2 text-xs font-bold text-white":"min-h-12 rounded-lg px-2 text-xs font-bold text-[#123b34]"}>
          {copy.hssTab}
        </button>
      </div>
      <div hidden={inputMode==="hss"} inert={inputMode==="hss"} aria-hidden={inputMode==="hss"}>
      {inputMode==="custom" ? <div className="mt-3 space-y-3 rounded-xl border border-[#a8c4b6] bg-[#f1f8f3] p-3">
        <p className="text-xs leading-5 text-[#355b4a]">{copy.customNote}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-[#123b34]">{copy.units}</span>
          <button type="button" aria-pressed={units==="mm"} onClick={()=>setMeasurementUnit("mm")}
            className="min-h-11 rounded-lg border border-[#8da99d] px-4 text-xs font-bold text-[#123b34]">mm</button>
          <button type="button" aria-pressed={units==="in"} onClick={()=>setMeasurementUnit("in")}
            className="min-h-11 rounded-lg border border-[#8da99d] px-4 text-xs font-bold text-[#123b34]">in</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-[#123b34]">{copy.diameter} ({units})
            <input type="text" inputMode="decimal" value={customDiameter}
              onChange={e=>setCustomDiameter(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
          <label className="text-xs font-semibold text-[#123b34]">{copy.wall} ({units})
            <input type="text" inputMode="decimal" value={customWall}
              onChange={e=>setCustomWall(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
        </div>
      </div> : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {inputMode==="catalog" ? <>
        <label className="text-xs font-semibold text-[#123b34]">{copy.nps}
          <select value={nps} onChange={e=>{const next=e.target.value;setNps(next);setRowId(rowsForNps(next)[0]?.id ?? "");}}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]">
            {npsList.map(v=><option key={v} value={v}>NPS {v}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#123b34]">{copy.schedule}
          <select value={row?.id ?? ""} onChange={e=>setRowId(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]">
            {rowsForNps(nps).map(r=><option key={r.id} value={r.id}>Sch {r.schedule}{r.classLabel && r.classLabel!==r.schedule ? ` · ${r.classLabel}` : ""}</option>)}
          </select>
        </label>
        </> : null}
        <label className="text-xs font-semibold text-[#123b34]">{copy.purpose}
          <select value={productStandard} onChange={e=>setProductStandard(e.target.value as typeof productStandard)}
            className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]">
            {productChoices.map(id=><option key={id} value={id}>{standardById(id)?.title ?? id}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-[#123b34]">{copy.length}
            <input type="text" inputMode="decimal" value={length} onChange={e=>setLength(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
          <label className="text-xs font-semibold text-[#123b34]">{copy.bars}
            <input type="text" inputMode="numeric" value={bars} onChange={e=>setBars(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-[#8da99d] bg-white px-3 text-sm text-[#123b34]"/>
          </label>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#52615b]">{copy.intent}</p>
      <div className="mt-5 rounded-xl bg-[#f2f7f4] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#1a5144]">
          {inputMode==="catalog"?copy.dimension:copy.customNote}
        </p>
        <p className="mt-1 text-sm font-semibold text-[#123b34]">
          {inputMode==="catalog"?`NPS ${row.nps} · Sch ${row.schedule} · `:""}
          OD {numberFormatter(activeDiameter ?? 0,locale,2)} mm · t {numberFormatter(activeWall ?? 0,locale,2)} mm
        </p>
        {result ? <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs text-[#52615b]">{copy.theoretical}</p>
            <p className="text-xl font-bold text-[#123b34]">{numberFormatter(result.weightKgM,locale)} kg/m</p>
            <p className="text-xs text-[#52615b]">{numberFormatter(resultLbFt,locale)} lb/ft</p></div>
          <div><p className="text-xs text-[#52615b]">{copy.published}</p>
            {inputMode==="catalog" ? <>
              <p className="text-xl font-bold text-[#123b34]">{numberFormatter(row.publishedWeightKgM,locale,2)} kg/m</p>
              <p className="text-xs text-[#52615b]">{numberFormatter(row.publishedWeightLbFt,locale,2)} lb/ft</p>
            </> : <p className="text-xs font-semibold leading-5 text-[#52615b]">{copy.noPublished}</p>}
          </div>
          <div><p className="text-xs text-[#52615b]">{copy.total}</p>
            <p className="text-xl font-bold text-[#123b34]">{numberFormatter(result.totalKg,locale)} kg</p>
            <p className="text-xs text-[#52615b]">{numberFormatter(result.totalTonnes,locale)} t</p>
          </div>
        </div> : <p role="status" className="mt-3 text-sm font-semibold text-[#8b4a25]">{copy.invalid}</p>}
      </div>
      {inputMode==="catalog" ? <p className="mt-4 text-xs leading-6 text-[#52615b]">{copy.disclaimer}
        <a className="font-semibold text-[#156449] underline" href={sampleSource} target="_blank" rel="noopener noreferrer">
          {copy.source} — {sampleLocator}
        </a>.
      </p> : <p className="mt-4 text-xs leading-6 text-[#52615b]">{copy.noPublished} {copy.disclaimer}</p>}
      <p className="mt-1 text-xs leading-5 text-[#52615b]">{copy.bridge}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={!result}
          onClick={async()=>{try{await navigator.clipboard.writeText(copiedText());setCopyState("copied");}catch{setCopyState("failed");}}}
          className="min-h-12 rounded-xl border border-[#1a5144] bg-white px-4 text-sm font-bold text-[#123b34] disabled:opacity-50">
          {copy.copy}
        </button>
        <button type="button" disabled={!result} onClick={addToRfqBill}
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#123b34] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {copy.addRfq} →
        </button>
        <Link href={calculatorUrl} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#1a5144] bg-white px-4 text-sm font-bold text-[#123b34]">
          {copy.proceed} →
        </Link>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs text-[#52615b]">
        {rfqError ? copy.addRfqFailed : ""}
        {copyState==="copied"?copy.copied:copyState==="failed"?copy.failed:""}
      </p>
      </div>
      <div hidden={inputMode!=="hss"} inert={inputMode!=="hss"} aria-hidden={inputMode!=="hss"} className="mt-4">
        <UsHssCalculator locale={locale} initialReferenceId={initialValues.hssReferenceId}/>
      </div>
    </section>
  );
}
