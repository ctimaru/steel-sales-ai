"use client";

import {useEffect,useRef,useState,useTransition} from "react";
import type {FormEvent} from "react";
import Link from "next/link";
import {NetworkRfqBridge} from "@/components/network-rfq-bridge";
import {askNetworkConversation,type NetworkConversationAnswer}
  from "@/app/(workspace)/network/conversation-actions";
import type {NetworkIntentFilters} from "@/lib/network-intent-parser";

type Turn={id:number;speaker:"user"|"assistant";text:string;sourceText?:string;result?:NetworkConversationAnswer};
type VoiceResult={results:ArrayLike<ArrayLike<{transcript:string}>>};
type VoiceRecognition={
  lang:string;continuous:boolean;interimResults:boolean;
  onresult:((event:VoiceResult)=>void)|null;
  onend:(()=>void)|null;onerror:(()=>void)|null;
  start:()=>void;stop:()=>void;
};
type VoiceWindow=Window&{
  SpeechRecognition?:new()=>VoiceRecognition;
  webkitSpeechRecognition?:new()=>VoiceRecognition;
};
const EXAMPLES=[
  "Quanti commercianti ci sono in Lombardia?",
  "Cerco produttori di tubi in Veneto",
  "E invece in Piemonte?",
  "40 tubi EN 10219 S235 da 3 metri",
] as const;

/** Local, ephemeral conversation: no microphone before click, no audio or
 * messages stored in localStorage, database or analytics. Backend alone may
 * route an eligible request to the capped, audited AI provider.
 */
