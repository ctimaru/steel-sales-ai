"use client";

import Link from "next/link";
import {useState} from "react";

import type {NetworkProDirectoryResult} from "@/lib/network-pro-coverage";
import type {NetworkProducerCatalogLink} from "@/lib/network-producer-catalogs";
import type {NetworkProducerTechnicalClaim,ProducerEvidenceKind} from "@/lib/network-producer-technical";
import type {ProducerSourceMention} from "@/lib/network-producer-source-mentions";

type Props={
  result:NetworkProDirectoryResult;
  query:string;
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

function PageLink({label,query,page}:{label:string;query:string;page:number}){
  const params=new URLSearchParams({q:query,p:String(page)});
  return <Link href={"/network/pro/producers?"+params.toString()}
    className="inline-flex min-h-10 items-center rounded-xl border border-[#c9d9ce] bg-white px-4 text-xs font-semibold text-[#18573d] hover:bg-[#f1f7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18573d]">
    {label}
  </Link>;
}

const technicalKinds:{kind:ProducerEvidenceKind;label:string}[]=[
  {kind:"manufacturing_process",label:"Processo produttivo"},
  {kind:"technical_standard",label:"Norme dichiarate"},
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

export function NetworkProducersExperience({result,query,page,publishedCount,catalogs,technicalClaims,sourceMentions}:Props){
  const [selected,setSelected]=useState<string[]>([]);
  const companies=result.status==="ready"?result.data.items:[];
  const selectedCompanies=selected.flatMap(id=>{
    const found=companies.find(company=>company.id===id);
    return found?[found]:[];
  });
  function toggle(id:string){
    setSelected(current=>current.includes(id)
      ?current.filter(value=>value!==id)
      :current.length<3?[...current,id]:current);
  }
  const total=result.status==="ready"?result.data.total:null;

  return <main className="mx-auto w-full max-w-[1320px] space-y-5 pb-14" data-testid="network-producers-workspace">
    <nav aria-label="Percorso Network" className="flex flex-wrap items-center gap-3 text-xs">
      <Link href="/network" className="font-semibold text-[#236248] hover:underline">Network</Link>
      <span aria-hidden="true" className="text-[#859c8d]">/</span>
      <Link href="/network/pro" className="font-semibold text-[#236248] hover:underline">Moduli PRO</Link>
      <span aria-hidden="true" className="text-[#859c8d]">/</span>
      <span className="font-semibold text-[#193d2e]">Produttori</span>
    </nav>

    <header className="overflow-hidden rounded-[24px] border border-[#d7e5db] bg-[linear-gradient(125deg,#eef7f0,#ffffff)] p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#14543c] px-3 py-1 text-[10px] font-extrabold tracking-wide text-white">NETWORK PRO</span>
        <span className="rounded-full border border-[#b8d6c3] bg-white px-3 py-1 text-[10px] font-bold tracking-wide text-[#275a40]">INTELLIGENCE PRODUTTORI</span>
        <span className="rounded-full border border-[#bddac6] bg-white px-3 py-1 text-[10px] font-bold text-[#175640]">INCLUSO NEL MODULO PRODUTTORI</span>
        <span className="rounded-full border border-[#d0e3d5] bg-white px-3 py-1 text-[10px] font-semibold text-[#496b56]">Italia</span>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
        <div>
          <h1 className="max-w-[780px] text-[27px] font-extrabold leading-[1.13] tracking-[-0.04em] text-[#123c2c] sm:text-[38px]">
            Trova e confronta chi produce acciaio.
          </h1>
          <p className="mt-3 max-w-[780px] text-sm leading-6 text-[#4d6355]">
            Iniziamo dai tubifici italiani. La prima vista mostra soltanto aziende
            pubblicate con ruolo produttore; la prova della produzione di tubi,
            le norme e i cataloghi tecnici sono qualificazioni distinte.
          </p>
        </div>
        <div className="rounded-2xl border border-[#cde0d2] bg-white p-4 shadow-[0_7px_24px_rgba(16,65,40,0.06)]">
          <p className="text-[11px] font-semibold text-[#526d5c]">Produttori industriali IT pubblicati</p>
          <p className="mt-1 text-[34px] font-extrabold tabular-nums text-[#164a32]">
            {publishedCount===null?"—":publishedCount.toLocaleString("it-IT")}
          </p>
          <p className="text-[11px] leading-4 text-[#61786a]">
            Non equivalgono a tubifici verificati. Nessuna candidatura è conteggiata.
          </p>
        </div>
      </div>
    </header>

    <section className="rounded-[20px] border border-[#dce7df] bg-white p-4 sm:p-5" aria-labelledby="manufacturer-search-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="manufacturer-search-title" className="text-base font-extrabold text-[#183d2d]">
          Cerca i produttori nel Network
        </h2>
        <span className="text-[11px] font-semibold text-[#607669]">Ricerca azienda e dominio · Italia</span>
      </div>
      <form method="get" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="manufacturer-query" className="sr-only">Nome del produttore o dominio</label>
        <input id="manufacturer-query" name="q" type="search" maxLength={120}
          defaultValue={query} placeholder="Nome produttore o dominio, ad esempio Marcegaglia"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#bacfc1] bg-white px-4 text-sm text-[#183d2d] placeholder:text-[#748879] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"/>
        <button type="submit" className="min-h-12 rounded-xl bg-[#175640] px-6 text-sm font-bold text-white hover:bg-[#10452f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">Cerca</button>
      </form>
      <p className="mt-3 text-xs leading-5 text-[#5d7262]">
        La ricerca tecnica per norma, grado e dimensione sarà attiva dopo il
        collegamento ai cataloghi con fonte. Non vengono inferite capacità o misure.
      </p>
    </section>

    {result.status==="locked"?
      <section role="status" className="grid gap-4 rounded-[22px] border border-[#d7e2d8] bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7">
        <div>
          <h2 className="text-lg font-extrabold text-[#153e2c]">Sblocca Intelligence Produttori</h2>
          <p className="mt-2 max-w-[700px] text-sm leading-6 text-[#546b5c]">
            Esplora e confronta aziende pubblicate con il modulo Produttori Italia.
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
      <section aria-label="Risultati produttori" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[#183d2d]">Produttori pubblicati</h2>
            <p className="text-xs text-[#607667]">
              {total?.toLocaleString("it-IT")} risultati · Seleziona fino a tre aziende da confrontare
            </p>
          </div>
          <span className="rounded-lg border border-[#c9ddcf] bg-[#f4f9f5] px-3 py-2 text-xs font-bold text-[#275a40]">
            {selectedCompanies.length} / 3 selezionati
          </span>
        </div>
        {companies.length===0?
          <div className="rounded-xl border border-[#dce7df] bg-white p-6 text-sm text-[#64776a]">
            Nessuna azienda pubblicata corrisponde alla ricerca.
          </div>
        :<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {companies.map(company=>{
            const active=selected.includes(company.id);
            const url=website(company);
            const docs=catalogs?.filter(doc=>doc.companyId===company.id)??[];
            const evidence=technicalClaims?.filter(item=>item.companyId===company.id)??[];
            const mentions=sourceMentions?.filter(item=>item.companyId===company.id)??[];
            return <article key={company.id} className={"flex min-w-0 flex-col gap-4 rounded-[18px] border bg-white p-4 shadow-[0_6px_18px_rgba(23,68,46,0.035)] "+
              (active?"border-[#327952] ring-1 ring-[#bddbc6]":"border-[#d9e5dc]")}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e6f2e9] text-[22px]">🏭</span>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-extrabold leading-5 text-[#173c2c]">{company.name}</h3>
                  <p className="mt-1 text-xs text-[#607769]">Italia · Ruolo produttore registrato</p>
                </div>
              </div>
              <p className="min-h-10 text-xs leading-5 text-[#647767]">
                {evidence.length>0
                  ?"Sono presenti dati tecnici attribuiti a fonti ufficiali. Nessuna combinazione dimensione/grado è garantita."
                  :"Norme, gamma produttiva e cataloghi: in qualificazione. La scheda non implica disponibilità o produzione di una specifica misura."}
              </p>
              {mentions.length>0?<details className="rounded-xl border border-[#dde6df] bg-[#fafcfb] p-3">
                <summary className="cursor-pointer text-xs font-extrabold text-[#365746]">
                  Menzioni tecniche rilevate ({mentions.length}) · da qualificare
                </summary>
                <p className="mt-2 text-[11px] leading-5 text-[#647768]">
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
              </details>:null}
              {evidence.length>0?<details className="rounded-xl border border-[#cde2d3] bg-[#f8fbf9] p-3">
                <summary className="cursor-pointer text-xs font-extrabold text-[#1c573a]">
                  Dati tecnici con fonte ({evidence.length})
                </summary>
                <p className="mt-2 text-[11px] leading-5 text-[#587363]">
                  Dichiarazioni presenti sui siti ufficiali. Non costituiscono conferma di una misura esatta,
                  della disponibilità, né di una certificazione verificata da Smart Steel Sales.
                </p>
                <div className="mt-3 space-y-3">
                  {technicalKinds.filter(group=>evidence.some(item=>item.kind===group.kind)).map(group=><div key={group.kind}>
                    <p className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[#546c5a]">{group.label}</p>
                    <EvidenceValues items={evidence} kind={group.kind}/>
                  </div>)}
                </div>
              </details>:technicalClaims===null?<p className="text-[11px] text-[#8b6b45]">Dati tecnici momentaneamente non disponibili.</p>:null}
              {docs.length>0?<details className="rounded-xl border border-[#d5e5d9] bg-[#f7faf8] p-3">
                <summary className="cursor-pointer text-xs font-extrabold text-[#1c573a]">
                  Cataloghi ufficiali ({docs.length})
                </summary>
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
              </details>:null}
              <div className="mt-auto flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={active} disabled={!active&&selected.length>=3}
                  onClick={()=>toggle(company.id)}
                  className={"min-h-10 flex-1 rounded-xl border px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:opacity-50 "+
                    (active?"border-[#175640] bg-[#175640] text-white":"border-[#bcd5c5] bg-[#f4f9f5] text-[#175640] hover:bg-[#e6f1e9]")}>
                  {active?"Rimuovi confronto":"Confronta"}
                </button>
                {url?<a href={url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#ccddd1] px-3 text-xs font-bold text-[#175640] hover:bg-[#f3f8f4]">
                  Sito ufficiale
                </a>:null}
              </div>
            </article>;
          })}
        </div>}
      </section>
      {selectedCompanies.length>0?<section aria-labelledby="producer-compare-title"
        className="overflow-hidden rounded-[20px] border border-[#c9ded0] bg-white">
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
            <button type="button" onClick={()=>setSelected([])} className="min-h-10 text-xs font-bold text-[#185740] underline">Svuota</button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[580px] border-collapse text-left text-xs">
            <thead><tr className="bg-white text-[#1b422f]"><th scope="col" className="w-36 border-b border-[#e5ede6] p-4">Criterio</th>
              {selectedCompanies.map(company=><th scope="col" key={company.id} className="min-w-36 border-b border-[#e5ede6] p-4 font-extrabold">{company.name}</th>)}</tr></thead>
            <tbody className="text-[#506557]">
              <tr><th scope="row" className="border-b border-[#e5ede6] p-4 font-bold">Paese</th>
                {selectedCompanies.map(c=><td key={c.id} className="border-b border-[#e5ede6] p-4">Italia</td>)}</tr>
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
      <nav aria-label="Navigazione produttori" className="flex items-center justify-between gap-2">
        {page>1?<PageLink label="← Precedenti" query={query} page={page-1}/>:<span/>}
        {result.data.total>page*result.data.limit?
          <PageLink label="Successive →" query={query} page={page+1}/>:<span/>}
      </nav>
    </>}

    <section className="grid gap-3 md:grid-cols-3" aria-label="Funzioni in arricchimento">
      {[
        {title:"Cataloghi e fonti",text:"Link ufficiali e dati tecnici documentati; nessun PDF copiato o licenza presunta."},
        {title:"Ricerca per misura",text:"Stiamo costruendo la ricerca esatta per norma, grado e dimensioni; i range da soli non confermano la producibilità."},
        {title:"Dal produttore alla RFQ",text:"Dalla ricerca alla Distinta e alla richiesta commerciale mantenendo il contesto."},
      ].map(x=><article key={x.title} className="rounded-[18px] border border-[#dbe6de] bg-[#f7faf8] p-4">
        <h2 className="text-sm font-extrabold text-[#17402e]">{x.title}</h2>
        <p className="mt-2 text-xs leading-5 text-[#5e7564]">{x.text}</p>
      </article>)}
    </section>
  </main>;
}
