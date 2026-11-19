"use client";

import Form from "next/form";
import Link from "next/link";
import {useState,type ReactNode} from "react";
import {EU_MEMBER_COUNTRIES,OTHER_NETWORK_COUNTRIES,networkCountryName} from "@/lib/network-eu-countries";
import {EuProducerIntelligenceChat} from "@/components/eu-producer-intelligence-chat";

import type {NetworkProDirectoryResult} from "@/lib/network-pro-coverage";
import type {NetworkProducerCatalogLink} from "@/lib/network-producer-catalogs";
import type {NetworkProducerTechnicalClaim,ProducerEvidenceKind} from "@/lib/network-producer-technical";
import type {ProducerSourceMention} from "@/lib/network-producer-source-mentions";

type Props={
  result:NetworkProDirectoryResult;
  query:string;
  country:string;
  page:number;
  publishedCount:number|null;
  catalogs:NetworkProducerCatalogLink[]|null;
  technicalClaims:NetworkProducerTechnicalClaim[]|null;
  sourceMentions:ProducerSourceMention[]|null;
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
  const words=name.replace(/\b(s\.?p\.?a\.?|s\.?r\.?l\.?|srl|spa)\b/gi,"").trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0]??"")+(words[1]?.[0]??words[0]?.[1]??"")).toUpperCase()||"P";
}
function hostname(url:string|null){
  if(!url)return null;
  try{return new URL(url).hostname.replace(/^www\./,"");}catch{return null;}
}
function Chip({tone,children}:{tone:"tech"|"docs"|"mention"|"none";children:ReactNode}){
  const cls={
    tech:"border-[#b8dcc6] bg-[#e9f6ee] text-[#155a3c]",
    docs:"border-[#c7d3f0] bg-[#eef2fc] text-[#2f4b8f]",
    mention:"border-[#e3dcc5] bg-[#faf6ea] text-[#6b5313]",
    none:"border-[#e1e6e3] bg-[#f5f7f6] text-[#5b6b63]",
  }[tone];
  return <span className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold "+cls}>{children}</span>;
}

function PageLink({label,query,country,page}:{label:string;query:string;country:string;page:number}){
  const params=new URLSearchParams({q:query,country,p:String(page)});
  return <Link href={"/network/pro/producers?"+params.toString()}
    className="inline-flex min-h-10 items-center rounded-xl border border-[#c9d9ce] bg-white px-4 text-xs font-semibold text-[#18573d] hover:bg-[#f1f7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18573d]">
    {label}
  </Link>;
}

const technicalKinds:{kind:ProducerEvidenceKind;label:string}[]=[
  {kind:"manufacturing_process",label:"Processo produttivo"},
  {kind:"technical_standard",label:"Norme dalle fonti"},
  {kind:"steel_grade",label:"Gradi indicati"},
  {kind:"section_shape",label:"Sezioni"},
  {kind:"dimension_range",label:"Gamme dimensionali"},
];

/** Each fact keeps its own first-party link; a range NEVER asserts a full SKU. */
function EvidenceValues({items,kind}:{items:NetworkProducerTechnicalClaim[]|null;kind:ProducerEvidenceKind}){
  if(items===null)return <span className="italic text-[#687a6e]">Indice non disponibile</span>;
  const matches=items.filter(item=>item.kind===kind);
  if(matches.length===0)return <span className="italic text-[#758479]">Non disponibile in questa vista</span>;
  return <ul className="flex flex-wrap gap-1.5">
    {matches.map(item=><li key={item.id}>
      <a href={item.sourceUrl} title={item.sourceTitle} target="_blank" rel="noopener noreferrer"
        className="inline-flex max-w-[260px] items-center gap-1 break-words rounded-lg border border-[#d0e3d6] bg-[#f4f9f5] px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-[#1b5b40] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#1d6948]">
        {item.value}<span aria-hidden="true">↗</span>
      </a>
    </li>)}
  </ul>;
}

