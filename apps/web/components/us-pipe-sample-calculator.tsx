"use client";

import Link from "next/link";
import { UsHssCalculator } from "@/components/us-hss-calculator";
import { CalculatorCommercialPricing } from "@/components/calculator-commercial-pricing";
import { localizedInlineBill } from "@/lib/calculator-inline-distinta-copy";
import type { PriceBasis } from "@/lib/calculator-commercial-pricing";
import { trackInternationalRfq } from "@/lib/international-rfq-analytics.client";
import { CALCULATOR_ROUTES } from "@/lib/international-calculator-landing";
import { US_PIPE_I18N, usLocaleTag, usRfqBillPath, type UsCalculatorLocale } from "@/lib/us-calculator-i18n";
import { useState } from "react";
import { usCalculatorUi as ui } from "@/lib/us-calculator-visual";

import { estimatePublicTubeMass } from "@/lib/international-tube-mass";
import { buildUsPipeRfqItem, enqueueUsPipeRfq, type UsPipeRfqItem } from "@/lib/us-pipe-rfq-handoff";
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
  hssShape?:string;hssUnits?:string;hssDiameter?:string;hssWidth?:string;
  hssHeight?:string;hssThickness?:string;hssLength?:string;hssQuantity?:string;
};
export function UsPipeSampleCalculator({ locale,initialValues={},onAddToDistinta,canAddToDistinta=true,inlineBillCount=0,onChooseBuyerTarget }: {
  locale: Locale; initialValues?: UsPipeInitialValues;
  onAddToDistinta?: (item: UsPipeRfqItem) => boolean;
  canAddToDistinta?: boolean;
  inlineBillCount?: number;
  onChooseBuyerTarget?: (value: {basis: PriceBasis; raw: string; weightKgM: number}) => void;
}) {
  const copy = labels[locale];
  const billCopy = localizedInlineBill(locale);
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
  const [inlineAdded,setInlineAdded] = useState(false);
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
    if (!item) { setRfqError(true); setInlineAdded(false); return; }
    if (onAddToDistinta) {
      const added = canAddToDistinta && onAddToDistinta(item);
      setRfqError(!added); setInlineAdded(added);
      return; // The EU + US bill is already visible on this page.
    }
    if (!enqueueUsPipeRfq(window.sessionStorage,item)) {
      setRfqError(true); return;
    }
    setRfqError(false);
    if(locale!=="it")trackInternationalRfq("handoff",locale,{system:"us",standard:productStandard});
    window.location.assign(usRfqBillPath(locale));
  };

  const copiedText = () => {
    if (!result || !selectedStandard) return "";
    const i18n=locale==="it"||locale==="en"?null:US_PIPE_I18N[locale];
    return [
      `${i18n?.clipProduct??"Requested product specification (to verify)"}: ${selectedStandard.title}`,
      inputMode==="catalog"
        ? `${i18n?.clipCatalog??"Manufacturer sample designation"}: NPS ${row.nps}, Sch/Class ${row.schedule}`
        : (i18n?.clipCustom??"User-supplied dimensions: no verified NPS/Schedule designation"),
      `OD ${activeDiameter} mm, nominal wall ${activeWall} mm`,
      `${i18n?.clipGeometry??"Theoretical geometry-only mass"}: ${result.weightKgM.toFixed(3)} kg/m`,
      inputMode==="catalog"
        ? `${i18n?.clipPublished??"Manufacturer-published reference"}: ${row.publishedWeightKgM} kg/m (U.S. Steel ${sampleLocator})`
        : (i18n?.clipNoPublished??"No manufacturer-published reference for user-supplied dimensions."),
      `${i18n?.clipBars??"Bars"}: ${quantity}, ${copy.length}: ${metres} m, ${copy.total}: ${result.totalKg.toFixed(3)} kg`,
      i18n?.clipFooter??"Product grade, edition, PSL, tolerances, NPS/Schedule mapping and certification to be confirmed by supplier.",
    ].join("\\n");
  };

  return (
    <section aria-label={copy.title} data-us-calculator className={ui.shell}>
      <header className={ui.header}>
        <p className={ui.eyebrow}>USA · NPS / SCHEDULE · ASTM / API</p>
        <h2 className={ui.heading}>{copy.title}</h2>
        <p className={ui.headingDescription}>{copy.subtitle}</p>
      </header>
      <div role="group" aria-label={locale==="it"?"Modalità dimensionale USA":locale==="en"?"US dimensional mode":US_PIPE_I18N[locale].dimensionalMode}
        className={ui.selector + " mx-3 mt-3 sm:mx-4"}>
        <button type="button" aria-pressed={inputMode==="catalog"} onClick={()=>setInputMode("catalog")}
          className={ui.selectorButton + " " + (inputMode==="catalog" ? ui.selectorActive : ui.selectorIdle)}>
          {copy.catalogTab}
        </button>
        <button type="button" aria-pressed={inputMode==="custom"} onClick={()=>setInputMode("custom")}
          className={ui.selectorButton + " " + (inputMode==="custom" ? ui.selectorActive : ui.selectorIdle)}>
          {copy.customTab}
        </button>
        <button type="button" aria-pressed={inputMode==="hss"} onClick={()=>setInputMode("hss")}
          className={ui.selectorButton + " " + (inputMode==="hss" ? ui.selectorActive : ui.selectorIdle)}>
          {copy.hssTab}
        </button>
      </div>
      <div hidden={inputMode==="hss"} inert={inputMode==="hss"} aria-hidden={inputMode==="hss"} className={inputMode==="hss" ? "hidden" : ui.columns + " mt-3"}>
        <div className={ui.inputs}>
      {inputMode==="custom" ? <div className="space-y-3 rounded-xl border border-[#dce7e1] bg-[#f7faf8] p-3">
        <p className="text-xs leading-5 text-[#355b4a]">{copy.customNote}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={ui.smallTitle}>{copy.units}</span>
          <button type="button" aria-pressed={units==="mm"} onClick={()=>setMeasurementUnit("mm")}
            className={ui.miniButton + " " + (units==="mm" ? ui.selectorActive : ui.selectorIdle)}>mm</button>
          <button type="button" aria-pressed={units==="in"} onClick={()=>setMeasurementUnit("in")}
            className={ui.miniButton + " " + (units==="in" ? ui.selectorActive : ui.selectorIdle)}>in</button>
        </div>
        <div className={ui.fieldGrid}>
          <label className={ui.label}>{copy.diameter} ({units})
            <input type="text" inputMode="decimal" value={customDiameter}
              onChange={e=>setCustomDiameter(e.target.value)}
              className={ui.input}/>
          </label>
          <label className={ui.label}>{copy.wall} ({units})
            <input type="text" inputMode="decimal" value={customWall}
              onChange={e=>setCustomWall(e.target.value)}
              className={ui.input}/>
          </label>
        </div>
      </div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {inputMode==="catalog" ? <>
        <label className={ui.label}>{copy.nps}
          <select value={nps} onChange={e=>{const next=e.target.value;setNps(next);setRowId(rowsForNps(next)[0]?.id ?? "");}}
            className={ui.input}>
            {npsList.map(v=><option key={v} value={v}>NPS {v}</option>)}
          </select>
        </label>
        <label className={ui.label}>{copy.schedule}
          <select value={row?.id ?? ""} onChange={e=>setRowId(e.target.value)}
            className={ui.input}>
            {rowsForNps(nps).map(r=><option key={r.id} value={r.id}>Sch {r.schedule}{r.classLabel && r.classLabel!==r.schedule ? ` · ${r.classLabel}` : ""}</option>)}
          </select>
        </label>
        </> : null}
        <label className={ui.label}>{copy.purpose}
          <select value={productStandard} onChange={e=>setProductStandard(e.target.value as typeof productStandard)}
            className={ui.input}>
            {productChoices.map(id=><option key={id} value={id}>{standardById(id)?.title ?? id}</option>)}
          </select>
        </label>
        <div className={ui.fieldGrid}>
          <label className={ui.label}>{copy.length}
            <input type="text" inputMode="decimal" value={length} onChange={e=>setLength(e.target.value)}
              className={ui.input}/>
          </label>
          <label className={ui.label}>{copy.bars}
            <input type="text" inputMode="numeric" value={bars} onChange={e=>setBars(e.target.value)}
              className={ui.input}/>
          </label>
        </div>
      </div>
      <p className={ui.hint + " mt-3"}>{copy.intent}</p>
      </div>
        <aside className={ui.results} aria-live="polite">
        <div className="rounded-xl border border-white/15 bg-white/5 p-3">
        <p className={ui.resultTitle}>
          {inputMode==="catalog"?copy.dimension:copy.customNote}
        </p>
        <p className="mt-1 text-sm font-semibold text-white">
          {inputMode==="catalog"?`NPS ${row.nps} · Sch ${row.schedule} · `:""}
          OD {numberFormatter(activeDiameter ?? 0,locale,2)} mm · t {numberFormatter(activeWall ?? 0,locale,2)} mm
        </p>
        {result ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className={ui.resultCard}><p className={ui.resultTitle}>{copy.theoretical}</p>
            <p className={ui.resultValue}>{numberFormatter(result.weightKgM,locale)} kg/m</p>
            <p className={ui.resultHint}>{numberFormatter(resultLbFt,locale)} lb/ft</p></div>
          <div className={ui.resultCard}><p className={ui.resultTitle}>{copy.published}</p>
            {inputMode==="catalog" ? <>
              <p className={ui.resultValue}>{numberFormatter(row.publishedWeightKgM,locale,2)} kg/m</p>
              <p className={ui.resultHint}>{numberFormatter(row.publishedWeightLbFt,locale,2)} lb/ft</p>
            </> : <p className={ui.resultHint}>{copy.noPublished}</p>}
          </div>
          <div className={ui.resultCard + " sm:col-span-2"}><p className={ui.resultTitle}>{copy.total}</p>
            <p className={ui.resultValue}>{numberFormatter(result.totalKg,locale)} kg</p>
            <p className={ui.resultHint}>{numberFormatter(result.totalTonnes,locale)} t</p>
          </div>
        </div> : <p role="status" className="mt-3 text-sm font-semibold text-[#ffcf9d]">{copy.invalid}</p>}
      </div>
      <details data-us-technical-details className={ui.detail}>
        <summary className={ui.detailSummary}>{copy.provenance} · {copy.source}<span aria-hidden="true">⌄</span></summary>
        <div className="border-t border-white/15 p-3 text-xs leading-6 text-white/80">
        {inputMode==="catalog" ? <p>{copy.disclaimer}
        <a className="font-semibold text-white underline" href={sampleSource} target="_blank" rel="noopener noreferrer">
          {copy.source} — {sampleLocator}
        </a>.
      </p> : <p>{copy.noPublished} {copy.disclaimer}</p>}
        <p className="mt-2">{copy.bridge}</p>
        </div>
      </details>
      <CalculatorCommercialPricing weightKgM={result?.weightKgM ?? null} locale={locale}
        onChooseBuyerTarget={onChooseBuyerTarget} />
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" disabled={!result}
          onClick={async()=>{try{await navigator.clipboard.writeText(copiedText());setCopyState("copied");}catch{setCopyState("failed");}}}
          className={ui.secondaryAction + " order-2"}>
          {copy.copy}
        </button>
        <button data-us-add-to-inline-bill={onAddToDistinta ? "" : undefined} type="button"
          disabled={!result || (Boolean(onAddToDistinta) && !canAddToDistinta)} onClick={addToRfqBill}
          className={ui.primaryAction + " order-1"}>
          {copy.addRfq} →
        </button>
        <Link href={calculatorUrl} className={ui.secondaryAction + " order-3"}>
          {copy.proceed} →
        </Link>
      </div>
      {onAddToDistinta && inlineBillCount > 0 ? (
        <a href="#distinta-inline" className={ui.secondaryAction + " mt-2"}>
          {billCopy.seeBill} · {inlineBillCount} {inlineBillCount===1 ? billCopy.row : billCopy.lines} ↓
        </a>
      ) : null}
      <p role="status" aria-live="polite" className={ui.resultHint}>
        {rfqError ? billCopy.addError : inlineAdded ? billCopy.added : ""}
        {copyState==="copied"?copy.copied:copyState==="failed"?copy.failed:""}
      </p>
        </aside>
      </div>
      <div hidden={inputMode!=="hss"} inert={inputMode!=="hss"} aria-hidden={inputMode!=="hss"} className="mt-3">
        <UsHssCalculator locale={locale} initialReferenceId={initialValues.hssReferenceId} initialValues={initialValues}
          onAddToDistinta={onAddToDistinta} canAddToDistinta={canAddToDistinta}
          inlineBillCount={inlineBillCount} onChooseBuyerTarget={onChooseBuyerTarget}/>
      </div>
    </section>
  );
}