export function NetworkConversation({userId,organizationId,canCompose}:{userId:string;organizationId:string;canCompose:boolean}){
  const [draft,setDraft]=useState("");
  const [turns,setTurns]=useState<Turn[]>([]);
  const [busy,startTransition]=useTransition();
  const [voiceSupported,setVoiceSupported]=useState(false);
  const [recording,setRecording]=useState(false);
  const [voiceIssue,setVoiceIssue]=useState("");
  const [speaking,setSpeaking]=useState(false);
  const recognition=useRef<VoiceRecognition|null>(null);
  const latestFilters=useRef<NetworkIntentFilters|undefined>(undefined);
  const id=useRef(0);
  const latestAssistant=[...turns].reverse().find(turn=>turn.speaker==="assistant");
  const rfqSource=latestAssistant?.result?.status==="rfq"?latestAssistant.sourceText:null;
  useEffect(()=>{
    const w=window as VoiceWindow;
    setVoiceSupported(Boolean(window.isSecureContext&&(w.SpeechRecognition||w.webkitSpeechRecognition)));
    return ()=>{
      recognition.current?.stop();
      if("speechSynthesis" in window)window.speechSynthesis.cancel();
    };
  },[]);
  const send=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const query=draft.trim();
    if(busy||query.length<3||query.length>400)return;
    const turnId=++id.current;
    setTurns(prev=>[...prev,{id:turnId,speaker:"user" as const,text:query}].slice(-12));
    setDraft("");
    startTransition(async()=>{
      try{
        const response=await askNetworkConversation(query,latestFilters.current);
        if(response.status==="ready"&&response.filters)latestFilters.current=response.filters;
        setTurns(prev=>[...prev,{
          id:++id.current,speaker:"assistant" as const,text:response.answer,sourceText:query,result:response,
        }].slice(-12));
      }catch{
        setTurns(prev=>[...prev,{id:++id.current,speaker:"assistant" as const,
          text:"Sessione o servizio non disponibile. Accedi di nuovo e riprova."}].slice(-12));
      }
    });
  };
  const toggleMic=()=>{
    if(recording){
      recognition.current?.stop();
      setRecording(false);
      return;
    }
    const w=window as VoiceWindow;
    const Speech=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!window.isSecureContext||!Speech){
      setVoiceIssue("Il riconoscimento vocale non è supportato dal browser.");
      return;
    }
    setVoiceIssue("");
    try{
      const engine=new Speech();
      recognition.current=engine;
      engine.lang=navigator.language||"it-IT";
      engine.continuous=false;engine.interimResults=false;
      engine.onresult=event=>{
        const result=event.results[0]?.[0]?.transcript||"";
        if(result)setDraft(result.slice(0,400));
        setRecording(false);
      };
      engine.onerror=()=>{
        setVoiceIssue("Registrazione non riuscita o permesso microfono negato.");
        setRecording(false);
      };
      engine.onend=()=>setRecording(false);
      engine.start();
      setRecording(true);
    }catch{
      setVoiceIssue("Impossibile attivare il microfono. Verifica i permessi.");
      setRecording(false);
    }
  };
  const readAnswer=(text:string)=>{
    if(!("speechSynthesis" in window)||!("SpeechSynthesisUtterance" in window)){
      setVoiceIssue("La lettura vocale non è disponibile su questo dispositivo.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text.slice(0,650));
    utterance.lang="it-IT";
    utterance.rate=1;
    utterance.onend=()=>setSpeaking(false);
    utterance.onerror=()=>setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };
  const reset=()=>{
    recognition.current?.stop();
    if("speechSynthesis" in window)window.speechSynthesis.cancel();
    setRecording(false);setSpeaking(false);
    setTurns([]);setDraft("");setVoiceIssue("");
    latestFilters.current=undefined;
  };
  return <details className="group mt-2 rounded-xl border border-[#b7d1c4] bg-white"
    data-testid="network-conversational-discovery">
    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
      <span className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true">✦</span> Chiedi al Network
        <span className="rounded-full bg-[#e4f0e9] px-2 py-0.5 text-[10px] text-[#175640]">AI · voce opzionale</span>
      </span>
      <span aria-hidden="true" className="text-base transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <div className="border-t border-[#e6efea] px-3 pb-3 pt-3">
      <p className="text-xs leading-5 text-[#52615b]">
        Chiedi in modo naturale. La chat prepara filtri e ti rimanda ai risultati reali del Network.
        Non inventa aziende, numeri o capacità. Nessuna RFQ viene inviata senza la tua azione.
      </p>
      <div className="mt-2 max-h-[260px] space-y-2 overflow-y-auto rounded-lg bg-[#f7faf8] p-2"
        role="log" aria-label="Conversazione Network" aria-live="polite">
        {turns.length?turns.map(turn=><div key={turn.id}
          className={"max-w-[95%] rounded-xl px-3 py-2 text-xs leading-5 "+
            (turn.speaker==="user"?"ml-auto bg-[#dceee5] text-[#173f35]":"bg-white text-[#34483e]")}>
          <p className="font-semibold">{turn.speaker==="user"?"Tu":"Assistente Network"}</p>
          <p className="mt-1 whitespace-pre-wrap">{turn.text}</p>
          {turn.result?.chips?.length?<div className="mt-1.5 flex flex-wrap gap-1">
            {turn.result.chips.map(chip=><span key={chip}
              className="rounded-full border border-[#bad0c2] bg-[#eaf4ee] px-2 py-0.5 text-[10px]">
              {chip}</span>)}</div>:null}
          {turn.result?.href&&turn.result.status!=="rfq"?<Link href={turn.result.href}
            className="ui-action ui-action-primary mt-2 inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold">
            Mostra risultati verificabili →
          </Link>:null}
          {turn.speaker==="assistant"?<button type="button"
            onClick={()=>readAnswer(turn.text)}
            className="ui-action ui-action-secondary mt-2 inline-flex min-h-8 items-center rounded-lg px-2 text-[11px] font-semibold">
            <span aria-hidden="true">◖))</span> Ascolta risposta
          </button>:null}
        </div>):<p className="text-xs text-[#52615b]">
          Esempio: “Quanti commercianti ci sono in Lombardia?” o “40 tubi EN 10219 S235 da 3 metri”.
        </p>}
        {busy?<p role="status" className="text-[11px] text-[#52615b]">Sto verificando la richiesta…</p>:null}
      </div>
      {rfqSource?<NetworkRfqBridge key={latestAssistant?.id} sourceText={rfqSource}
        userId={userId} organizationId={organizationId} canCompose={canCompose}/>:null}
      <div className="mt-2 flex flex-wrap gap-1" aria-label="Esempi di richieste">
        {EXAMPLES.map(example=><button key={example} type="button" onClick={()=>setDraft(example)}
          className="ui-action ui-action-secondary inline-flex min-h-8 items-center rounded-full px-2 text-[11px]">
          {example}</button>)}
      </div>
      <form onSubmit={send} className="mt-3 flex flex-wrap items-stretch gap-2" aria-label="Chat Network">
        <label htmlFor="network-chat-input" className="sr-only">Chiedi al Network</label>
        <input id="network-chat-input" type="text" maxLength={400} value={draft}
          onChange={event=>setDraft(event.target.value)} autoComplete="off"
          placeholder="Chiedi un'azienda, una regione, un prodotto…"
          className="h-11 min-w-[170px] flex-1 rounded-lg border border-[#b7cfc2] bg-white px-3 text-sm text-[#173f35] outline-none placeholder:text-[#647269] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"/>
        <button type="button" onClick={toggleMic} disabled={!voiceSupported}
          aria-label={recording?"Ferma microfono":"Avvia dettatura vocale"}
          title={voiceSupported?"Dettatura (solo su richiesta)":"Voce non supportata dal browser"}
          className="ui-action ui-action-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          <span aria-hidden="true">{recording?"■":"🎙"}</span>
        </button>
        <button type="submit" disabled={busy||draft.trim().length<3}
          className="ui-action ui-action-primary min-h-11 shrink-0 rounded-lg px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">
          Invia
        </button>
      </form>
      {voiceIssue?<p role="alert" className="mt-1 text-[11px] text-[#875117]">{voiceIssue}</p>:null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[680px] text-[11px] leading-4 text-[#52615b]">
          Il microfono si attiva solo con il tuo clic; il riconoscimento può inviare audio
          al fornitore del browser. Per interpretare frasi non riconosciute localmente, il testo può essere inviato a Vercel AI Gateway. Non viene trasmessa la memoria commerciale privata. La chat non conserva la trascrizione dopo la chiusura della pagina.
        </p>
        <div className="flex gap-2">
          {speaking?<button type="button" onClick={()=>{
            window.speechSynthesis.cancel();setSpeaking(false);
          }} className="ui-action ui-action-secondary min-h-8 rounded-lg px-2 text-[11px]">
            Ferma audio
          </button>:null}
          <button type="button" onClick={reset}
            className="ui-action ui-action-secondary min-h-8 rounded-lg px-2 text-[11px]">
            Nuova conversazione
          </button>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-[#52615b]">
        IT · EN · DE · FR · ES · Fallback deterministico quando AI non disponibile.
      </p>
    </div>
  </details>;
}
