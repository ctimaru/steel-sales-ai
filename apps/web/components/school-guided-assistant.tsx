"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  parseSteelAssistantInput, mergeSteelAssistantFacts, missingSteelAssistantFields,
  schoolAssistantEvidenceCodes, schoolAssistantCalculatorUrl,
  type SchoolAssistantFacts, type SchoolAssistantMissing,
} from "@/lib/school-assistant-intent.mjs";
import { SCHOOL_ASSISTANT_COPY } from "@/lib/school-assistant-i18n";
import type { SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

type EvidenceCitation={url:string;label:string;role:string};
type Evidence={id:string;code:string;title:string;summary:string;caution:string|null;rfqGuidance:string|null;citations:EvidenceCitation[];provenance?:{k2LastReviewedAt:string}};
type Turn={id:number;input:string;evidence:Evidence[];missing:SchoolAssistantMissing[];error:boolean};
type Props={locale:SchoolWorkspaceLocale};
const familyCodes:Record<NonNullable<SchoolAssistantFacts["family"]>,string>={
  round_tube:"CHS",square_tube:"SHS",rectangular_tube:"RHS",
};
function formatDimensions(facts:SchoolAssistantFacts){
  const f=(v:number|undefined)=>v===undefined?"?":String(v);
  if(facts.family==="round_tube") return "Ø"+f(facts.odMm)+" × "+f(facts.thicknessMm)+" mm";
  if(facts.family==="square_tube"||facts.family==="rectangular_tube")
    return f(facts.widthMm)+" × "+f(facts.heightMm)+" × "+f(facts.thicknessMm)+" mm";
  return "—";
}
function technicalFacts(facts:SchoolAssistantFacts,c:typeof SCHOOL_ASSISTANT_COPY[SchoolWorkspaceLocale]){
  return [
    {label:c.standard,value:facts.standard?.toUpperCase()??"—"},
    {label:c.grade,value:facts.grade??(facts.partialGrade?facts.partialGrade+" · "+c.unverified:"—")},
    {label:c.shape,value:facts.family?familyCodes[facts.family]:"—"},
    {label:c.dimensions,value:formatDimensions(facts)},
    {label:c.quantity,value:facts.quantityBars?String(facts.quantityBars):"—"},
    {label:c.length,value:facts.lengthM?String(facts.lengthM)+" m":"—"},
  ];
}
function sanitizedEvidence(value:unknown):Evidence[] {
  if(!Array.isArray(value))return [];
  return value.filter((item):item is Evidence=>
    Boolean(item&&typeof item==="object"&&typeof item.id==="string"&&typeof item.code==="string"&&
      typeof item.title==="string"&&typeof item.summary==="string"&&Array.isArray(item.citations)))
    .slice(0,4).map(item=>({
      id:item.id,code:item.code,title:item.title,summary:item.summary.slice(0,1000),
      caution:typeof item.caution==="string"?item.caution.slice(0,1000):null,
      rfqGuidance:typeof item.rfqGuidance==="string"?item.rfqGuidance.slice(0,1000):null,
      citations:item.citations.filter(source=>source&&typeof source.url==="string"&&
        /^https:\/\//i.test(source.url)&&typeof source.label==="string").slice(0,5),
      provenance:item.provenance,
    }));
}

export function SchoolGuidedAssistant({locale}:Props) {
  const c=SCHOOL_ASSISTANT_COPY[locale];
  const [draft,setDraft]=useState("");
  const [facts,setFacts]=useState<SchoolAssistantFacts>({});
  const [turns,setTurns]=useState<Turn[]>([]);
  const [busy,setBusy]=useState(false);
  const missing=missingSteelAssistantFields(facts);
  const calcHref=schoolAssistantCalculatorUrl(locale,facts);
  const billHref=(locale==="it"?"/distinta":"/"+locale+"/distinta");
  const anyFacts=Boolean(facts.standard||facts.grade||facts.partialGrade||facts.family||facts.quantityBars||facts.lengthM);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const input=draft.trim().slice(0,500);
    if(!input||busy)return;
    const parsed=parseSteelAssistantInput(input,facts);
    const next=mergeSteelAssistantFacts(facts,parsed.facts);
    const queries=schoolAssistantEvidenceCodes(input,next);
    setBusy(true);
    setDraft("");
    let evidence:Evidence[]=[];
    let failed=false;
    try {
      // Never send the original user prompt. Only structured standard/grade codes go to K2.
      if(queries.length){
        const returned=await Promise.all(queries.map(async(code)=>{
          const qs=new URLSearchParams({q:code,locale,limit:"2"});
          const result=await fetch("/api/public/school-evidence?"+qs.toString(),{
            method:"GET",cache:"no-store",credentials:"omit",
          });
          if(!result.ok)throw new Error("Public evidence unavailable");
          const body:unknown=await result.json();
          if(!body||typeof body!=="object"||!Array.isArray((body as {items?:unknown}).items))
            throw new Error("Invalid public evidence");
          return sanitizedEvidence((body as {items:unknown[]}).items);
        }));
        evidence=[...new Map(returned.flat().map(item=>[item.id,item])).values()].slice(0,4);
      }
    }catch{ failed=true; }
    setFacts(next);
    setTurns(previous=>[...previous,{
      id:previous.length+1,input,evidence,missing:missingSteelAssistantFields(next),error:failed,
    }]);
    setBusy(false);
  }

  function reset(){setTurns([]);setFacts({});setDraft("");}
  return <div lang={locale} className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(290px,0.75fr)]">
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[#c6dacf] bg-white shadow-sm" aria-label={c.title}>
      <header className="border-b border-[#d7e7dc] bg-[#eef6f0] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#23694e]">{c.eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold text-[#173f35]">{c.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[#506157]">{c.mode}</p>
          </div>
          <button type="button" onClick={reset} className="school-secondary-action shrink-0">{c.clear}</button>
        </div>
      </header>
      <div aria-live="polite" className="max-h-[530px] min-h-[280px] space-y-4 overflow-y-auto bg-[#fbfdfb] p-4 sm:p-5">
        {!turns.length?<div className="space-y-4">
          <p className="text-sm leading-6 text-[#52615b]">{c.empty}</p>
          <div className="flex flex-wrap gap-2" aria-label={c.start}>
            {[c.example1,c.example2].map(example=><button type="button" key={example}
              onClick={()=>setDraft(example)}
              className="min-h-11 rounded-xl border border-[#c5d9ce] bg-white px-3 py-2 text-left text-xs font-semibold text-[#174b3c] transition hover:border-[#4d9377] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
              {example} ↗
            </button>)}
          </div>
        </div>:null}
        {turns.map(turn=><article key={turn.id} className="space-y-3">
          <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#174b3c] px-4 py-3 text-sm leading-6 text-white">
            {turn.input}
          </div>
          <div className="space-y-3 rounded-2xl border border-[#d5e3da] bg-white px-4 py-4">
            {turn.error?<p role="alert" className="text-sm font-medium text-[#803b2a]">{c.error}</p>:null}
            {!turn.error&&!turn.evidence.length?<p className="text-sm leading-6 text-[#52615b]">{c.noEvidence}</p>:null}
            {turn.evidence.length?<div className="space-y-3">
              <h3 className="text-sm font-bold text-[#173f35]">{c.results}</h3>
              {turn.evidence.map(item=><div key={item.id} className="rounded-xl border border-[#dce8df] bg-[#f6faf7] p-3">
                <h4 className="text-sm font-bold text-[#173f35]">{item.code} · {item.title}</h4>
                <p className="mt-2 text-sm leading-6 text-[#475b50]">{item.summary}</p>
                {item.rfqGuidance?<p className="mt-2 text-xs leading-5 text-[#476255]"><strong>RFQ:</strong> {item.rfqGuidance}</p>:null}
                {item.caution?<p className="mt-2 text-xs leading-5 text-[#815128]">{item.caution}</p>:null}
                {item.provenance?.k2LastReviewedAt?<p className="mt-2 text-[11px] font-medium text-[#52615b]">K2 · {item.provenance.k2LastReviewedAt}</p>:null}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {item.citations.slice(0,3).map(source=><a key={source.url} href={source.url} target="_blank"
                    rel="noopener noreferrer" className="font-bold text-[#174b3c] underline underline-offset-4">
                    {source.role==="public_page"?item.code:source.label} ↗
                  </a>)}
                </div>
              </div>)}
            </div>:null}
            {turn.missing.length?<div>
              <h3 className="text-sm font-bold text-[#173f35]">{c.clarification}:</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-[#52615b]">
                {turn.missing.map(item=><li key={item}>{c.missing[item]}</li>)}
              </ul>
              <p className="mt-2 text-xs text-[#52615b]">{c.askMore}</p>
            </div>:null}
            <p className="text-xs leading-5 text-[#52615b]">{c.verify}</p>
          </div>
        </article>)}
        {busy?<p role="status" className="text-sm font-semibold text-[#174b3c]">{c.loading}</p>:null}
      </div>
      <form onSubmit={submit} className="border-t border-[#d7e7dc] bg-white p-4 sm:p-5">
        <label htmlFor={"school-assistant-input-"+locale} className="sr-only">{c.placeholder}</label>
        <textarea id={"school-assistant-input-"+locale} value={draft} onChange={event=>setDraft(event.target.value)}
          maxLength={500} rows={2} disabled={busy} placeholder={c.placeholder}
          className="block min-h-20 w-full resize-y rounded-xl border border-[#b7cec0] bg-white px-3 py-3 text-base leading-6 text-[#173f35] placeholder:text-[#687970] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"/>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs leading-5 text-[#52615b]">{c.privacy}</p>
          <button type="submit" disabled={busy||!draft.trim()} className="school-primary-action disabled:cursor-not-allowed disabled:opacity-50">
            {busy?c.loading:c.ask} <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </section>
    <aside className="space-y-3 lg:sticky lg:top-5">
      <section className="rounded-2xl border border-[#c6dacf] bg-white p-4 sm:p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[.11em] text-[#1c694a]">{c.preview}</p>
        <h2 className="mt-1 text-lg font-bold text-[#173f35]">{c.facts}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {technicalFacts(facts,c).map(field=><div key={field.label} className="min-w-0 rounded-xl border border-[#deebe2] bg-[#f7faf8] p-3">
            <dt className="text-xs font-semibold text-[#577064]">{field.label}</dt>
            <dd className="mt-1 break-words text-sm font-bold text-[#173f35]">{field.value}</dd>
          </div>)}
        </dl>
        {anyFacts&&missing.length?<div className="mt-4 rounded-xl border border-[#e4d4bc] bg-[#fcf8f0] p-3">
          <p className="text-xs font-bold text-[#765329]">{c.clarification}</p>
          <p className="mt-1 text-xs leading-5 text-[#765329]">{missing.map(x=>c.missing[x]).join(" · ")}</p>
        </div>:null}
        <p className="mt-3 text-xs leading-5 text-[#52615b]">{c.note}</p>
        <div className="mt-4 grid gap-2">
          {calcHref?<Link href={calcHref} className="school-primary-action w-full justify-center">{c.openCalc} →</Link>
            :<p className="rounded-xl border border-[#d6e3da] bg-[#f6faf7] p-3 text-xs text-[#506157]">{c.verify}</p>}
          <Link href={billHref} className="school-secondary-action w-full justify-center">{c.bill} →</Link>
        </div>
      </section>
      <p className="px-1 text-xs leading-5 text-[#52615b]">{c.privacy} {c.verify}</p>
    </aside>
  </div>;
}
