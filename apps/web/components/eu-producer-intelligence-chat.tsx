"use client";

import Link from "next/link";
import {useState,type FormEvent} from "react";
import {searchEuropeanTubeProducers,type EuProducerChatResult} from "@/app/(italian)/(workspace)/network/pro/producers/ai-actions";
import {networkCountryName} from "@/lib/network-eu-countries";
import {newRequestHref} from "@/lib/new-request-href";

type Turn={id:number;question:string;response:EuProducerChatResult};
const examples=[
  {label:"EN 10219 · S355J2H",question:"Chi produce tubi EN 10219 S355J2H?"},
  {label:"RHS · 200×100×6",question:"Cerco tubi EN 10219 S355 RHS 200×100×6"},
  {label:"Inox · AISI 316",question:"Produttori di tubi inox AISI 316 in Serbia"},
];
const labels:Record<string,string>={
  technical_standard:"Norma",steel_grade:"Grado",section_shape:"Sezione",
};
const HANDOFF="sss:commercial-ai-intake-handoff";
function requestForDistinta(t:Turn){
  if(!t.response.ok||t.response.status!=="ready")return t.question;
  const i=t.response.intent;
  const terms=[i.shape==="CHS"?"tondi":i.shape==="SHS"?"quadri":
    i.shape==="RHS"?"rettangolari":null,i.standard,i.grade].filter(Boolean);
  // No inferred SKU, quote or available stock; quantities remain to be supplied.
  return "Vorrei preparare una richiesta di offerta per tubi "+terms.join(" ")+
    ". Misure, quantità, disponibilità e conformità da definire e verificare.";
}
export function EuProducerIntelligenceChat(){
  const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false);
  const [turns,setTurns]=useState<Turn[]>([]);
  async function runSearch(questionInput:string){
    if(busy||!questionInput.trim())return;
    const question=questionInput.trim().slice(0,400);
    const preceding=[...turns].reverse().find(t=>t.response.ok&&t.response.status==="ready");
    const previousIntent=preceding?.response.ok&&preceding.response.status==="ready"
      ?preceding.response.intent:null;
    // Preserve the last resolved user-requested filters, not model-generated
    // evidence or an old answer's source list.
    const prior=previousIntent?[
      previousIntent.standard,previousIntent.grade,previousIntent.shape,
      previousIntent.country?"in "+previousIntent.country:null,
    ].filter(Boolean).join(" "):undefined;
    setBusy(true);
    try{
      const response=await searchEuropeanTubeProducers(question,prior);
      setTurns(current=>[...current.slice(-4),{
        id:(current.at(-1)?.id??0)+1,question,response,
      }]);
      setDraft("");
    }catch{
      setTurns(current=>[...current.slice(-4),{
        id:(current.at(-1)?.id??0)+1,question,
        response:{ok:false,status:"unavailable",message:"Impossibile completare la ricerca. Nessuna informazione inventata."},
      }]);
    }finally{setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    void runSearch(draft);
  }
  function renderTurn(turn:Turn){
          const r=turn.response;
          const full=r.ok&&r.status==="ready"?r.companies.filter(c=>c.status==="attributes_observed_separately").length:0;
          return <div key={turn.id} className="space-y-2">
            <p className="ml-auto w-fit max-w-[95%] rounded-2xl rounded-tr-sm bg-[#175640] px-3 py-2 text-xs font-medium leading-5 text-white">{turn.question}</p>
            <div className="rounded-2xl rounded-tl-sm border border-[#dce8df] bg-[#fafcfb] p-3 sm:p-4" data-testid="eu-producer-chat-answer">
              {!r.ok?
                <div className="space-y-2">
                  <p role="status" className="text-xs text-[#5a634f]">{r.message}</p>
                  {r.status==="locked"?<Link href="/network/pro" className="text-xs font-bold text-[#175640] underline">Scopri Produttori PRO Europa</Link>:null}
                </div>
              :r.status==="clarify"?
                <p className="text-xs leading-5 text-[#3c6050]">{r.message}</p>
              :<>
                <p className="text-sm font-bold text-[#163e2e]">
                  {r.companies.length===0?"Non ho trovato evidenze corrispondenti nel campione tecnico indicizzato.":
                    r.companies.length+" produttor"+(r.companies.length===1?"e":"i")+" con attributi documentati · "+full+" con tutti i criteri osservati separatamente"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#607268]">
                  {r.companies.length===0?
                    "Non significa che nessuna azienda produca il materiale: la copertura dei cataloghi è ancora parziale.":
                    "Le corrispondenze si riferiscono a singoli attributi sulle fonti ufficiali, non a una combinazione esatta né a disponibilità."}
                </p>
                {r.intent.requestedSize?<p className="mt-2 text-xs font-semibold text-[#825e2a]">
                  Dimensioni e spessori richiesti: nessuna capacità specifica è stata confermata dalla ricerca per attributi.
                </p>:null}
                {r.intent.unverifiedConditions.length>0?<p className="mt-2 text-xs text-[#825e2a]">
                  Requisiti non verificati: {r.intent.unverifiedConditions.join(", ")}.
                </p>:null}
                {r.companies.length>0?<ol className="mt-3 space-y-2">
                  {r.companies.map(company=><li key={company.companyId}
                    className="rounded-xl border border-[#d8e6db] bg-white p-3" data-testid="eu-producer-source-match">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link href={"/network/"+company.companyId} className="text-sm font-bold text-[#174c36] underline-offset-2 hover:underline">
                          {company.name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-[#607667]">{networkCountryName(company.countryCode)||company.countryCode}
                          {" · "+company.matchedCriteria+"/"+company.requestedCriteria+" criteri osservati"}</p>
                      </div>
                      <span className="rounded-lg border border-[#cfdfd4] bg-[#f3f8f4] px-2 py-1 text-[10px] font-bold text-[#335e44]">
                        {company.status==="attributes_observed_separately"?"Attributi osservati":"Corrispondenza parziale"}
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Fonti tecniche">
                      {company.evidence.map(e=><li key={e.id}><a
                        href={e.sourceUrl} target="_blank" rel="noopener noreferrer"
                        title={e.sourceTitle+" · osservato "+new Date(e.observedAt).toLocaleDateString("it-IT")}
                        className="inline-flex min-h-8 items-center rounded-lg border border-[#d6e8dc] bg-[#f6faf7] px-2.5 py-1 text-[11px] font-semibold text-[#22563e] underline-offset-2 hover:underline">
                        {labels[e.kind]||e.kind}: {e.value} ↗
                      </a></li>)}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <Link href={newRequestHref({network:company.companyId,fromNetwork:true})}
                        style={{color:"#ffffff",WebkitTextFillColor:"#ffffff"}}
                        onClick={()=>{
                          try{window.sessionStorage.setItem(HANDOFF,requestForDistinta(turn));}
                          catch{/* Receiving editor remains available without automatic import. */}
                        }}
                        className="inline-flex min-h-9 items-center rounded-lg bg-[#175640] px-3 text-[11px] font-bold text-white hover:bg-[#104b35]">
                        Prepara Distinta / RFQ
                      </Link>
                      <span className="self-center text-[10px] text-[#607466]">Nessun invio automatico · revisione obbligatoria</span>
                    </div>
                  </li>)}
                </ol>:null}
              </>}
            </div>
          </div>;
  }
  return <section className="overflow-hidden rounded-[22px] border border-[#bdd9c9] bg-white shadow-[0_7px_26px_rgba(19,64,44,0.06)]"
    data-testid="eu-producer-intelligence-chat" aria-labelledby="eu-producer-chat-title">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4eee7] bg-[#f8fbf9] px-4 py-3 sm:px-5">
      <h2 id="eu-producer-chat-title" className="text-[15px] font-extrabold text-[#133f2c]">
        Ricerca tecnica AI
      </h2>
      <span className="text-[11px] font-semibold text-[#47735a]">Europa</span>
    </div>
    <div className="space-y-3 px-4 py-4 sm:px-5">
      <p className="max-w-3xl text-xs leading-5 text-[#5c7364]">
        Norma, acciaio, forma o misura: chiedi e confronta produttori con fonti.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row" aria-label="Ricerca tecnica conversazionale">
        <label htmlFor="eu-producer-technical-question" className="sr-only">Domanda tecnica sui produttori europei</label>
        <input id="eu-producer-technical-question" value={draft} onChange={e=>setDraft(e.target.value)}
          type="search" maxLength={400} autoComplete="off"
          placeholder="Es. Chi produce EN 10219 S355J2H?"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#b9d1c0] bg-white px-4 text-sm text-[#183d2d] placeholder:text-[#798b80] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"/>
        <button type="submit" disabled={busy||draft.trim().length<4}
          className="min-h-12 rounded-xl bg-[#175640] px-6 text-sm font-bold text-white hover:bg-[#104b35] disabled:cursor-not-allowed disabled:opacity-50">
          {busy?"Cerco sulle fonti…":"Cerca produttori"}
        </button>
      </form>
      {turns.length===0?<div className="flex flex-wrap gap-1.5" aria-label="Domande di esempio">
        {examples.map(example=><button type="button" key={example.question}
          disabled={busy} onClick={()=>{void runSearch(example.question);}}
          title={example.question}
          className="min-h-9 rounded-lg border border-[#c7dccc] bg-[#f7fbf8] px-2.5 py-1 text-left text-[11px] font-semibold text-[#27563f] hover:bg-[#eaf6ed] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#185740]">
          {example.label}
        </button>)}
      </div>:null}
      <div className="space-y-4" aria-live="polite" data-testid="eu-producer-chat-transcript">
        {turns.length>1?<details className="group rounded-xl border border-[#dce8df] bg-[#f9fcfa]"
          data-testid="eu-producer-chat-history">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-[#285d43] focus-visible:outline-2 focus-visible:outline-[#175640] [&::-webkit-details-marker]:hidden">
            Ricerche precedenti · {turns.length-1}
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </summary>
          <div className="space-y-3 border-t border-[#e2ece4] px-3 py-3">
            {turns.slice(0,-1).map(renderTurn)}
          </div>
        </details>:null}
        {turns.length>0?renderTurn(turns[turns.length-1]!):null}
      </div>

    </div>
  </section>;
}
