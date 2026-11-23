"use client";

import Form from "next/form";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useRef,useState,type FormEvent,type ReactNode} from "react";
import {EU_MEMBER_COUNTRIES,OTHER_NETWORK_COUNTRIES,networkCountryName} from "@/lib/network-eu-countries";
import {EuProducerIntelligenceChat,PRODUCER_QUESTION_EXAMPLES} from "@/components/eu-producer-intelligence-chat";
import {NetworkSaveToggle} from "@/components/network-save-toggle";
import {newRequestHref} from "@/lib/new-request-href";
import {
  PRODUCER_VALUE_GROUPS,
  groupProducerValues,
  isProducerTechnicalQuestion,
  producerHighlights,
  type ProducerValueKind,
} from "@/lib/network-producer-highlights";

import type {NetworkProDirectoryResult} from "@/lib/network-pro-coverage";
import type {NetworkProducerCatalogLink} from "@/lib/network-producer-catalogs";
import type {NetworkProducerTechnicalClaim,ProducerEvidenceKind} from "@/lib/network-producer-technical";
import type {ProducerSourceMention} from "@/lib/network-producer-source-mentions";

/*
 * NET-PRODUCERS-UX3 (founder request, 23 Nov 2026): the page was too crowded.
 * - header on one line (title, country, published count) and every caution in
 *   one «Come leggere i dati» disclosure instead of six separate paragraphs;
 * - ONE search box: a company name or domain filters the list, a question or a
 *   standard/grade/size goes to the AI search with sources;
 * - clean rows: no repeated country and role line, 2–3
 *   de-duplicated values, one grey line with domain and source counts;
 * - details in a side panel instead of a strip under each row;
 * - comparison with check boxes and a bar at the bottom.
 * No query, entitlement or wording about evidence changes: the same authorized
 * RPCs feed the page, and no value is presented as a confirmed capability.
 */

type Props={
  result:NetworkProDirectoryResult;
  query:string;
  country:string;
  page:number;
  publishedCount:number|null;
  catalogs:NetworkProducerCatalogLink[]|null;
  technicalClaims:NetworkProducerTechnicalClaim[]|null;
  sourceMentions:ProducerSourceMention[]|null;
  savedIds:string[]|null;
};

type DirectoryItem={id:string;name:string;countryCode:string;websiteUrl:string|null};

function website(company:DirectoryItem){
  if(!company.websiteUrl)return null;
  try {
    const target=new URL(company.websiteUrl);
    return target.protocol==="https:" && !target.username && !target.password
      ?target.toString():null;
  }catch{return null;}
}

function initials(name:string){
  const words=name.replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?|srl|spa|s\.?n\.?c\.?|s\.?a\.?s\.?)\b/gi,"").replace(/[^A-Za-z0-9À-ÿ\s]/g," ").trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0]??"")+(words[1]?.[0]??words[0]?.[1]??"")).toUpperCase()||"P";
}
function hostname(url:string|null){
  if(!url)return null;
  try{return new URL(url).hostname.replace(/^www\./,"");}catch{return null;}
}

function PageLink({label,query,country,page}:{label:string;query:string;country:string;page:number}){
  const params=new URLSearchParams({q:query,country,p:String(page)});
  return <Link href={"/network/pro/producers?"+params.toString()}
    className="inline-flex min-h-10 items-center rounded-xl border border-[#c9d9ce] bg-white px-4 text-xs font-semibold text-[#18573d] hover:bg-[#f1f7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18573d]">
    {label}
  </Link>;
}

const technicalKinds:{kind:ProducerEvidenceKind;label:string}[]=PRODUCER_VALUE_GROUPS;

