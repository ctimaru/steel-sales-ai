import Link from "next/link";

import type {ProducerStructuredFact,StructuredCatalogResult} from "@/lib/network-producer-structured-catalog";

const kinds:ProducerStructuredFact["kind"][]=[
  "technical_standard","steel_grade","section_shape","manufacturing_process",
];
const titles:Record<string,string>={
  "en-10219-structural":"Tubi strutturali EN 10219",
  "en-10219-carbon":"Tubi strutturali al carbonio",
  "carbon-welded":"Tubi saldati al carbonio",
  "civil-industrial-pipes":"Tubi per installazioni",
  "inox-welded-sections":"Tubi e profilati inox",
  "inox-round-small-diameter":"Tubi inox di piccolo diametro",
  "inox-welded-tubes":"Tubi inox saldati",
};
const labels:Record<string,string>={
  technical_standard:"Norme citate",
  steel_grade:"Qualità citate",
  section_shape:"Sezioni citate",
  manufacturing_process:"Lavorazioni",
};
const number=new Intl.NumberFormat("it-IT",{maximumFractionDigits:3});
function range(a:number|null,b:number|null){
  return a!==null&&b!==null
    ?number.format(a)+"–"+number.format(b):"—";
}
function shape(fact:ProducerStructuredFact){
  return fact.shapeCode==="CHS"?"Tondo":
    fact.shapeCode==="SHS"?"Quadro":
    fact.shapeCode==="RHS"?"Rettangolare":"Non indicata";
}
function dimensionDisplay(fact:ProducerStructuredFact){
  if(fact.diameterMin!==null)return "Ø "+range(fact.diameterMin,fact.diameterMax);
  if(fact.widthMin!==null&&fact.heightMin!==null){
    return number.format(fact.widthMin)+"×"+number.format(fact.heightMin)+
      " → "+number.format(fact.widthMax??0)+"×"+number.format(fact.heightMax??0);
  }
  return fact.kind==="dimension_range"?"Non specificata":"—";
}

type FactGroup={
  companyId:string;
  companyName:string;
  productScope:string;
  facts:ProducerStructuredFact[];
};

function groupsOf(items:ProducerStructuredFact[]):FactGroup[]{
  const groups=new Map<string,FactGroup>();
  for(const item of items){
    const key=item.companyId+"::"+item.productScope;
    let group=groups.get(key);
    if(!group){
      group={companyId:item.companyId,companyName:item.companyName,productScope:item.productScope,facts:[]};
      groups.set(key,group);
    }
    group.facts.push(item);
  }
  return [...groups.values()];
}

