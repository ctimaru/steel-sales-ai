"use client";

import Link from "next/link";
import { useState } from "react";

import { estimatePublicTubeMass } from "@/lib/international-tube-mass";
import { buildUsPipeRfqItem, enqueueUsPipeRfq } from "@/lib/us-pipe-rfq-handoff";
import { standardById } from "@/lib/calculator-standards-registry";
import {
  US_PIPE_MANUFACTURER_SAMPLE, US_PIPE_MANUFACTURER_SOURCE,
  US_PIPE_MASS_CONVERSION, availableUsNps, rowsForNps,
} from "@/lib/us-pipe-catalog-sample";

type Locale = "it" | "en";
const labels = {
  it: {
    title:"Seleziona un tubo NPS / Schedule",
    subtitle:"Campione non esaustivo di dimensioni del produttore U.S. Steel; non è la tabella normativa ASME completa.",
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
    bridge:"La distinta conserva la specifica API/ASTM come richiesta da confermare, insieme ai dati NPS/Schedule. Il peso resta geometrico teorico, mai certificato.",
    invalid:"Inserisci una lunghezza positiva e un numero intero di barre.",
    source:"Catalogo U.S. Steel — Pipe Tables",
  },
  en: {
    title:"Select an NPS / Schedule sample",
    subtitle:"A limited U.S. Steel manufacturer dimensional sample, not a complete ASME normative schedule table.",
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
    bridge:"The RFQ bill carries the requested API/ASTM designation and NPS/Schedule context for supplier confirmation. The mass remains a geometric estimate, never a certified weight.",
    invalid:"Enter a positive bar length and a positive whole number of bars.",
    source:"U.S. Steel Standard & Line Pipe Catalog — Pipe Tables",
  },
} as const;

const productChoices = ["api5l", "astm-a53", "astm-a106"] as const;
const numberFormatter = (value:number, locale:Locale, digits=3) =>
  new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-US", { maximumFractionDigits:digits }).format(value);

export function UsPipeSampleCalculator({ locale }: { locale:Locale }) {
  const copy = labels[locale];
  const npsList = availableUsNps();
  const [nps,setNps] = useState("6");
  const [rowId,setRowId] = useState("6-40");
  const [productStandard,setProductStandard] = useState<(typeof productChoices)[number]>("api5l");
  const [length,setLength] = useState("12");
  const [bars,setBars] = useState("1");
  const [copyState,setCopyState] = useState<"idle"|"copied"|"failed">("idle");
  const [rfqError,setRfqError] = useState(false);
  const row = US_PIPE_MANUFACTURER_SAMPLE.find((r)=>r.id===rowId && r.nps===nps) ?? rowsForNps(nps)[0];
  const quantity=Number(bars.trim().replace(",","."));
  const metres=Number(length.trim().replace(",","."));
  const valid = Boolean(bars.trim() && length.trim() && Number.isSafeInteger(quantity) && quantity>0 &&
    Number.isFinite(metres) && metres>0 && metres<=1000);
  const estimate = row && valid ? estimatePublicTubeMass({
    shape:"round",standard:"geometric",outerDiameterMm:row.outerDiameterMm,
    thicknessMm:row.thicknessMm,lengthM:metres,bars:quantity,
  }) : null;
  const result = estimate?.ok ? estimate : null;
  const selectedStandard = standardById(productStandard);
  const params = row ? new URLSearchParams({
    standard:"geometric",family:"round_tube",
    od:String(row.outerDiameterMm),thickness:String(row.thicknessMm),
    length:valid?String(metres):"12",quantity:valid?String(quantity):"1",
    density:"7850",
  }) : null;
  const calculatorUrl = `${locale === "it" ? "/knowledge/tubes" : "/en/knowledge/tubes"}?${params?.toString() ?? ""}#calcolatore-pesi`;
  const resultLbFt = result ? result.weightKgM / US_PIPE_MASS_CONVERSION : 0;

  const addToRfqBill = () => {
    if (!row || !result || !valid) return;
    const item = buildUsPipeRfqItem(
      {sampleId:row.id,productStandard,lengthM:metres,bars:quantity},
      crypto.randomUUID(),
    );
    if (!item || !enqueueUsPipeRfq(window.sessionStorage,item)) {
      setRfqError(true);
      return;
    }
    setRfqError(false);
    window.location.assign(locale === "it" ? "/distinta" : "/en/distinta");
  };

  const copiedText = () => {
    if (!row || !result || !selectedStandard) return "";
    return [
      `Requested product specification (to verify): ${selectedStandard.title}`,
      `Manufacturer sample designation: NPS ${row.nps}, Sch/Class ${row.schedule}`,
      `OD ${row.outerDiameterMm} mm, nominal wall ${row.thicknessMm} mm`,
      `Theoretical geometry-only mass: ${result.weightKgM.toFixed(3)} kg/m`,
      `Manufacturer-published reference: ${row.publishedWeightKgM} kg/m (U.S. Steel catalog p. ${row.sourcePage})`,
      `Bars: ${quantity}, length: ${metres} m, theoretical total: ${result.totalKg.toFixed(3)} kg`,
      "Product grade, edition, PSL, tolerances, and certification to be confirmed by supplier.",
    ].join("\n");
  };

  return (
    <section aria-label={copy.title} className="rounded-2xl border border-[#c7ded3] bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-[#123b34]">{copy.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">{copy.subtitle}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
      {row ? <div className="mt-5 rounded-xl bg-[#f2f7f4] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#1a5144]">{copy.dimension}</p>
        <p className="mt-1 text-sm font-semibold text-[#123b34]">NPS {row.nps} · Sch {row.schedule} · OD {numberFormatter(row.outerDiameterMm,locale,2)} mm · t {numberFormatter(row.thicknessMm,locale,2)} mm</p>
        {result ? <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-[#52615b]">{copy.theoretical}</p><p className="text-xl font-bold text-[#123b34]">{numberFormatter(result.weightKgM,locale)} kg/m</p><p className="text-xs text-[#52615b]">{numberFormatter(resultLbFt,locale)} lb/ft</p></div>
            <div><p className="text-xs text-[#52615b]">{copy.published}</p><p className="text-xl font-bold text-[#123b34]">{numberFormatter(row.publishedWeightKgM,locale,2)} kg/m</p><p className="text-xs text-[#52615b]">{numberFormatter(row.publishedWeightLbFt,locale,2)} lb/ft</p></div>
            <div><p className="text-xs text-[#52615b]">{copy.total}</p><p className="text-xl font-bold text-[#123b34]">{numberFormatter(result.totalKg,locale)} kg</p><p className="text-xs text-[#52615b]">{numberFormatter(result.totalTonnes,locale)} t</p></div>
          </div>
        </>:<p role="status" className="mt-3 text-sm font-semibold text-[#8b4a25]">{copy.invalid}</p>}
      </div> : null}
      <p className="mt-4 text-xs leading-6 text-[#52615b]">{copy.disclaimer} <a className="font-semibold text-[#156449] underline" href={US_PIPE_MANUFACTURER_SOURCE} target="_blank" rel="noopener noreferrer">{copy.source} — {copy.page} {row?.sourcePage}</a>.</p>
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
    </section>
  );
}
