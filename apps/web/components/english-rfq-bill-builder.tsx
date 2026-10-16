"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { consumeCalculatorRfqIds, readCalculatorRfqQueue, type CalculatorRfqItem } from "@/lib/calculator-rfq-handoff";
import { consumeUsPipeRfqIds, readUsPipeRfqQueue, usPipeRfqSpecification } from "@/lib/us-pipe-rfq-handoff";
import {
  estimatePublicTubeMass,
  parseTubeNumber,
  type PublicTubeShape,
  type PublicTubeStandard,
} from "@/lib/international-tube-mass";
import { RFQ_BILL_TEXT, formatBillNumber, type RfqBillLocale } from "@/lib/rfq-bill-localization";
import { trackInternationalRfq } from "@/lib/international-rfq-analytics.client";
import { internationalRfqSource, type InternationalRfqSegment } from "@/lib/international-rfq-funnel";

type RfqLine = {
  id: number;
  shape: PublicTubeShape;
  standard: PublicTubeStandard;
  grade: string;
  diameter: string;
  width: string;
  height: string;
  thickness: string;
  bars: string;
  length: string;
  targetPricePerTonne: string;
  density: string;
  usProductIntent?: string;
};

const createLine = (id: number): RfqLine => ({
  id, shape: "square", standard: "en10219", grade: "S355J2H",
  diameter: "168.3", width: "100", height: "60", thickness: "5",
  bars: "10", length: "12", targetPricePerTonne: "", density: "7850",
});

const EN_BILL_SESSION_KEY = "sss:english-rfq-bill:v1";
const EN_BILL_SESSION_TTL = 24*60*60*1000;
function storedEnglishBill(value: string | null) {
  if (!value || value.length > 150000) return null;
  try {
    const item: unknown = JSON.parse(value);
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const obj = item as Record<string,unknown>;
    if (obj.version!==1 || typeof obj.at!=="number" ||
        obj.at>Date.now()+60_000 || Date.now()-obj.at>EN_BILL_SESSION_TTL ||
        !Array.isArray(obj.lines) || !obj.lines.length || obj.lines.length>50) return null;
    const allowed = new Set(["en10219","en10210","geometric","aisc-a500"]);
    const shapes = new Set(["round","square","rectangular"]);
    const keys = ["grade","diameter","width","height","thickness","bars","length","targetPricePerTonne","density"];
    const safeContext = (v:unknown):v is string => typeof v==="string" && v.length<=450 && !/[<>\r\n]/.test(v);
    const parsed = obj.lines.map((r:unknown) => {
      if (!r || typeof r!=="object" || Array.isArray(r)) return null;
      const v=r as Record<string,unknown>;
      if (!Number.isSafeInteger(v.id) || (v.id as number)<1 || !shapes.has(String(v.shape)) ||
          !allowed.has(String(v.standard)) || keys.some(k=>typeof v[k]!=="string" || (v[k] as string).length>200) ||
           (v.usProductIntent!==undefined && !safeContext(v.usProductIntent))) return null;
      return {id:v.id as number, shape:v.shape as PublicTubeShape,standard:v.standard as PublicTubeStandard,
        grade:v.grade as string, diameter:v.diameter as string,width:v.width as string,height:v.height as string,
        thickness:v.thickness as string,bars:v.bars as string,length:v.length as string,
        targetPricePerTonne:v.targetPricePerTonne as string,density:v.density as string,
        usProductIntent:v.usProductIntent as string|undefined} satisfies RfqLine;
    });
    if (parsed.some(v=>v===null) || new Set(parsed.map(v=>v!.id)).size!==parsed.length) return null;
    return {lines:parsed as RfqLine[],
      notes:typeof obj.notes==="string"?obj.notes.slice(0,5000):"",
      currency:obj.currency==="USD"||obj.currency==="GBP"?obj.currency:"EUR"} as const;
  } catch {return null;}
}
function fromCalculator(item:CalculatorRfqItem,id:number):RfqLine {
  return {id,shape:item.family==="round_tube"?"round":item.family==="square_tube"?"square":"rectangular",
    standard:item.standard,grade:"",
    diameter:String(item.outerDiameter??""),width:String(item.width??""),height:String(item.height??""),
    thickness:String(item.thickness),bars:String(item.bars),length:String(item.length),
    density:String(item.density),targetPricePerTonne:""};
}

