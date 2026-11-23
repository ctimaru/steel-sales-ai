"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {searchEuropeanTubeProducers,type EuProducerChatResult} from "@/app/(italian)/(workspace)/network/pro/producers/ai-actions";
import {networkCountryName} from "@/lib/network-eu-countries";
import {newRequestHref} from "@/lib/new-request-href";

type Turn={id:number;question:string;response:EuProducerChatResult};
export const PRODUCER_QUESTION_EXAMPLES=[
  "Chi produce tubi EN 10219 S355J2H?",
  "Cerco tubi EN 10219 S355 RHS 200×100×6",
  "Produttori di tubi inox AISI 316 in Serbia",
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
/**
 * NET-PRODUCERS-UX3 (23 Nov 2026): no input of its own any more. The page has
 * ONE search box; a technical question typed there arrives here as `ask`, and
 * the answers (with sources) appear under the box. A question recognised by
 * mistake can be re-run as a company-name search with one click.
 */
export function EuProducerIntelligenceChat({ask,onSearchAsName,onClose,onApplyFilters}:{
  ask:{id:number;text:string}|null;
  onSearchAsName:(text:string)=>void;
  onClose:()=>void;
  /** NET-PRODUCERS-FILTERS1: turn the standard/grade the user asked for into list filters (Italy). */
  onApplyFilters?:(found:{standard:string|null;grade:string|null})=>void;
}){
  const [busy,setBusy]=useState(false);
  const [turns,setTurns]=useState<Turn[]>([]);
  const turnsRef=useRef<Turn[]>([]);
  turnsRef.current=turns;
  const handled=useRef<number|null>(null);
  useEffect(()=>{
    if(!ask||handled.current===ask.id)return;
    handled.current=ask.id;
    void run(ask.text);
    // run reads the latest turns through turnsRef; only a new ask triggers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[ask]);
  async function run(text:string){
    const question=text.trim().slice(0,400);
    if(question.length<4)return;
    const preceding=[...turnsRef.current].reverse().find(t=>t.response.ok&&t.response.status==="ready");
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
    }catch{
      setTurns(current=>[...current.slice(-4),{
        id:(current.at(-1)?.id??0)+1,question,
        response:{ok:false,status:"unavailable",message:"Impossibile completare la ricerca. Nessuna informazione inventata."},
      }]);
    }finally{setBusy(false);}
  }
  function close(){
    setTurns([]);
    onClose();
  }
  if(turns.length===0&&!busy)return null;
  const last=turns.at(-1);
  return <section className="overflow-hidden rounded-2xl border border-[#c4dccd] bg-white"
    data-testid="eu-producer-intelligence-chat" aria-labelledby="eu-producer-chat-title">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1ece4] px-4 py-2.5">
      <h2 id="eu-producer-chat-title" className="flex items-center gap-2 text-sm font-extrabold text-[#133f2c]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-[#1d6948]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>
        Risposta AI con fonti
      </h2>
      <div className="flex items-center gap-3">
        {last&&!busy?<button type="button" onClick={()=>onSearchAsName(last.question)}
          className="min-h-9 text-[11px] font-bold text-[#1d6948] underline underline-offset-2 hover:text-[#10452f]">
          Cerca invece come nome azienda
        </button>:null}
        <button type="button" onClick={close} aria-label="Chiudi la risposta AI"
          className="inline-flex min-h-9 items-center rounded-lg border border-[#d3e2d8] px-3 text-[11px] font-bold text-[#355c47] hover:bg-[#f3f8f4]">
          Chiudi
        </button>
      </div>
    </div>
    <div className="space-y-3 px-4 py-4">
      <div className="space-y-4" aria-live="polite" data-testid="eu-producer-chat-transcript">
        {turns.map(turn=>{
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
                {onApplyFilters&&(r.intent.standard||r.intent.grade)?<button type="button"
                  onClick={()=>onApplyFilters({standard:r.intent.standard,grade:r.intent.grade})}
                  data-testid="eu-producer-chat-apply-filters"
                  className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#bcd5c5] bg-white px-3 text-[11px] font-bold text-[#175640] hover:bg-[#eef6f0]">
                  Filtra l&apos;elenco italiano: {[r.intent.standard,r.intent.grade].filter(Boolean).join(" · ")}
                </button>:null}
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
        })}
      </div>
      {busy?<p role="status" className="text-xs font-semibold text-[#3c6050]">Cerco sulle fonti…</p>:null}
      <p className="text-[11px] leading-4 text-[#6a7d70]">
        La ricerca AI interpreta i requisiti, ma soltanto le fonti delle aziende possono motivare una risposta.
        I dati osservati non certificano combinazioni norma × grado × misura × spessore né stock.
      </p>
    </div>
  </section>;
}