export function NetworkProducersExperience({result,query,country,page,publishedCount,catalogs,technicalClaims,sourceMentions}:Props){
  const countryLabel=networkCountryName(country)||country;
  // Search/pagination navigations can preserve this client component: stale ids must never disable the new result list.
  const selectionScope=JSON.stringify([query,page,country]);
  const [selection,setSelection]=useState<{scope:string;ids:string[]}>({scope:selectionScope,ids:[]});
  const selected=selection.scope===selectionScope?selection.ids:[];
  const clearSelection=()=>setSelection({scope:selectionScope,ids:[]});
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

  return <main className="mx-auto w-full max-w-[1320px] space-y-5 pb-14" data-testid="network-producers-workspace">
    <nav aria-label="Percorso Network" className="flex flex-wrap items-center gap-3 text-xs">
      <Link href={"/network?country="+encodeURIComponent(country)} className="font-semibold text-[#236248] hover:underline">Network</Link>
      <span aria-hidden="true" className="text-[#859c8d]">/</span>
      <Link href="/network/pro" className="font-semibold text-[#236248] hover:underline">Moduli PRO</Link>
      <span aria-hidden="true" className="text-[#859c8d]">/</span>
      <span className="font-semibold text-[#193d2e]">Produttori</span>
    </nav>

    <header className="rounded-[20px] border border-[#dae6de] bg-white px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#43745a]">
            Network <span className="font-extrabold text-[#14543c]">PRO</span> · Intelligence produttori
          </p>
          <h1 className="mt-1.5 text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-[#123c2c] sm:text-[29px]">
            Quale tubo cerchi?
          </h1>
          <p className="mt-1 max-w-[760px] text-[13px] leading-5 text-[#536a5c]">
            Descrivi il tubo: l’AI trova produttori e prove, poi puoi preparare la Distinta / RFQ.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-xl border border-[#dce9df] bg-[#f7faf8] px-3 py-2 sm:self-center"
          aria-label={"Elenco produttori nel Paese "+countryLabel}>
          <span className="text-[11px] text-[#5b7464]">Elenco</span>
          <strong className="text-xs font-extrabold text-[#24563f]">{countryLabel}</strong>
          <span className="h-4 w-px bg-[#cfded2]" aria-hidden="true"/>
          <span className="text-[11px] font-bold tabular-nums text-[#24563f]">
            {publishedCount===null?"—":publishedCount.toLocaleString("it-IT")} aziende
          </span>
        </div>
      </div>
      <details className="group mt-2 border-t border-[#edf2ed] pt-2">
        <summary className="min-h-7 cursor-pointer list-none text-[11px] font-semibold text-[#5b7864] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">Come leggere le evidenze tecniche
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </span>
        </summary>
        <p className="pb-1 text-[11px] leading-4 text-[#698071]">
          Le norme, le misure e i cataloghi tecnici restano qualificazioni documentali separate. Nessuna combinazione norma, grado, dimensione e spessore viene dedotta.
        </p>
      </details>
    </header>

    {country!=="IT"&&technicalClaims!==null&&technicalClaims.length>0?
      <p data-testid="network-producers-eu-evidence" className="text-xs leading-5 text-[#496b56]">
        {technicalClaims.length} evidenze tecniche ufficiali per le aziende nell’elenco · Dati osservati, in attesa di conferma del produttore.
      </p>:null}

    <EuProducerIntelligenceChat/>

    <details className="group overflow-hidden rounded-[17px] border border-[#dce7df] bg-white" open={Boolean(query)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[#22543c] hover:bg-[#f7faf8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden"
        data-testid="network-producers-browse-toggle">
        <span>Sfoglia per azienda o Paese</span>
        <span className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-[#647a6b]">
          {countryLabel}
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
        </span>
      </summary>
      <section className="border-t border-[#edf3ee] px-4 pb-4 pt-3 sm:px-5" aria-labelledby="manufacturer-search-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="manufacturer-search-title" className="text-sm font-bold text-[#254c37]">Ricerca diretta nel Network</h2>
          <Link href="/network/cataloghi" className="text-[11px] font-semibold text-[#276949] underline-offset-2 hover:underline">
            Cataloghi e dati tecnici ↗
          </Link>
        </div>
        <Form action="/network/pro/producers" className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="manufacturer-query" className="sr-only">Nome del produttore o dominio</label>
          <input id="manufacturer-query" name="q" type="search" maxLength={120}
            defaultValue={query} placeholder="Nome produttore o dominio, ad esempio EUROPIPE"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bacfc1] bg-white px-4 text-sm text-[#183d2d] placeholder:text-[#748879] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"/>
          <label htmlFor="manufacturer-country" className="sr-only">Paese del produttore</label>
          <select id="manufacturer-country" name="country" defaultValue={country}
            aria-label="Paese del produttore" data-testid="network-producers-country"
            className="min-h-12 min-w-[148px] rounded-xl border border-[#bacfc1] bg-white px-3 text-sm font-semibold text-[#183d2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
            <optgroup label="Unione europea">
              {EU_MEMBER_COUNTRIES.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}
            </optgroup>
            <optgroup label="Altri Paesi europei">
              {OTHER_NETWORK_COUNTRIES.filter(item=>item.code!=="US").map(item=>
                <option key={item.code} value={item.code}>{item.name}</option>)}
            </optgroup>
          </select>
          <button type="submit" className="min-h-12 rounded-xl bg-[#175640] px-6 text-sm font-bold text-white hover:bg-[#10452f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">Cerca aziende</button>
        </Form>
        <p className="mt-2 text-[11px] leading-4 text-[#718474]">
          La ricerca tecnica per norma, grado e dimensione è disponibile nella chat AI sopra; qui puoi filtrare soltanto per nome, dominio o Paese.
        </p>
      </section>
    </details>

    {result.status==="locked"?
      <section role="status" className="grid gap-4 rounded-[22px] border border-[#d7e2d8] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7">
        <div>
          <h2 className="text-lg font-extrabold text-[#153e2c]">Sblocca Intelligence Produttori</h2>
          <p className="mt-2 max-w-[700px] text-sm leading-6 text-[#546b5c]">
            {"Esplora e confronta aziende pubblicate con il modulo Produttori "+(country==="IT"?"Italia":"Europa")+"."}{" "}
            Nessun altro modulo è necessario. L'attivazione avverrà dopo conferma del pagamento,
            quando il checkout sarà operativo.
          </p>
        </div>
        <Link href="/network/pro" style={{color:"#ffffff",WebkitTextFillColor:"#ffffff"}}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#175640] px-5 text-sm font-bold text-white">
          Scopri il modulo Produttori
        </Link>
      </section>
    :result.status==="unavailable"?
      <section role="status" className="rounded-2xl border border-[#dfd6bc] bg-[#fffcf5] p-5 text-sm text-[#72552f]">
        Dati autorizzati temporaneamente non disponibili. Nessun risultato provvisorio viene mostrato.
      </section>
    :<>
      <section aria-label="Risultati produttori" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#183d2d]">Produttori pubblicati</h2>
            <p className="text-xs text-[#607667]">
              {total?.toLocaleString("it-IT")} risultati{pages>1?" · pagina "+page+" di "+pages:""} · Seleziona fino a tre aziende da confrontare
            </p>
          </div>
          {selectedCompanies.length>0?<span className="rounded-lg border border-[#c9ddcf] bg-[#f4f9f5] px-3 py-2 text-xs font-bold text-[#275a40]">
            {selectedCompanies.length} / 3 selezionati
          </span>:null}
        </div>
        {companies.length===0?
          <div className="rounded-xl border border-[#dce7df] bg-white p-6 text-sm text-[#64776a]">
            Nessuna azienda pubblicata corrisponde alla ricerca.
          </div>
        :<>
        {/* NET-PRO-UX2: compact list instead of stretched cards — evidence at a glance, details on demand. */}
        <ul className="divide-y divide-[#e6eee8] overflow-hidden rounded-[20px] border border-[#d9e5dc] bg-white" data-testid="network-producers-list">
          {companies.map(company=>{
            const active=selected.includes(company.id);
            const url=website(company);
            const domain=hostname(url);
            const docs=catalogs?.filter(doc=>doc.companyId===company.id)??[];
            const evidence=technicalClaims?.filter(item=>item.companyId===company.id)??[];
            const mentions=sourceMentions?.filter(item=>item.companyId===company.id)??[];
            const hasDetails=evidence.length>0||docs.length>0||mentions.length>0;
            return <li key={company.id} data-testid="network-producer-row" className={"min-w-0 transition-colors "+(active?"bg-[#f1f8f3]":"hover:bg-[#fafcfb]")}>
              <article className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf4ee] text-[13px] font-extrabold text-[#285641]">
                  {initials(company.name)}
                </span>
                <div className="min-w-0 flex-1 basis-[240px]">
                  <h3 className="break-words text-[15px] font-extrabold leading-5 text-[#173c2c]">{company.name}</h3>
                  <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-[#607769]">
                    <span>{networkCountryName(company.countryCode)||company.countryCode} · Produttore</span>
                    {url&&domain?<a href={url} target="_blank" rel="noopener noreferrer"
                      aria-label={"Sito ufficiale di "+company.name}
                      className="max-w-full break-all font-semibold text-[#246348] underline-offset-2 hover:underline">
                      {domain} ↗
                    </a>:null}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {evidence.length>0?<Chip tone="tech">Dati tecnici con fonte · {evidence.length}</Chip>:
                      docs.length>0?<Chip tone="docs">Cataloghi ufficiali · {docs.length}</Chip>:
                      mentions.length>0?<Chip tone="mention">Menzioni da qualificare · {mentions.length}</Chip>:
                      <Chip tone="none">Norme, gamma e cataloghi in qualificazione</Chip>}
                    {technicalClaims===null?<span className="text-[11px] text-[#8b6b45]">Dati tecnici momentaneamente non disponibili.</span>:null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" aria-pressed={active} disabled={!active&&selected.length>=3}
                    onClick={()=>toggle(company.id)}
                    className={"inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:opacity-50 "+
                      (active?"border-[#175640] bg-[#175640] text-white":"border-[#bcd5c5] bg-white text-[#175640] hover:bg-[#eef6f0]")}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      {active?<path d="M5 12.5l4.5 4.5L19 7.5"/>:<><path d="M12 5v14"/><path d="M5 12h14"/></>}
                    </svg>
                    {active?"Nel confronto":"Confronta"}
                  </button>

                </div>
              </article>
              {hasDetails?<details className="group border-t border-[#eef3ef] bg-[#fbfdfc]">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 px-4 text-xs font-extrabold text-[#1c573a] hover:bg-[#f3f8f4] [&::-webkit-details-marker]:hidden">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                  Dettagli tecnici e fonti
                  <span className="ml-auto text-[11px] font-semibold text-[#607667]">
                    {evidence.length>0?"Evidenze "+evidence.length:docs.length>0?"Cataloghi "+docs.length:"Fonti "+mentions.length}
                  </span>
                </summary>
                <div className="grid gap-4 px-4 pb-4 pt-1 lg:grid-cols-3">
                  {evidence.length>0?<div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-[#1c573a]">Dati tecnici con fonte ({evidence.length})</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#587363]">
                      Sono presenti dati tecnici attribuiti a fonti ufficiali. Nessuna combinazione dimensione/grado è garantita,
                      né la disponibilità o una certificazione verificata da Smart Steel Sales.
                    </p>
                    <div className="mt-2 space-y-2.5">
                      {technicalKinds.filter(group=>evidence.some(item=>item.kind===group.kind)).map(group=><div key={group.kind}>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#546c5a]">{group.label}</p>
                        <EvidenceValues items={evidence} kind={group.kind}/>
                      </div>)}
                    </div>
                  </div>:null}
                  {docs.length>0?<div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-[#2f4b8f]">Cataloghi ufficiali ({docs.length})</p>
                    <ul className="mt-2 space-y-2">
                      {docs.map(doc=><li key={doc.id}>
                        <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-semibold leading-5 text-[#1e6948] underline underline-offset-2">
                          {doc.title}
                        </a>
                        <p className="mt-0.5 text-[10px] text-[#657d6c]">
                          {doc.documentType==="official_pdf"?"PDF sul sito produttore":"Pagina sul sito produttore"}
                          {doc.editionYear?" · Edizione "+doc.editionYear:""}
                          {" · Collegamento esterno"}
                        </p>
                      </li>)}
                    </ul>
                  </div>:null}
                  {mentions.length>0?<div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-[#6b5313]">Menzioni tecniche rilevate ({mentions.length}) · da qualificare</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#647768]">
                      Parole tecniche individuate e confermate sulla pagina ufficiale.
                      Una menzione NON dimostra che l'azienda produca una specifica combinazione
                      di norma, materiale, dimensioni o che abbia disponibilità.
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {mentions.map(m=><li key={m.id}>
                        <a target="_blank" rel="noopener noreferrer" href={m.sourceUrl}
                          className="inline-flex min-h-9 items-center rounded-lg border border-[#dae5dc] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#315b45] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                          {m.value} ↗
                        </a>
                      </li>)}
                    </ul>
                  </div>:null}
                </div>
              </details>:null}
            </li>;
          })}
        </ul>
        <p className="text-[11px] leading-5 text-[#647767]">
          «In qualificazione»: norme, gamma produttiva e cataloghi non ancora collegati. La scheda non implica disponibilità
          o produzione di una specifica misura.
        </p>
        </>}
      </section>
      {selectedCompanies.length>0?<section id="producer-compare" aria-labelledby="producer-compare-title"
        className="scroll-mt-24 overflow-hidden rounded-[20px] border border-[#c9ded0] bg-white">
        <div className="border-b border-[#e0ebe3] bg-[#f4f9f5] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="producer-compare-title" className="text-base font-extrabold text-[#153f2d]">Confronto produttori</h2>
              <p className="mt-1 text-xs leading-5 text-[#5b7463]">
                Norme, processi e gamme riportati con link alle pagine ufficiali.
                Le misure sono intervalli indicativi: non dimostrano una specifica combinazione
                di diametro, spessore e grado, né stock o capacità disponibile.
              </p>
            </div>
            <button type="button" onClick={clearSelection} className="min-h-10 text-xs font-bold text-[#185740] underline">Svuota</button>
          </div>
        </div>
        {/* UX4.D: phones get vertical evidence-backed cards, never a 580px table. */}
        <div className="grid gap-3 p-3 md:hidden" data-testid="producer-compare-mobile">
          {selectedCompanies.map(company=>{
            const scopedClaims=technicalClaims?.filter(claim=>claim.companyId===company.id)
              ??(technicalClaims===null?null:[]);
            const scopedCatalogs=catalogs?.filter(link=>link.companyId===company.id)??[];
            return <article key={company.id} className="min-w-0 rounded-xl border border-[#dce7df] bg-white p-3">
              <h3 className="break-words text-sm font-extrabold text-[#173c2c]">{company.name}</h3>
              <p className="mt-0.5 text-[11px] text-[#607667]">
                {networkCountryName(company.countryCode)||company.countryCode} · Dati tecnici osservati
              </p>
              <dl className="mt-3 space-y-3">
                {technicalKinds.map(group=><div key={group.kind}>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-[#536c5b]">{group.label}</dt>
                  <dd className="mt-1 text-xs text-[#506557]">
                    <EvidenceValues items={scopedClaims} kind={group.kind}/>
                  </dd>
                </div>)}
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-[#536c5b]">Cataloghi ufficiali</dt>
                  <dd className="mt-1 text-xs text-[#506557]">
                    {catalogs===null?"Indice non disponibile":scopedCatalogs.length>0
                      ?scopedCatalogs.length+" collegamenti":"Non ancora indicizzati"}
                  </dd>
                </div>
              </dl>
            </article>;
          })}
        </div>
        <div className="hidden w-full overflow-x-auto md:block" data-testid="producer-compare-desktop">
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
        className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex w-full max-w-[760px] flex-nowrap items-center gap-2 rounded-xl bg-[#123a2e] px-3 py-2 text-white shadow-[0_10px_22px_rgba(10,32,25,0.22)] lg:bottom-5">
        <span className="shrink-0 whitespace-nowrap text-[11px] font-extrabold sm:text-xs">{selectedCompanies.length} / 3 nel confronto</span>
        <span className="hidden min-w-0 flex-1 truncate text-[11px] text-[#cfe6db] sm:inline">{selectedCompanies.map(c=>c.name).join(" · ")}</span>
        <a href="#producer-compare" style={{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" }} className="ml-auto inline-flex min-h-9 items-center rounded-xl bg-[#f2b544] px-3 text-xs font-extrabold text-[#2a1c00] hover:bg-[#f6c460] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Vedi confronto ↓</a>
        <button type="button" onClick={clearSelection} className="hidden min-h-9 rounded-xl border border-white/30 px-3 text-xs font-bold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inline-flex">Svuota</button>
      </div>:null}
      <nav aria-label="Navigazione produttori" className="flex items-center justify-between gap-2">
        {page>1?<PageLink label="← Precedenti" query={query} country={country} page={page-1}/>:<span/>}
        {result.data.total>page*result.data.limit?
          <PageLink label="Successive →" query={query} country={country} page={page+1}/>:<span/>}
      </nav>
    </>}


  </main>;
}