function fromUsPipeCalculator(
  value:ReturnType<typeof usPipeRfqSpecification>,id:number,
):RfqLine | null {
  if(!value)return null;
  const productIntent=`${value.standardLabel}; ${value.designation}; ${value.provenanceNote}`;
  return {
    id,shape:value.shape,standard:value.calculationMethod,grade:"",
    diameter:value.shape==="round"?String(value.outerDiameterMm):"",
    width:value.shape==="round"?"":String(value.widthMm),
    height:value.shape==="rectangular"?String(value.heightMm):"",
    thickness:String(value.wallMm),bars:String(value.bars),
    length:String(value.lengthM),targetPricePerTonne:"",
    density:"7850",usProductIntent:productIntent,
  };
}

const control = "mt-1 w-full min-w-0 rounded-lg border border-[#c7d7cf] bg-white px-2.5 py-2.5 text-sm text-[#123b34] focus:border-[#1f6b5a] focus:outline-none focus:ring-2 focus:ring-[#b9d7cb]";
const label = "block min-w-0 text-xs font-semibold text-[#52615b]";

function describeLine(line: RfqLine, locale: RfqBillLocale) {
  const dim=(v:string)=>formatBillNumber(parseTubeNumber(v),locale);
  const geometry = line.shape === "round"
    ? `CHS Ø${dim(line.diameter)} × ${dim(line.thickness)}`
    : line.shape === "square"
      ? `SHS ${dim(line.width)} × ${dim(line.width)} × ${dim(line.thickness)}`
      : `RHS ${dim(line.width)} × ${dim(line.height)} × ${dim(line.thickness)}`;
  return `${geometry} mm, ${line.grade}, ${line.standard.toUpperCase().replace("EN", "EN ")}`;
}

