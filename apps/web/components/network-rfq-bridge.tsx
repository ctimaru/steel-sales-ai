"use client";

import {useRouter} from "next/navigation";
import {useState} from "react";
import {analyzeRfqAiFreeText} from "@/app/(workspace)/rfq-hub/distinta/ai-actions";
import {RfqAiTextReview} from "@/components/rfq-ai-text-review";
import type {RfqAiTextDraftResult} from "@/lib/rfq-ai-free-text";
import type {BuyerDistintaDraftLine} from "@/lib/buyer-distinta";
import {
  networkReviewedHandoffKey,parseNetworkReviewedHandoff,serializeNetworkReviewedHandoff,
} from "@/lib/network-reviewed-rfq-handoff";

/** One consistent technical intake. Reuses RFQAI3 extraction and its mandatory
 * per-line human review; only user-approved, complete rows can leave Network.
 * The source text remains in local chat state and is never placed in a URL.
 */
export function NetworkRfqBridge({
  sourceText,userId,organizationId,canCompose,
}:{sourceText:string;userId:string;organizationId:string;canCompose:boolean}){
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [result,setResult]=useState<RfqAiTextDraftResult|null>(null);
  const [error,setError]=useState("");
  const [handoffReady,setHandoffReady]=useState(false);

  const analyze=async()=>{
    if(pending||!canCompose)return;
    setPending(true);setError("");setResult(null);
    try{
      const response=await analyzeRfqAiFreeText(sourceText);
      if(response.ok)setResult(response.result);
      else setError(response.error);
    }catch{
      setError("Estrazione non disponibile. La compilazione manuale in Commerciale resta accessibile.");
    }finally{setPending(false);}
  };
  const confirm=(lines:BuyerDistintaDraftLine[]):boolean=>{
    try{
      const payload=serializeNetworkReviewedHandoff(lines);
      if(!payload)throw Error("lines_not_valid");
      const key=networkReviewedHandoffKey(userId,organizationId);
      const existing=parseNetworkReviewedHandoff(window.sessionStorage.getItem(key));
      if(existing){
        setError("Esiste già una distinta dal Network in attesa di importazione. Apri Commerciale per completarla o scartarla prima di preparare un'altra richiesta.");
        return false;
      }
      window.sessionStorage.setItem(key,payload);
      setResult(null);setError("");setHandoffReady(true);
      return true;
    }catch{
      setError("Non è stato possibile trasferire gli articoli nella scheda. Verifica lo spazio di archiviazione del browser.");
      return false;
    }
  };

  return <section className="mt-2 min-w-0 space-y-2 rounded-xl border border-[#b7d1c4] bg-[#f5faf7] p-3"
    aria-label="Dalla richiesta AI alla distinta commerciale" data-testid="network-rfq-reviewed-bridge">
    <p className="text-xs font-semibold text-[#173f35]">Da questa richiesta alla distinta</p>
    <p className="text-[11px] leading-5 text-[#52615b]">
      Il testo viene analizzato dallo stesso servizio AI del Commerciale. Rivedi forma,
      dimensioni, norma, grado e quantità prima di scegliere le righe. Non si crea né si invia alcuna RFQ.
    </p>
    {!canCompose?<p role="status" className="text-xs text-[#875117]">
      Il tuo ruolo può esplorare il Network, ma non modificare le RFQ aziendali. Chiedi a un collega con permessi commerciali.
    </p>:null}
    {canCompose&&!handoffReady?<button type="button" onClick={analyze}
      disabled={pending||Boolean(result)||sourceText.trim().length<12}
      className="ui-action ui-action-primary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60">
      {pending?"Analisi tecnica in corso…":"Prepara articoli da rivedere"}
    </button>:null}
    {error?<p role="alert" className="text-xs text-[#875117]">{error}</p>:null}
    {result?<RfqAiTextReview result={result} onDismiss={()=>setResult(null)}
      onInsert={confirm}/>:null}
    {handoffReady?<div role="status" className="space-y-2">
      <p className="text-xs font-semibold text-[#175640]">
        Articoli confermati. Ora puoi aggiungerli alla distinta esistente nel Commerciale.
      </p>
      <button type="button" onClick={()=>
        router.push("/commercial?compose=1&source=network#commercial-compose")}
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
