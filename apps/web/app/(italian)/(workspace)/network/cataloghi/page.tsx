import Link from "next/link";
import Form from "next/form";
import {redirect} from "next/navigation";

import {getCataloguePreview,type CataloguePreviewObservation} from "@/lib/network-producer-catalog-preview";
import {getProducerStructuredCatalog} from "@/lib/network-producer-structured-catalog";
import {ProducerStructuredCatalogue} from "@/components/producer-structured-catalogue";
import {getPdfDimensions} from "@/lib/network-producer-pdf-dimensions";
import {ProducerPdfSizeTables} from "@/components/producer-pdf-size-tables";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";

export const dynamic="force-dynamic";

const groupNames:Record<CataloguePreviewObservation["kind"],string>={
  technical_standard:"Norme",
  steel_grade:"Acciai",
  section_shape:"Sezioni",
  dimension_range:"Dimensioni / gamme",
  manufacturing_process:"Processi",
};
const order:CataloguePreviewObservation["kind"][]=[
  "technical_standard","steel_grade","section_shape","dimension_range","manufacturing_process",
];

export default async function CataloghiProduttoriPreview({
  searchParams,
}:{searchParams:Promise<{q?:string}>}){
  if(!isNetworkFrontendEnabled())redirect("/dashboard");
  const params=await searchParams;
  const q=(params.q??"").trim().slice(0,80);
  const [result,structured,pdfSizes]=await Promise.all([
    getCataloguePreview(q),getProducerStructuredCatalog(q),getPdfDimensions(q),
  ]);

  return <main className="mx-auto max-w-[1320px] space-y-5 pb-14" data-testid="network-cataloghi-preview">
    <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2b6749]">
      <Link href="/network" className="hover:underline">Network</Link>
      <span className="text-[#809585]">/</span>
      <span className="text-[#1c412f]">Cataloghi produttori</span>
    </nav>
    <header className="overflow-hidden rounded-[24px] border border-[#cfdfd4] bg-[linear-gradient(125deg,#eaf6ee,#ffffff_74%)] p-5 sm:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#174a36] px-3 py-1 text-[11px] font-bold text-white">INTELLIGENCE PRODUTTORI</span>
        <span className="rounded-full border border-[#b8d5c4] bg-white px-3 py-1 text-[11px] font-bold text-[#216147]">PRIMI CATALOGHI REALI</span>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(250px,350px)] md:items-end">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-[#153f2d] sm:text-4xl">
            Dati tecnici industriali, già utilizzabili.
          </h1>
          <p className="mt-3 max-w-[740px] text-sm leading-6 text-[#4b6856]">
            Dati strutturati dai produttori: norme, qualità, lavorazioni e gamme
            dimensionali osservate. Non serve attendere il claim aziendale per esplorare
            le fonti. Ogni informazione è <strong>da confermare dal produttore</strong>
            prima di considerarla una specifica capacità produttiva.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#d1e3d7] bg-white p-4 shadow-sm">
          {[
            {value:result?.sourcesTotal,label:"Fonti"},
            {value:result?.producersTotal,label:"Aziende"},
            {value:result?.observationsTotal,label:"Dati"},
          ].map(item=><div key={item.label} className="min-w-0 text-center">
            <p className="text-2xl font-extrabold tabular-nums text-[#184932]">{item.value??"—"}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#627b69]">{item.label}</p>
          </div>)}
        </div>
      </div>
    </header>
    <section className="rounded-[20px] border border-[#d9e5db] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#204632]">Cerca nei cataloghi e nelle specifiche</h2>
        <Link href="/network/pro/producers" className="text-xs font-bold text-[#21664b] underline underline-offset-2">
          Confronto Produttori PRO
        </Link>
      </div>
      <Form action="/network/cataloghi" className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} maxLength={80}
          placeholder="Produttore, EN 10219, S355J2H, inox, quadro..."
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#c6d9cc] bg-white px-4 text-sm text-[#214432] placeholder:text-[#7b9180] focus-visible:outline-2 focus-visible:outline-[#1e6645]"/>
        <button className="min-h-11 rounded-xl bg-[#18553b] px-6 text-sm font-bold text-white hover:bg-[#276b4b]">
          Cerca
        </button>
        {q?<Link href="/network/cataloghi"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b9d0be] px-4 text-sm font-semibold text-[#235a40]">
          Azzera
        </Link>:null}
      </Form>
      <p className="mt-2 text-[11px] text-[#597264]">
        La ricerca trova attributi presenti nelle fonti. Non certifica combinazioni norma ×
        qualità × misura, né disponibilità, stock o produzione su ordinazione.
      </p>
    </section>

    <ProducerPdfSizeTables data={pdfSizes}/>
    <ProducerStructuredCatalogue result={structured} query={q}/>

    {result===null?
      <section role="alert" className="rounded-xl border border-[#eddbc2] bg-[#fffcf4] p-5 text-sm text-[#795520]">
        Indice temporaneamente non disponibile. Non vengono mostrati dati simulati.
      </section>
    :result.items.length===0?
      <section className="rounded-xl border border-[#dce6dd] bg-white p-5 text-sm text-[#607364]">
        Nessun catalogo corrisponde alla ricerca. Prova con produttore, norma o qualità.
      </section>
    :<details className="rounded-[20px] border border-[#dce6df] bg-[#fafcfb] p-4">
      <summary className="cursor-pointer py-2 text-sm font-bold text-[#1c5a3d]">
        Mostra le fonti originali e le schede di provenienza ({result.items.length})
      </summary>
      <section aria-label="Cataloghi e pagine prodotto ufficiali" className="mt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#173b2d]">Fonti censite</h2>
        <p className="text-xs text-[#6b806f]">{result.items.length} risultati visualizzati · Fonti esterne ufficiali</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {result.items.map(item=>{
          const groups=order.map(kind=>({
            kind,label:groupNames[kind],values:item.observations.filter(o=>o.kind===kind),
          })).filter(group=>group.values.length);
          return <article key={item.id}
            className="min-w-0 overflow-hidden rounded-[20px] border border-[#dce8df] bg-white shadow-[0_4px_15px_rgba(15,61,39,0.035)]"
            data-testid="catalog-preview-card">
            <div className="border-b border-[#e9eee9] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#29684c]">
                  {item.companyName}
                </span>
                <span className="rounded-full border border-[#e5d9ba] bg-[#fff8e8] px-2.5 py-1 text-[10px] font-bold text-[#77521b]">
                  Da confermare dal produttore
                </span>
              </div>
              <h3 className="mt-2 text-[15px] font-bold leading-6 text-[#183e2b]">{item.title}</h3>
              <p className="mt-1 text-xs text-[#6b7d70]">
                {item.documentType==="official_pdf"?"Catalogo PDF ufficiale":"Pagina prodotti ufficiale"}
                {item.editionYear?" · Edizione "+item.editionYear:""}
                {" · "+item.observations.length+" dati associati"}
              </p>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-[#b9d7c3] bg-[#f2f9f4] px-4 text-xs font-bold text-[#1c6044] underline-offset-2 hover:underline"
                aria-label={"Apri fonte originale: "+item.title}>
                Apri catalogo originale ↗
              </a>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {groups.length?groups.map(group=><div key={group.kind}>
                <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#647e6a]">{group.label}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {group.values.map((value,i)=><li key={i}
                    title={value.sourceTitle}
                    className="max-w-full rounded-lg border border-[#d3e4d7] bg-[#f7faf8] px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-[#244b36]">
                    {value.value}
                  </li>)}
                </ul>
              </div>):<p className="text-xs italic text-[#718675]">
                Catalogo censito: dettagli tecnici ancora da acquisire.
              </p>}
              <p className="border-t border-[#edf1ed] pt-3 text-[11px] leading-5 text-[#718174]">
                Fonte attribuita al produttore · Nessuna misura o combinazione
                produttiva dichiarata come confermata da Smart Steel Sales.
              </p>
            </div>
          </article>;
        })}
      </div>
      </section>
    </details>}
    <footer className="rounded-[20px] border border-[#d5e5d9] bg-[#f6faf7] p-5">
      <h2 className="text-sm font-bold text-[#1f5138]">Dalla consultazione all'Intelligence Produttori PRO</h2>
      <p className="mt-2 text-xs leading-6 text-[#577261]">
        L'anteprima mostra dati osservati e collegamenti esterni, senza archiviare copie
        integrali dei PDF. L'analisi avanzata servirà a documentare combinazioni tecniche
        esatte e a richiedere la conferma del produttore prima di un'offerta.
      </p>
      <Link href="/network/pro/producers"
        className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#18553b] px-4 text-xs font-bold text-white">
        Vai all'Intelligence Produttori
      </Link>
    </footer>
  </main>;
}