export function EnglishRfqBillBuilder({locale="en"}:{locale?:RfqBillLocale}={}) {
  const t=RFQ_BILL_TEXT[locale];
  // Render actions disabled in SSR HTML until React handlers have hydrated.
  // This prevents a fast first click from appearing successful but doing nothing.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const nextId = useRef(2);
  const viewTracked = useRef(false);
  const [analyticsSegment,setAnalyticsSegment]=useState<InternationalRfqSegment>({system:"direct",standard:"unknown"});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importWarning, setImportWarning] = useState(false);
  const [lines, setLines] = useState<RfqLine[]>([createLine(1)]);
  const [currency, setCurrency] = useState<"EUR" | "USD" | "GBP">("EUR");
  const [notes, setNotes] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    // Same-tab only; restore edited bill before appending new calculations.
    let existing: ReturnType<typeof storedEnglishBill> = null;
    let queue: CalculatorRfqItem[] = [];
    let usQueue = readUsPipeRfqQueue(window.sessionStorage);
    try {
      existing = storedEnglishBill(window.sessionStorage.getItem(EN_BILL_SESSION_KEY));
      queue = readCalculatorRfqQueue(window.sessionStorage);
      usQueue = readUsPipeRfqQueue(window.sessionStorage);
    } catch { /* Private browsing may block storage. Builder still works. */ }
    const previous = existing?.lines ?? [];
    const accepted = queue.slice(0, Math.max(0,50-previous.length));
    const start = previous.length?Math.max(...previous.map(line=>line.id))+1:1;
    const additions=accepted.map((item,i)=>fromCalculator(item,start+i));
    const remainingCapacity=Math.max(0,50-previous.length-additions.length);
    const acceptedUs=usQueue.slice(0,remainingCapacity);
    const usAdditions=acceptedUs.flatMap((item,i)=>{
      const line=fromUsPipeCalculator(usPipeRfqSpecification(item),start+additions.length+i);
      return line?[line]:[];
    });
    const segment=internationalRfqSource(accepted,acceptedUs);
    setAnalyticsSegment(segment);
    // A bill may be opened directly without any calculator. Never imply attribution.
    if(!viewTracked.current){
      viewTracked.current=true;
      trackInternationalRfq("bill_opened",locale,segment);
    }
    nextId.current = start+additions.length+usAdditions.length;
    setLines([...previous,...additions,...usAdditions].length ? [...previous,...additions,...usAdditions] : [createLine(1)]);
    if(existing){ setCurrency(existing.currency); setNotes(existing.notes); }
    if(accepted.length){
      consumeCalculatorRfqIds(window.sessionStorage,accepted.map(item=>item.id));
    }
    if(acceptedUs.length){
      consumeUsPipeRfqIds(window.sessionStorage,acceptedUs.map(item=>item.id));
    }
    if(accepted.length || acceptedUs.length) setImportedCount(accepted.length+usAdditions.length);
    setImportWarning(accepted.length<queue.length || acceptedUs.length<usQueue.length);
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      window.sessionStorage.setItem(EN_BILL_SESSION_KEY,JSON.stringify({
        version:1,at:Date.now(),lines,notes,currency,
      }));
    } catch { /* Optional browser retention only. */ }
  }, [draftLoaded,lines,notes,currency]);

  const calculated = useMemo(
    () =>
      lines.map((line) => ({
        line,
        mass: estimatePublicTubeMass({
          shape: line.shape,
          standard: line.standard,
          outerDiameterMm: parseTubeNumber(line.diameter),
          widthMm: parseTubeNumber(line.width),
          heightMm: parseTubeNumber(line.height),
          thicknessMm: parseTubeNumber(line.thickness),
          bars: parseTubeNumber(line.bars),
          lengthM: parseTubeNumber(line.length),
          densityKgM3: line.standard === "geometric" ? parseTubeNumber(line.density) : 7850,
        }),
        error:
          !line.grade.trim() || !/^[A-Za-z0-9 .+\/-]{1,50}$/.test(line.grade.trim())
            ? t.invalidGrade
            : line.targetPricePerTonne.trim() &&
                (!Number.isFinite(parseTubeNumber(line.targetPricePerTonne)) ||
                  parseTubeNumber(line.targetPricePerTonne) <= 0)
              ? t.invalidTarget
              : null,
      })),
    [lines],
  );

  const invalidCount = calculated.filter((item) => !item.mass.ok || item.error).length;
  const valid = calculated.filter((item) => item.mass.ok && !item.error);
  const totalTonnes = valid.reduce((sum, item) => sum + (item.mass.ok ? item.mass.totalTonnes : 0), 0);
  const totalMeters = valid.reduce((sum, item) => sum + (item.mass.ok ? item.mass.totalMeters : 0), 0);

  function updateLine(id: number, patch: Partial<RfqLine>) {
    // A new geometric dimension/standard invalidates an inherited NPS/Schedule
    // manufacturer designation; never export stale API/ASTM context.
    const geometryChanged = ["shape","standard","diameter","width","height","thickness","density"]
      .some((key) => Object.prototype.hasOwnProperty.call(patch,key));
    setLines((current) => current.map((line) => line.id === id
      ? { ...line, ...patch, usProductIntent:geometryChanged ? undefined : line.usProductIntent }
      : line));
    setCopyState("idle");
  }
  function addLine() {
    setLines((current) => [...current, createLine(nextId.current++)]);
    setCopyState("idle");
  }
  function removeLine(id: number) {
    setLines((current) => current.length === 1 ? current : current.filter((line) => line.id !== id));
    setCopyState("idle");
  }
  function field(item: RfqLine, key: keyof Pick<RfqLine, "grade" | "diameter" | "width" | "height" | "thickness" | "bars" | "length" | "targetPricePerTonne" | "density">, title: string, placeholder?: string) {
    const inputId = `rfq-en-${item.id}-${key}`;
    return (
      <label key={key} htmlFor={inputId} className={label}>
        {title}
        <input
          id={inputId}
          type="text"
          inputMode={key === "grade" ? "text" : "decimal"}
          autoComplete="off"
          className={control}
          placeholder={placeholder}
          value={item[key]}
          onChange={(event) => updateLine(item.id, { [key]: event.target.value })}
        />
      </label>
    );
  }

  async function copyRfq() {
    if (invalidCount || !calculated.length) return;
    const rows = calculated.map(({ line, mass }, index) => {
      if (!mass.ok) return "";
      const target = line.targetPricePerTonne.trim();
      const targetText = target ? ` | ${t.emailTarget} ${currency}/t: ${formatBillNumber(parseTubeNumber(target),locale,2)}` : "";
      return [
        `${index + 1}. ${describeLine(line,locale)}`,
        ...(line.usProductIntent ? [`   ${t.emailProduct}: ${line.usProductIntent}`] : []),
        `   ${formatBillNumber(parseTubeNumber(line.bars),locale,0)} × ${formatBillNumber(parseTubeNumber(line.length),locale)} m | ${formatBillNumber(mass.totalMeters,locale,2)} m | ${formatBillNumber(mass.weightKgM,locale)} kg/m | ${formatBillNumber(mass.totalTonnes,locale,4)} t${targetText}`,
      ].join("\n");
    });
    const emailText = [
      t.emailSubject,
      "",
      t.emailGreeting,
      t.emailIntro,
      "",
      ...rows,
      "",
      `${t.emailTotal}: ${formatBillNumber(totalMeters,locale,2)} m / ${formatBillNumber(totalTonnes,locale,4)} t`,
      notes.trim() ? `\n${t.emailNotes}\n${notes.trim()}\n` : "",
      t.emailConfirm,
      t.emailTheory,
      "",
      t.emailClosing,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(emailText);
      trackInternationalRfq("email_copied",locale,analyticsSegment);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section aria-label={t.aria} className="space-y-5">
      {importedCount ? (
        <aside role="status" aria-live="polite" className="rounded-xl border border-[#b5d9c7] bg-[#edf8f1] p-4 text-sm text-[#123b34]">
          <strong>{importedCount} {t.imported}</strong>
          <p className="mt-1 text-xs leading-5">{t.importedInfo}</p>
        </aside>
      ) : null}
      {importWarning ? <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t.full}</p> : null}
      <div className="rounded-2xl border border-[#dce5e0] bg-white px-5 py-5 sm:px-7">
        <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-[#1f6b5a]">{t.eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold text-[#123b34]">{t.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
          {t.description}
        </p>
      </div>

      {calculated.map(({ line, mass, error }, index) => (
        <article key={line.id} className="rounded-2xl border border-[#dce5e0] bg-white p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#123b34]">{t.item} {index + 1}</h3>
            <button type="button" onClick={() => removeLine(line.id)} disabled={!hydrated || lines.length === 1}
              className="min-h-10 rounded-lg border border-[#d4ddd8] px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f2f4f3] disabled:cursor-not-allowed disabled:opacity-40">
              {t.remove}
            </button>
          </div>

          {line.usProductIntent ? (
            <div className="mb-3 rounded-lg border border-[#bdd8cb] bg-[#f0f7f3] p-3 text-xs leading-6 text-[#123b34]">
              <strong>{t.usSpecification}</strong> {line.usProductIntent}
              <p>{line.standard==="aisc-a500"
                ? t.usHssCaveat
                : t.usPipeCaveat}</p>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className={label}>
              {t.shape}
              <select className={control} value={line.shape} onChange={(event) => updateLine(line.id, { shape: event.target.value as PublicTubeShape })}>
                <option value="round">{t.round}</option>
                <option value="square">{t.square}</option>
                <option value="rectangular">{t.rectangular}</option>
              </select>
            </label>
            <label className={label}>
              {t.standard}
              <select className={control} value={line.standard} onChange={(event) => updateLine(line.id, { standard: event.target.value as PublicTubeStandard })}>
                <option value="en10219">EN 10219</option>
                <option value="en10210">EN 10210</option>
                <option value="geometric">{t.geometric}</option>
                <option value="aisc-a500">{t.aisc}</option>
              </select>
            </label>
            {field(line, "grade", t.grade)}
            {line.shape === "round"
              ? field(line, "diameter", t.diameter)
              : field(line, "width", line.shape === "square" ? t.side : t.width)}
            {line.shape === "rectangular" ? field(line, "height", t.height) : null}
            {field(line, "thickness", t.wall)}
            {line.standard === "geometric" ? field(line, "density", t.density) : null}
            {field(line, "length", t.length)}
            {field(line, "bars", t.bars)}
            {field(line, "targetPricePerTonne", `${t.target} (${currency}/t)`, t.notSpecified)}
          </div>
          <div aria-live="polite" className="mt-4 rounded-xl bg-[#f0f6f2] px-4 py-3 text-xs text-[#123b34]">
            {mass.ok && !error ? (
              <p><strong>{describeLine(line,locale)}</strong> · {formatBillNumber(mass.weightKgM,locale)} kg/m · {formatBillNumber(mass.totalMeters,locale,2)} m · <strong>{formatBillNumber(mass.totalTonnes,locale,4)} t</strong></p>
            ) : (
              <p role="alert" className="font-semibold text-[#9a4e22]">{error || (mass.ok ? "" : t.invalidGeometry)}</p>
            )}
          </div>
        </article>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addLine} disabled={!hydrated} className="inline-flex min-h-11 items-center rounded-xl border border-[#99b8aa] bg-white px-5 text-sm font-bold text-[#123b34] hover:bg-[#edf5f1] disabled:cursor-wait disabled:opacity-60">
          {t.add}
        </button>
        <label className="text-xs font-semibold text-[#52615b]">
          {t.currency}
          <select aria-label={t.currency} className="ml-2 rounded-lg border border-[#c7d7cf] bg-white px-3 py-2 text-sm" value={currency} onChange={(event) => { setCurrency(event.target.value as "EUR" | "USD" | "GBP"); setCopyState("idle"); }}>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold text-[#123b34]">
        {t.notes}
        <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setCopyState("idle"); }}
          rows={3} maxLength={5000} placeholder={t.notesPlaceholder}
          className="mt-2 block w-full rounded-xl border border-[#c7d7cf] bg-white px-4 py-3 text-sm font-normal text-[#123b34] focus:border-[#1f6b5a] focus:outline-none focus:ring-2 focus:ring-[#b9d7cb]" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#123b34] px-5 py-5 text-white sm:px-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#b4e0d0]">{t.summary}</p>
          <p className="mt-1 text-xl font-bold">{lines.length} {t.items} · {formatBillNumber(totalMeters,locale,2)} m · {formatBillNumber(totalTonnes,locale,4)} t</p>
          {invalidCount ? <p role="alert" className="mt-2 text-xs text-[#ffdec8]">{invalidCount} · {t.invalidItems}</p> : null}
          <p className="mt-2 text-xs text-[#dbeae4]">{t.privacy}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button type="button" disabled={!hydrated || invalidCount > 0} onClick={copyRfq}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-[#123b34] hover:bg-[#e6f3ed] disabled:cursor-not-allowed disabled:opacity-40">
            {copyState === "copied" ? t.copied : t.copy}
          </button>
          {copyState === "failed" ? <p role="alert" className="text-xs text-[#ffdec8]">{t.copyFailed}</p> : null}
        </div>
      </div>
    </section>
  );
}