/** Each fact keeps its own first-party link; a range NEVER asserts a full SKU. */
function EvidenceValues({items,kind}:{items:NetworkProducerTechnicalClaim[]|null;kind:ProducerEvidenceKind}){
  if(items===null)return <span className="italic text-[#687a6e]">Indice non disponibile</span>;
  const matches=groupProducerValues(items.filter(item=>item.kind===kind));
  if(matches.length===0)return <span className="italic text-[#758479]">Non disponibile in questa vista</span>;
  return <ul className="flex flex-wrap gap-1.5">
    {matches.map(item=><li key={item.key}>
      <a href={item.sourceUrl} title={item.sourceTitle} target="_blank" rel="noopener noreferrer"
        className="inline-flex max-w-[260px] items-center gap-1 break-words rounded-lg border border-[#d0e3d6] bg-[#f4f9f5] px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-[#1b5b40] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#1d6948]">
        {item.value}<span aria-hidden="true">↗</span>
      </a>
    </li>)}
  </ul>;
}

function MentionValues({items,kind}:{items:ProducerSourceMention[];kind:ProducerValueKind}){
  const matches=groupProducerValues(items.filter(item=>item.kind===kind));
  if(matches.length===0)return null;
  return <ul className="flex flex-wrap gap-1.5">
    {matches.map(m=><li key={m.key}>
      <a target="_blank" rel="noopener noreferrer" href={m.sourceUrl}
        title={m.occurrences>1?m.occurrences+" occorrenze sulle pagine ufficiali":undefined}
        className="inline-flex min-h-8 items-center rounded-lg border border-[#dae5dc] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#315b45] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        {m.value} ↗
      </a>
    </li>)}
  </ul>;
}