export function ProducerStructuredCatalogue({
  result,query,
}:{result:StructuredCatalogResult|null;query:string}){
  if(result===null){
    return <section className="rounded-2xl border border-[#eadcbd] bg-[#fffaf0] p-5 text-sm text-[#815b24]">
      Dati tecnici temporaneamente non disponibili. Non vengono mostrati valori simulati.
    </section>;
  }
  const groups=groupsOf(result.items);
  const ranges=result.items.filter(x=>x.kind==="dimension_range").length;
  return <section className="space-y-4" aria-label="Dati industriali strutturati">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-[20px] border border-[#d2e3d8] bg-white p-4 sm:p-5">
      <div>
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#26724f]">Dati già disponibili · Senza aprire PDF</p>
        <h2 className="mt-1 text-xl font-extrabold text-[#173e2c] sm:text-2xl">Database tecnico dei produttori</h2>
        <p className="mt-2 max-w-[780px] text-xs leading-5 text-[#566e5e]">
          Valori estratti da fonti pubbliche e trasformati in campi utilizzabili. Ogni norma,
          qualità e gamma è un dato indipendente: non indica automaticamente che il produttore
          realizzi qualunque combinazione dei valori elencati.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-xl bg-[#e9f6ec] px-3 py-2 text-xs font-bold text-[#1a5a3b]">{result.totalFacts} attributi</span>
        <span className="rounded-xl bg-[#e9f6ec] px-3 py-2 text-xs font-bold text-[#1a5a3b]">{ranges} gamme visibili</span>
        <span className="rounded-xl bg-[#f3f4f3] px-3 py-2 text-xs font-bold text-[#526a5b]">{result.producers} produttori con dati</span>
      </div>
    </div>
    {groups.length===0?
      <div className="rounded-xl border border-[#d9e5de] bg-white p-6 text-sm text-[#637665]">
        Nessun dato strutturato per «{query}». Prova una norma, qualità o produttore.
      </div>
    :<div className="grid gap-3 xl:grid-cols-2" data-testid="producer-structured-grid">
      {groups.map(group=>{
        const dimensional=group.facts.filter(x=>x.kind==="dimension_range");
        const confirmed=group.facts.filter(x=>x.reviewStatus==="attribute_confirmed_by_producer").length;
        return <article key={group.companyId+"-"+group.productScope}
          className="min-w-0 overflow-hidden rounded-[20px] border border-[#dce7de] bg-white shadow-[0_5px_20px_rgba(15,52,30,0.04)]"
          data-testid="producer-structured-card">
          <div className="border-b border-[#e9f0ea] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#2b6747]">
                {group.companyName}
              </p>
              <span className="rounded-full bg-[#fff6e3] px-2.5 py-1 text-[10px] font-bold text-[#865a1b]">
                Da confermare dal produttore
              </span>
            </div>
            <h3 className="mt-1 text-lg font-extrabold text-[#193e2c]">
              {titles[group.productScope]??group.productScope.replaceAll("-"," ")}
            </h3>
            <p className="mt-1 text-[11px] text-[#65796a]">
              {group.facts.length} informazioni con fonte
              {confirmed?" · "+confirmed+" attributi confermati dall'azienda":""}
            </p>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            {kinds.map(kind=>{
              const facts=group.facts.filter(x=>x.kind===kind);
              if(!facts.length)return null;
              return <div key={kind}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#68806e]">{labels[kind]}</p>
                <div className="flex flex-wrap gap-1.5">
                  {facts.map(f=><span key={f.id}
                    title={f.sourceTitle}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#d1e4d6] bg-[#f5faf6] px-2.5 py-1.5 text-[11px] font-semibold text-[#21543a]">
                    {f.value}
                    {f.reviewStatus==="attribute_confirmed_by_producer"?
                      <span className="text-[10px] text-[#1d8a54]" title="Confermato per questo attributo">✓</span>:null}
                  </span>)}
                </div>
              </div>;
            })}
            {dimensional.length?
              <div className="overflow-hidden rounded-xl border border-[#dbe7df]">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#eaf5ee] px-3 py-2">
                  <h4 className="text-[11px] font-extrabold text-[#1b593e]">Gamme dimensionali strutturate</h4>
                  <span className="text-[10px] font-semibold text-[#537761]">mm · intervalli, non singoli SKU</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[430px] border-collapse text-left text-[11px]">
                    <thead className="bg-[#fafcfb] text-[#617669]">
                      <tr>
                        <th className="px-3 py-2 font-bold">Forma</th>
                        <th className="px-3 py-2 font-bold">Dimensione minima → massima</th>
                        <th className="px-3 py-2 font-bold">Spessore min–max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaf0eb]">
                      {dimensional.map(f=><tr key={f.id}>
                        <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-[#315940]">{shape(f)}</td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-[#204a34]">
                          {dimensionDisplay(f)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[#315940]">
                          {range(f.thicknessMin,f.thicknessMax)}
                        </td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
                <p className="px-3 py-2 text-[10px] leading-4 text-[#728375]">
                  Estremi di gamma, non tutte le misure intermedie né disponibilità per un grado specifico.
                </p>
              </div>:null}
            <details className="group border-t border-[#edf1ed] pt-2 text-[11px]">
              <summary className="min-h-9 cursor-pointer py-2 font-bold text-[#2d7250]">
                Fonti e stato degli attributi ({group.facts.length})
              </summary>
              <ul className="mt-2 space-y-1.5">
                {group.facts.map(f=><li key={f.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[#415c48]">{f.value}</span>
                  <span className="text-[#879788]">·</span>
                  <span className="text-[#687b6d]">{f.reviewStatus==="attribute_confirmed_by_producer"?"Attributo confermato":"In attesa del produttore"}</span>
                  <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-[#256e4b] underline underline-offset-2">Fonte ↗</a>
                </li>)}
              </ul>
            </details>
            <Link href="/network/pro/producers"
              className="inline-flex min-h-9 items-center rounded-lg border border-[#c9ded1] px-3 text-[11px] font-bold text-[#1e6847]">
              Vai a Intelligence PRO
            </Link>
          </div>
        </article>;
      })}
    </div>}
  </section>;
}
