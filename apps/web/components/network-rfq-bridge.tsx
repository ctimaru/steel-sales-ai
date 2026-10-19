"use client";
import {useRouter} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import {analyzeRfqAiFreeText} from "@/app/(workspace)/rfq-hub/distinta/ai-actions";
import {RfqAiTextReview} from "@/components/rfq-ai-text-review";
import type {RfqAiTextDraftResult} from "@/lib/rfq-ai-free-text";
import type {BuyerDistintaDraftLine} from "@/lib/buyer-distinta";
import {networkReviewedHandoffKey,parseNetworkReviewedHandoff,serializeNetworkReviewedHandoff}
  from "@/lib/network-reviewed-rfq-handoff";
import {appendNetworkRfqDictation,networkRfqQuestions,networkRfqTextValid,NETWORK_RFQ_MAX_TEXT}
  from "@/lib/network-rfq-guidance";

type VoiceResult={results:ArrayLike<ArrayLike<{transcript:string}>>};
type Recognition={
  lang:string;continuous:boolean;interimResults:boolean;
  onresult:((event:VoiceResult)=>void)|null;
  onend:(()=>void)|null;onerror:(()=>void)|null;
  start:()=>void;stop:()=>void;
};
type SpeechWindow=Window&{
  SpeechRecognition?:new()=>Recognition;
  webkitSpeechRecognition?:new()=>Recognition;
};
export function NetworkRfqBridge({sourceText,userId,organizationId,canCompose}:{
  sourceText:string;userId:string;organizationId:string;canCompose:boolean;
}){
  const router=useRouter();
  const [rfqText,setRfqText]=useState(sourceText.slice(0,NETWORK_RFQ_MAX_TEXT));
  const [pending,setPending]=useState(false);
  const [result,setResult]=useState<RfqAiTextDraftResult|null>(null);
  const [error,setError]=useState("");
  const [handoffReady,setHandoffReady]=useState(false);
  const [voiceSupported,setVoiceSupported]=useState(false);
  const [recording,setRecording]=useState(false);
  const [voiceIssue,setVoiceIssue]=useState("");
  const [showHelp,setShowHelp]=useState(false);
  const recognition=useRef<Recognition|null>(null);
  const requestVersion=useRef(0);
  const mounted=useRef(true);
  const textRef=useRef(rfqText);
  useEffect(()=>{
    mounted.current=true;
    const w=window as SpeechWindow;
    setVoiceSupported(Boolean(window.isSecureContext&&(w.SpeechRecognition||w.webkitSpeechRecognition)));
    return ()=>{mounted.current=false;requestVersion.current++;recognition.current?.stop();};
  },[]);
  function changeText(text:string){
    requestVersion.current++;
    textRef.current=text.slice(0,NETWORK_RFQ_MAX_TEXT);
    setRfqText(textRef.current);
    setResult(null);setError("");
  }
  async function analyze(){
    if(pending||!canCompose||handoffReady||!networkRfqTextValid(textRef.current))return;
    const version=++requestVersion.current;
    const snapshot=textRef.current.trim();
    setPending(true);setError("");setResult(null);
    try{
      const response=await analyzeRfqAiFreeText(snapshot);
      if(!mounted.current||requestVersion.current!==version)return;
      if(response.ok)setResult(response.result);
      else setError(response.error);
    }catch{
      if(mounted.current&&requestVersion.current===version)
        setError("Estrazione non disponibile. La compilazione manuale in Commerciale resta accessibile.");
    }finally{if(mounted.current)setPending(false);}
  }
  function toggleVoice(){
    if(recording){recognition.current?.stop();setRecording(false);return;}
    const w=window as SpeechWindow;
    const Speech=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!window.isSecureContext||!Speech){
      setVoiceIssue("Il riconoscimento vocale non è disponibile in questo browser.");return;
    }
    setVoiceIssue("");
    try{
      const engine=new Speech();
      recognition.current=engine;engine.lang=navigator.language||"it-IT";
      engine.continuous=false;engine.interimResults=false;
      engine.onresult=event=>{
        if(!mounted.current)return;
        const transcript=event.results[0]?.[0]?.transcript||"";
        const next=appendNetworkRfqDictation(textRef.current,transcript);
        if(next!==null)changeText(next);
        else setVoiceIssue("Dettatura vuota o troppo lunga: ripeti con meno dettagli.");
        setRecording(false);
      };
      engine.onerror=()=>{if(mounted.current){
        setVoiceIssue("Microfono non disponibile o permesso negato.");setRecording(false);
      }};
      engine.onend=()=>{if(mounted.current)setRecording(false);};
      engine.start();setRecording(true);
    }catch{setRecording(false);setVoiceIssue("Controlla i permessi del microfono.");}
  }
  function confirm(lines:BuyerDistintaDraftLine[]):boolean{
    try{
      const payload=serializeNetworkReviewedHandoff(lines);
      if(!payload)throw Error("invalid_lines");
      const key=networkReviewedHandoffKey(userId,organizationId);
      const existing=parseNetworkReviewedHandoff(window.sessionStorage.getItem(key));
      if(existing){
        setError("Esiste già una distinta in attesa: apri Commerciale per completarla o scartarla.");
        return false;
      }
      window.sessionStorage.setItem(key,payload);
      setResult(null);setError("");setHandoffReady(true);
      return true;
    }catch{
      setError("Trasferimento non riuscito: verifica l'archiviazione del browser.");return false;
    }
  }
  const questions=result?networkRfqQuestions(result):[];
  return <section data-testid="network-rfq-reviewed-bridge"
    aria-label="Dialogo tecnico e distinta commerciale"
    className="mt-2 min-w-0 space-y-3 rounded-xl border border-[#b7d1c4] bg-[#f5faf7] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-[#173f35]">Completa la richiesta e crea la distinta</p>
        <p className="mt-1 text-[11px] text-[#52615b]">Più articoli · dettatura aggiuntiva · revisione obbligatoria</p>
      </div>
      <span className="rounded-full bg-[#e4f0e9] px-2 py-1 text-[10px] font-semibold text-[#175640]">
        Nessun invio automatico
      </span>
    </div>
    <p className="text-xs leading-5 text-[#52615b]">
      Completa il testo senza indovinare misure o qualità. Per ogni articolo
      puoi correggere i campi proposti e confermarli prima di trasferire la distinta.
      Non si crea né si invia alcuna RFQ.
    </p>
    {!canCompose?<p role="status" className="text-xs text-[#875117]">
      Il tuo ruolo può esplorare il Network ma non creare RFQ aziendali.
    </p>:null}
    {canCompose&&!handoffReady?<div className="space-y-2">
      <label htmlFor="network-rfq-source" className="block text-xs font-semibold text-[#173f35]">
        Richiesta da analizzare · modificabile
      </label>
      <textarea id="network-rfq-source" value={rfqText} disabled={pending}
        onChange={event=>changeText(event.target.value)}
        maxLength={NETWORK_RFQ_MAX_TEXT} rows={4} spellCheck={false}
        placeholder={"40 tubi quadri 100×100×5 EN 10219 S235JRH, barre da 3 m.\n20 tubi tondi Ø 60,3×3 EN 10210 S355J2H, barre da 6 m."}
        className="min-h-24 w-full min-w-0 rounded-lg border border-[#b7cfc2] bg-white px-3 py-2 text-sm leading-5 text-[#173f35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-70"/>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[#52615b]">
          {rfqText.length}/{NETWORK_RFQ_MAX_TEXT} caratteri · separa gli articoli con un a capo
        </span>
        <button type="button" onClick={toggleVoice} disabled={!voiceSupported||pending}
          aria-label={recording?"Ferma dettatura articoli":"Detta un altro articolo o dettaglio"}
          className="ui-action ui-action-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-50">
          <span aria-hidden="true">{recording?"■":"🎙"}</span> {recording?"Ferma dettatura":"Aggiungi con voce"}
        </button>
      </div>
      {voiceIssue?<p role="alert" className="text-xs text-[#875117]">{voiceIssue}</p>:null}
      <button type="button" onClick={()=>setShowHelp(!showHelp)} aria-expanded={showHelp}
        className="ui-action ui-action-secondary min-h-9 rounded-lg px-3 text-xs font-semibold">
        {showHelp?"Nascondi suggerimenti":"Come descrivere più articoli?"}
      </button>
      {showHelp?<p className="text-xs leading-5 text-[#52615b]">
        Per ogni articolo indica quantità, sezione (tondo, quadro, rettangolare),
        dimensioni in mm, spessore, norma, grado e lunghezza della barra.
        Ogni nuova dettatura è aggiunta su una nuova riga; controllala prima dell'analisi.
      </p>:null}
      <button type="button" onClick={analyze}
        disabled={pending||!networkRfqTextValid(rfqText)}
        className="ui-action ui-action-primary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold disabled:opacity-60">
        {pending?"Analisi tecnica in corso…":"Prepara articoli da rivedere"}
      </button>
      <p className="text-[11px] leading-4 text-[#52615b]">
        Il testo è inviato al servizio AI soltanto quando premi Analizza.
        Il microfono richiede il tuo clic e può utilizzare il servizio vocale del browser.
        Nessun audio viene archiviato da Smart Steel Sales.
      </p>
    </div>:null}
    {error?<p role="alert" className="text-xs text-[#875117]">{error}</p>:null}
    {result?<div className="space-y-2" data-testid="network-rfq-clarification">
      <div className="rounded-lg border border-[#d5e1db] bg-white p-3">
        <p className="text-xs font-semibold text-[#173f35]">
          {result.candidates.length} {result.candidates.length===1?"articolo proposto":"articoli proposti"}
          {questions.length?" · dati da completare":" · verifica i dettagli"}
        </p>
        {questions.length?<div role="status" className="mt-2 space-y-2">
          {questions.map((row,index)=><div key={row.candidateId}
            className="border-t border-[#e3ebe6] pt-2">
            <p className="break-words text-xs font-semibold text-[#34483e]">
              {index+1}. {row.label}
            </p>
            <ul className="ml-4 mt-1 list-disc space-y-0.5 text-[11px] text-[#52615b]">
              {row.questions.map(question=><li key={question}>{question}</li>)}
            </ul>
          </div>)}
        </div>:<p className="mt-2 text-[11px] text-[#52615b]">Verifica e conferma le righe una per una.</p>}
        <p className="mt-2 text-[11px] text-[#52615b]">
          Completa i campi nella revisione qui sotto. Se modifichi il testo sopra,
          l'analisi precedente viene annullata e devi avviarne una nuova.
        </p>
      </div>
      <RfqAiTextReview result={result} onDismiss={()=>setResult(null)} onInsert={confirm}/>
    </div>:null}
    {handoffReady?<div role="status" className="space-y-2">
      <p className="text-xs font-semibold text-[#175640]">
        Articoli confermati. Puoi aggiungerli alla distinta esistente nel Commerciale.
      </p>
      <button type="button"
        onClick={()=>router.push("/commercial?compose=1&source=network#commercial-compose")}
        className="ui-action ui-action-primary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold">
        Apri Commerciale e importa articoli →
      </button>
    </div>:null}
    <p className="text-[10px] leading-4 text-[#52615b]">
      Il passaggio conserva soltanto le righe confermate in questa scheda per massimo 15 minuti,
      isolate per utente e azienda. Nessun testo commerciale viene inserito nell'URL.
    </p>
  </section>;
}