function Disclosure({summary,children}:{summary:ReactNode;children:ReactNode}){
  return <details className="group relative">
    <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[#3b5f4b] hover:bg-[#eef5f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
      {summary}
    </summary>
    <div className="absolute right-0 z-40 mt-1 w-[min(92vw,440px)] space-y-2 rounded-xl border border-[#d4e3d9] bg-white p-4 text-xs leading-5 text-[#4d6355] shadow-[0_14px_34px_rgba(10,32,25,0.14)]">
      {children}
    </div>
  </details>;
}

export function NetworkProducersExperience({result,query,country,page,publishedCount,catalogs,technicalClaims,sourceMentions,savedIds}:Props){
  const router=useRouter();
  const countryLabel=networkCountryName(country)||country;
  // Search/pagination navigations can preserve this client component: stale ids must never disable the new result list.
  const selectionScope=JSON.stringify([query,page,country]);
  const [selection,setSelection]=useState<{scope:string;ids:string[]}>({scope:selectionScope,ids:[]});
  const selected=selection.scope===selectionScope?selection.ids:[];
  const clearSelection=()=>setSelection({scope:selectionScope,ids:[]});
  const [detail,setDetail]=useState<{scope:string;id:string}|null>(null);
  const detailId=detail&&detail.scope===selectionScope?detail.id:null;
  const [ask,setAsk]=useState<{id:number;text:string}|null>(null);
  const [draft,setDraft]=useState(query);
  // A navigation (pagination, «Mostra tutti», name search from the AI answer) brings a new query:
  // the box shows it (state adjusted during render, no effect).
  const [draftQuery,setDraftQuery]=useState(query);
  if(draftQuery!==query){setDraftQuery(query);setDraft(query);}
  const companies=result.status==="ready"?result.data.items:[];
  const selectedCompanies=selected.flatMap(id=>{
    const found=companies.find(company=>company.id===id);
    return found?[found]:[];
  });
  function toggle(id:string){
    setSelection(current=>{
      const ids=current.scope===selectionScope?current.ids:[];
      const next=ids.includes(id)
        ?ids.filter(value=>value!==id)
        :ids.length<3?[...ids,id]:ids;
      return {scope:selectionScope,ids:next};
    });
  }
  const total=result.status==="ready"?result.data.total:null;
  const pages=result.status==="ready"?Math.max(1,Math.ceil(result.data.total/result.data.limit)):1;
  const saved=new Set(savedIds??[]);

  /** Name or domain → normal navigation (filters the list). Question → AI answer under the box. */
  function routeSearch(event:FormEvent<HTMLFormElement>){
    const text=String(new FormData(event.currentTarget).get("q")??"").trim();
    if(!isProducerTechnicalQuestion(text))return;
    event.preventDefault();
    setAsk(current=>({id:(current?.id??0)+1,text}));
  }
  function askExample(text:string){
    setDraft(text);
    setAsk(current=>({id:(current?.id??0)+1,text}));
  }
  function searchAsName(text:string){
    setAsk(null);
    const params=new URLSearchParams({q:text.slice(0,120),country});
    router.push("/network/pro/producers?"+params.toString());
  }

  const detailCompany=detailId?companies.find(company=>company.id===detailId)??null:null;

  return <main className="mx-auto w-full max-w-[1320px] space-y-4 pb-14" data-testid="network-producers-workspace">
    <nav aria-label="Percorso Network" className="flex flex-wrap items-center gap-2 text-xs">
      <Link href={"/network?country="+encodeURIComponent(country)} className="font-semibold text-[#236248] hover:underline">Network</Link>
      <span aria-hidden="true" className="text-[#859c8d]">/</span>
      <Link href="/network/pro" className="font-semibold text-[#236248] hover:underline">Moduli PRO</Link>
      <span aria-hidden="true" className="text-[#859c8d]">/</span>
      <span className="font-semibold text-[#193d2e]">Produttori</span>
    </nav>

    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2" data-testid="network-producers-header">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[#123c2c]">Produttori</h1>
        <p className="mt-0.5 text-sm text-[#4d6355]">
          {countryLabel}
          {publishedCount!==null?<> · <strong className="font-bold tabular-nums text-[#164a32]">{publishedCount.toLocaleString("it-IT")}</strong> aziende pubblicate</>:null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Link href="/network/cataloghi" className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-[#1b6044] hover:bg-[#eef5f0] hover:underline">
          Cataloghi pubblici →
        </Link>
        <Disclosure summary="Come leggere i dati">
          <p>
            Sono produttori pubblicati per Paese, con accessi Italia ed Europa distinti. La prova di produzione fisica, le norme, le dimensioni e i cataloghi
            tecnici restano qualificazioni documentali separate. Il numero non equivale a tubifici verificati e nessuna candidatura è conteggiata.
          </p>
          <p>
            <strong className="text-[#1c573a]">Dati tecnici con fonte</strong>: norme, gradi, sezioni e intervalli osservati sulle pagine ufficiali.
            Le misure sono intervalli indicativi e non dimostrano una specifica combinazione di diametro, spessore e grado, né stock o capacità.
          </p>
          <p>
            <strong className="text-[#6b5313]">Menzioni da qualificare</strong>: parole tecniche trovate sul sito ufficiale. Una menzione non dimostra
            che l&apos;azienda produca una specifica combinazione di norma, materiale e dimensioni, né che abbia disponibilità.
          </p>
          <p>
            <strong className="text-[#4f5f57]">In qualificazione</strong>: norme, gamma produttiva e cataloghi non ancora collegati.
            La scheda non implica disponibilità o produzione di una specifica misura.
          </p>
          <p>
            La ricerca tecnica per norma, grado e dimensione esatta richiede cataloghi con combinazioni esplicite: oggi la ricerca AI
            trova attributi presenti nelle fonti, non SKU disponibili né conferme del produttore. Cataloghi e schede sono collegamenti
            ai siti ufficiali, senza copie dei PDF.
          </p>
        </Disclosure>
      </div>
    </header>

    {country!=="IT"&&technicalClaims!==null&&technicalClaims.length>0?
      <p className="text-xs leading-5 text-[#20533b]" data-testid="network-producers-eu-evidence">
        <strong>Intelligence Europa · {technicalClaims.length} evidenze con fonte in questa pagina.</strong>
        {" "}Osservate sul sito ufficiale, non ancora confermate dal produttore; nessuna combinazione norma, grado, dimensione e spessore viene dedotta.
      </p>:null}

    <section aria-label="Cerca produttori" className="space-y-2">
      {/* NET-PRO-UX2: next/form navigates client-side (no full reload) and prefetches the loading skeleton.
          NET-PRODUCERS-UX3: a technical question is intercepted and answered by the AI search instead. */}
      <Form action="/network/pro/producers" onSubmit={routeSearch} className="flex flex-col gap-2 sm:flex-row" data-testid="network-producers-search">
        <label htmlFor="manufacturer-query" className="sr-only">Nome del produttore, dominio o domanda tecnica</label>
        <div className="relative min-w-0 flex-1">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#5d7a69]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input id="manufacturer-query" name="q" type="search" maxLength={400}
            value={draft} onChange={event=>setDraft(event.target.value)} autoComplete="off"
            placeholder="Cerca un'azienda o chiedi: «chi produce EN 10219 S355J2H?»"
            className="min-h-12 w-full rounded-xl border border-[#b3cbbb] bg-white pl-10 pr-4 text-sm text-[#183d2d] placeholder:text-[#6f8576] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"/>
        </div>
        <label htmlFor="manufacturer-country" className="sr-only">Paese del produttore</label>
        <select id="manufacturer-country" name="country" defaultValue={country}
          aria-label="Paese del produttore" data-testid="network-producers-country"
          className="min-h-12 min-w-[148px] rounded-xl border border-[#b3cbbb] bg-white px-3 text-sm font-semibold text-[#183d2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
          <optgroup label="Unione europea">
            {EU_MEMBER_COUNTRIES.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}
          </optgroup>
          <optgroup label="Altri Paesi europei">
            {OTHER_NETWORK_COUNTRIES.filter(item=>item.code!=="US").map(item=>
              <option key={item.code} value={item.code}>{item.name}</option>)}
          </optgroup>
        </select>
        <button type="submit" className="min-h-12 rounded-xl bg-[#175640] px-6 text-sm font-bold text-white hover:bg-[#10452f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">Cerca</button>
      </Form>
      {!ask?<div className="flex flex-wrap items-center gap-1.5" aria-label="Domande di esempio">
        <span className="text-[11px] font-semibold text-[#5d7262]">Prova a chiedere:</span>
        {PRODUCER_QUESTION_EXAMPLES.map(prompt=><button type="button" key={prompt} onClick={()=>askExample(prompt)}
          className="min-h-8 rounded-full border border-[#cfe0d4] bg-white px-3 py-1 text-left text-[11px] font-semibold text-[#27563f] hover:bg-[#eef6f0] focus-visible:outline-2 focus-visible:outline-[#185740]">
          {prompt}
        </button>)}
      </div>:null}
    </section>

    <EuProducerIntelligenceChat ask={ask} onSearchAsName={searchAsName} onClose={()=>setAsk(null)}/>

    {result.status==="locked"?
      <section role="status" className="grid gap-4 rounded-[22px] border border-[#d7e2d8] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7">
        <div>
          <h2 className="text-lg font-extrabold text-[#153e2c]">Sblocca Intelligence Produttori</h2>
          <p className="mt-2 max-w-[700px] text-sm leading-6 text-[#546b5c]">
            {"Esplora e confronta aziende pubblicate con il modulo Produttori "+(country==="IT"?"Italia":"Europa")+"."}
            Nessun altro modulo è necessario. L'attivazione avverrà dopo conferma del pagamento,
            quando il checkout sarà operativo.
          </p>
        </div>
        <Link href="/network/pro"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#175640] px-5 text-sm font-bold text-white">
          Scopri il modulo Produttori
        </Link>
      </section>
    :result.status==="unavailable"?
      <section role="status" className="rounded-2xl border border-[#dfd6bc] bg-[#fffcf5] p-5 text-sm text-[#72552f]">
        Dati autorizzati temporaneamente non disponibili. Nessun risultato provvisorio viene mostrato.
      </section>
    :<>
      <section aria-label="Risultati produttori" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-[#183d2d]">
            {total?.toLocaleString("it-IT")} {total===1?"risultato":"risultati"}
            {query?<span className="font-semibold text-[#4d6355]"> per «{query}»</span>:null}
            {pages>1?<span className="font-normal text-[#607667]">{" · pagina "+page+" di "+pages}</span>:null}
          </h2>
          <p className="text-[11px] text-[#607667]">Spunta fino a tre aziende per confrontarle</p>
        </div>
        {companies.length===0?
          <div className="rounded-xl border border-[#dce7df] bg-white p-6 text-sm text-[#64776a]">
            Nessuna azienda pubblicata corrisponde alla ricerca.
            {query?<> <Link href={"/network/pro/producers?country="+encodeURIComponent(country)} className="font-bold text-[#175640] underline">Mostra tutti i produttori</Link></>:null}
          </div>
        :<ul className="divide-y divide-[#e6eee8] overflow-hidden rounded-2xl border border-[#d9e5dc] bg-white" data-testid="network-producers-list">
          {companies.map(company=>{
            const active=selected.includes(company.id);
            const url=website(company);
            const domain=hostname(url);
            const docs=catalogs?.filter(doc=>doc.companyId===company.id)??[];
            const evidence=technicalClaims?.filter(item=>item.companyId===company.id)??[];
            const mentions=sourceMentions?.filter(item=>item.companyId===company.id)??[];
            const hasDetails=evidence.length>0||docs.length>0||mentions.length>0;
            const highlights=producerHighlights(evidence,mentions);
            const fromMentions=evidence.length===0&&mentions.length>0;
            const checkboxId="compare-"+company.id;
            return <li key={company.id} data-testid="network-producer-row" className={"min-w-0 transition-colors "+(active?"bg-[#f1f8f3]":"hover:bg-[#fafcfb]")}>
              <article className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
                <input id={checkboxId} type="checkbox" checked={active} disabled={!active&&selected.length>=3}
                  onChange={()=>toggle(company.id)} data-testid="producer-compare-toggle"
                  aria-label={"Confronta "+company.name}
                  title={!active&&selected.length>=3?"Puoi confrontare al massimo tre aziende":"Aggiungi al confronto"}
                  className="h-[18px] w-[18px] cursor-pointer accent-[#175640] disabled:cursor-not-allowed"/>
                <span aria-hidden="true" className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold "+
                  (hasDetails?"bg-[#e5f1ea] text-[#1b5b40]":"bg-[#eef1ef] text-[#56665c]")}>
                  {initials(company.name)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-extrabold leading-5 text-[#173c2c]">
                    {hasDetails?<button type="button" onClick={()=>setDetail({scope:selectionScope,id:company.id})}
                      className="text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                      {company.name}
                    </button>:company.name}
                  </h3>
                  {highlights.shown.length>0?<ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={fromMentions?"Menzioni principali da qualificare":"Dati tecnici principali"}>
                    {highlights.shown.map(value=><li key={value.key}
                      className={"rounded-md px-2 py-0.5 text-[11px] font-semibold "+(fromMentions?"bg-[#faf6ea] text-[#6b5313]":"bg-[#eef5f0] text-[#1f5a40]")}>
                      {value.value}
                    </li>)}
                    {highlights.hidden>0?<li className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#5d7262]">+{highlights.hidden}</li>:null}
                  </ul>:null}
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#617768]">
                    {domain?<span className="truncate">{domain}</span>:null}
                    {country!=="IT"?<span>{networkCountryName(company.countryCode)||company.countryCode}</span>:null}
                    {evidence.length>0?<span>{evidence.length} dati tecnici con fonte</span>:null}
                    {docs.length>0?<span>{docs.length} {docs.length===1?"catalogo":"cataloghi"}</span>:null}
                    {mentions.length>0?<span>{mentions.length} menzioni da qualificare</span>:null}
                    {!hasDetails?<span className="italic">In qualificazione</span>:null}
                    {technicalClaims===null?<span className="text-[#8b6b45]">Dati tecnici momentaneamente non disponibili</span>:null}
                  </p>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-1.5 sm:col-span-1">
                  {/* UX3B: the optional button comes first, so Salva and Sito stay in the same column on every row. */}
                  {hasDetails?<button type="button" onClick={()=>setDetail({scope:selectionScope,id:company.id})}
                    data-testid="producer-details-open"
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#bcd5c5] bg-white px-3 text-xs font-bold text-[#175640] hover:bg-[#eef6f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                    Dettagli <span aria-hidden="true">›</span>
                  </button>:null}
                  <NetworkSaveToggle companyId={company.id} name={company.name} saved={saved.has(company.id)} surface="network_directory" compact appearance="toolbar"/>
                  {url?<a href={url} target="_blank" rel="noopener noreferrer" aria-label={"Sito ufficiale di "+company.name}
                    className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-[#d5dfd9] bg-white px-3 text-xs font-bold text-[#3f5248] hover:bg-[#f3f8f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                    Sito <span aria-hidden="true">↗</span>
                  </a>:null}
                </div>
              </article>
            </li>;
          })}
        </ul>}
      </section>
      {selectedCompanies.length>0?<section id="producer-compare" aria-labelledby="producer-compare-title"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-[#c9ded0] bg-white">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#e0ebe3] bg-[#f4f9f5] px-4 py-3">
          <div>
            <h2 id="producer-compare-title" className="text-base font-extrabold text-[#153f2d]">Confronto produttori</h2>
            <p className="mt-0.5 text-[11px] leading-5 text-[#5b7463]">
              Valori con link alle pagine ufficiali. Le misure sono intervalli indicativi: non dimostrano una specifica combinazione
              di diametro, spessore e grado, né stock o capacità disponibile.
            </p>
          </div>
          <button type="button" onClick={clearSelection} className="min-h-10 text-xs font-bold text-[#185740] underline">Svuota</button>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[580px] border-collapse text-left text-xs">
            <thead><tr className="bg-white text-[#1b422f]"><th scope="col" className="w-36 border-b border-[#e5ede6] p-4">Criterio</th>
              {selectedCompanies.map(company=><th scope="col" key={company.id} className="min-w-36 border-b border-[#e5ede6] p-4 font-extrabold">{company.name}</th>)}</tr></thead>
            <tbody className="text-[#506557]">
              <tr><th scope="row" className="border-b border-[#e5ede6] p-4 font-bold">Paese</th>
                {selectedCompanies.map(c=><td key={c.id} className="border-b border-[#e5ede6] p-4">{networkCountryName(c.countryCode)||c.countryCode}</td>)}</tr>
              {technicalKinds.map(group=>
                <tr key={group.kind}><th scope="row" className="border-b border-[#e5ede6] p-4 font-bold">{group.label}</th>
                  {selectedCompanies.map(c=><td key={c.id} className="border-b border-[#e5ede6] p-3 align-top">
                    <EvidenceValues
                      items={technicalClaims?.filter(claim=>claim.companyId===c.id)??(technicalClaims===null?null:[])}
                      kind={group.kind}
                    />
                  </td>)}
                </tr>)}
              <tr><th scope="row" className="border-b border-[#e5ede6] p-4 font-bold">Cataloghi ufficiali</th>
                {selectedCompanies.map(c=><td key={c.id} className="border-b border-[#e5ede6] p-4">
                  {catalogs===null?"Indice non disponibile":
                    (catalogs.filter(link=>link.companyId===c.id).length>0
                     ?catalogs.filter(link=>link.companyId===c.id).length+" collegamenti"
                     :"Non ancora indicizzati")}
                </td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </section>:null}
      {selectedCompanies.length>0?<div role="region" aria-label="Produttori selezionati per il confronto" data-testid="producer-compare-bar"
        className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-full max-w-[760px] flex-wrap items-center gap-2 rounded-2xl bg-[#123a2e] px-3.5 py-2.5 text-white shadow-[0_14px_34px_rgba(10,32,25,0.3)] lg:bottom-5">
        <span className="text-xs font-extrabold">{selectedCompanies.length} / 3 nel confronto</span>
        <span className="hidden min-w-0 flex-1 truncate text-[11px] text-[#cfe6db] sm:inline">{selectedCompanies.map(c=>c.name).join(" · ")}</span>
        <a href="#producer-compare" style={{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" }} className="ml-auto inline-flex min-h-9 items-center rounded-xl bg-[#f2b544] px-3 text-xs font-extrabold text-[#2a1c00] hover:bg-[#f6c460] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Vedi confronto ↓</a>
        <button type="button" onClick={clearSelection} className="min-h-9 rounded-xl border border-white/30 px-3 text-xs font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Svuota</button>
      </div>:null}
      {pages>1?<nav aria-label="Navigazione produttori" className="flex items-center justify-between gap-2">
        {page>1?<PageLink label="← Precedenti" query={query} country={country} page={page-1}/>:<span/>}
        <span className="text-xs text-[#607667]">Pagina {page} di {pages}</span>
        {result.data.total>page*result.data.limit?
          <PageLink label="Successive →" query={query} country={country} page={page+1}/>:<span/>}
      </nav>:null}
    </>}

    {detailCompany?<ProducerDetailPanel
      key={detailCompany.id}
      company={detailCompany}
      url={website(detailCompany)}
      docs={catalogs?.filter(doc=>doc.companyId===detailCompany.id)??[]}
      evidence={technicalClaims?.filter(item=>item.companyId===detailCompany.id)??[]}
      mentions={sourceMentions?.filter(item=>item.companyId===detailCompany.id)??[]}
      inCompare={selected.includes(detailCompany.id)}
      canAddCompare={selected.length<3}
      onToggleCompare={()=>toggle(detailCompany.id)}
      onClose={()=>setDetail(null)}
    />:null}
  </main>;
}

/** Side panel with the sources of ONE company: grouped, de-duplicated, every value linked. */
function ProducerDetailPanel({company,url,docs,evidence,mentions,inCompare,canAddCompare,onToggleCompare,onClose}:{
  company:DirectoryItem;
  url:string|null;
  docs:NetworkProducerCatalogLink[];
  evidence:NetworkProducerTechnicalClaim[];
  mentions:ProducerSourceMention[];
  inCompare:boolean;
  canAddCompare:boolean;
  onToggleCompare:()=>void;
  onClose:()=>void;
}){
  const closeRef=useRef<HTMLButtonElement>(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  // Runs once per opening: focus the close button, Esc closes, page scroll locked, focus restored.
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    closeRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")onCloseRef.current();};
    window.addEventListener("keydown",onKey);
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{
      window.removeEventListener("keydown",onKey);
      document.body.style.overflow=overflow;
      previous?.focus?.();
    };
  },[]);
  const domain=hostname(url);
  const evidenceGroups=technicalKinds.filter(group=>evidence.some(item=>item.kind===group.kind));
  const mentionGroups=PRODUCER_VALUE_GROUPS.filter(group=>mentions.some(item=>item.kind===group.kind));
  const uniqueMentions=groupProducerValues(mentions).length;
  return <div className="fixed inset-0 z-50 flex justify-end" data-testid="producer-detail-panel">
    <button type="button" aria-label="Chiudi i dettagli" tabIndex={-1} onClick={onClose}
      className="absolute inset-0 cursor-default bg-[#0c241b]/30"/>
    <aside role="dialog" aria-modal="true" aria-labelledby="producer-detail-title"
      className="relative flex h-full w-full max-w-[520px] flex-col bg-white shadow-[-12px_0_40px_rgba(10,32,25,0.18)]">
      <div className="flex items-start gap-3 border-b border-[#e3ece6] px-5 py-4">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5f1ea] text-[13px] font-extrabold text-[#1b5b40]">
          {initials(company.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="producer-detail-title" className="text-lg font-extrabold leading-6 text-[#153e2c]">{company.name}</h2>
          <p className="text-xs text-[#607769]">{(networkCountryName(company.countryCode)||company.countryCode)}{domain?" · "+domain:""}</p>
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Chiudi"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#3f5248] hover:bg-[#f1f6f3] focus-visible:outline-2 focus-visible:outline-[#175640]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-[#eef3ef] px-5 py-3">
        <Link href={newRequestHref({network:company.id,fromNetwork:true})}
          className="inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-3.5 text-xs font-bold text-white hover:bg-[#104b35]">
          Prepara Distinta / RFQ
        </Link>
        <button type="button" onClick={onToggleCompare} disabled={!inCompare&&!canAddCompare}
          className={"inline-flex min-h-10 items-center rounded-lg border px-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 "+
            (inCompare?"border-[#175640] bg-[#eef6f0] text-[#175640]":"border-[#bcd5c5] bg-white text-[#175640] hover:bg-[#eef6f0]")}>
          {inCompare?"Nel confronto ✓":"Aggiungi al confronto"}
        </button>
        {url?<a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#d5dfd9] bg-white px-3.5 text-xs font-bold text-[#3f5248] hover:bg-[#f3f8f4]">
          Sito ufficiale <span aria-hidden="true">↗</span>
        </a>:null}
        <Link href={"/network/"+company.id} className="inline-flex min-h-10 items-center px-1 text-xs font-bold text-[#1d6948] underline underline-offset-2">
          Scheda azienda
        </Link>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {evidence.length>0?<section aria-labelledby="producer-detail-evidence">
          <h3 id="producer-detail-evidence" className="text-sm font-extrabold text-[#1c573a]">Dati tecnici con fonte</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-[#61786a]">
            Attribuiti a pagine ufficiali. Nessuna combinazione dimensione/grado è garantita, né la disponibilità.
          </p>
          <div className="mt-3 space-y-3">
            {evidenceGroups.map(group=><div key={group.kind}>
              <p className="mb-1.5 text-[11px] font-bold text-[#4d6355]">{group.label}</p>
              <EvidenceValues items={evidence} kind={group.kind}/>
            </div>)}
          </div>
        </section>:null}
        {docs.length>0?<section aria-labelledby="producer-detail-docs">
          <h3 id="producer-detail-docs" className="text-sm font-extrabold text-[#2f4b8f]">Cataloghi ufficiali</h3>
          <ul className="mt-2 space-y-2.5">
            {docs.map(doc=><li key={doc.id}>
              <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold leading-5 text-[#1e6948] underline underline-offset-2">
                {doc.title}
              </a>
              <p className="mt-0.5 text-[11px] text-[#657d6c]">
                {doc.documentType==="official_pdf"?"PDF sul sito produttore":"Pagina sul sito produttore"}
                {doc.editionYear?" · Edizione "+doc.editionYear:""}
              </p>
            </li>)}
          </ul>
        </section>:null}
        {mentions.length>0?<section aria-labelledby="producer-detail-mentions">
          <h3 id="producer-detail-mentions" className="text-sm font-extrabold text-[#6b5313]">Menzioni tecniche rilevate · da qualificare</h3>
          <p className="mt-0.5 text-[11px] leading-5 text-[#647768]">
            {uniqueMentions} {uniqueMentions===1?"parola tecnica trovata":"parole tecniche trovate"} sul sito ufficiale. Una menzione non dimostra
            una specifica combinazione di norma, materiale e dimensioni, né disponibilità.
          </p>
          <div className="mt-3 space-y-3">
            {mentionGroups.map(group=><div key={group.kind}>
              <p className="mb-1.5 text-[11px] font-bold text-[#4d6355]">{group.label}</p>
              <MentionValues items={mentions} kind={group.kind}/>
            </div>)}
          </div>
        </section>:null}
      </div>
    </aside>
  </div>;
}
