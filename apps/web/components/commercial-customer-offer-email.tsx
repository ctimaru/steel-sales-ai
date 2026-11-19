"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  sendCustomerOfferEmail, type CustomerOfferSendState,
} from "@/app/(italian)/(workspace)/commercial/cycle2c-actions";
import {
  buildCustomerOfferEmail, customerOfferEmailReady, defaultCustomerOfferSubject,
  validCustomerEmailRecipient, type CustomerOfferEmailSnapshot,
} from "@/lib/comm-cycle2c-email";

type Delivery = {
  id: string; revision: number; attempt: number; status: string;
  recipient: string; at: string; resolved: string | null;
};
const initial: CustomerOfferSendState = { status:"idle",message:"" };
const statusLabels: Record<string,string> = {
  accepted:"Accettata dal provider",failed:"Rifiutata",unknown:"Da verificare",reserved:"Invio in corso",
};

export function CommercialCustomerOfferEmail({
  rfqId,offerId,version,status,canWrite,snapshot,history,
}:{
  rfqId:string;offerId:string;version:number;status:string;
  canWrite:boolean;snapshot:CustomerOfferEmailSnapshot;history:Delivery[];
}) {
  const router=useRouter();
  const [state,send,pending]=useActionState(sendCustomerOfferEmail,initial);
  const [recipient,setRecipient]=useState("");
  const [subject,setSubject]=useState(defaultCustomerOfferSubject(snapshot));
  const [message,setMessage]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const preview=useMemo(()=>buildCustomerOfferEmail(snapshot,subject,message),[snapshot,subject,message]);
  const ready=customerOfferEmailReady(snapshot);
  const eligible=canWrite && status==="draft" && ready;
  const recipientValid=validCustomerEmailRecipient(recipient.trim());
  const existingBlock=history.some(d=>d.revision===snapshot.revision &&
    ["accepted","reserved","unknown"].includes(d.status));
  useEffect(()=>{
    if(state.status==="sent")router.refresh();
  },[state.status,router]);
  return (
    <section data-testid="comm-cycle2c-email"
      className="mt-4 rounded-xl border border-[#cfded4] bg-[#f8fbf9] p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#3e795e]">
            COMM-CYCLE2.C · Email al cliente
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#173f35]">Invia l'offerta senza PDF</h3>
          <p className="mt-1 text-xs text-[#526a5b]">
            Il cliente riceve righe, prezzi e condizioni direttamente nel corpo dell'email.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#175640]">
          v{snapshot.revision}
        </span>
      </div>
      {history.length>0 && (
        <div className="mt-3 rounded-lg border border-[#dce8e0] bg-white p-3" aria-label="Storico email offerte">
          <p className="text-xs font-bold text-[#28513b]">Storico invii</p>
          <div className="mt-2 space-y-1.5">
            {history.map((d)=>(
              <p key={d.id} className="text-xs text-[#3d5747]">
                <strong>v{d.revision} · tentativo {d.attempt}</strong>
                {" · "+(statusLabels[d.status]??d.status)}
                {" · "+d.recipient}
                {" · "+new Date(d.resolved??d.at).toLocaleDateString("it-IT")}
              </p>
            ))}
          </div>
        </div>
      )}
      {!canWrite && <p className="mt-3 text-xs text-[#7c5b27]">
        Invio disponibile solo per Ufficio commerciale o Direzione.
      </p>}
      {status!=="draft" && <p className="mt-3 text-xs text-[#3c6551]">
        Questa revisione non è più una bozza: l'invio è nello storico e non viene ripetuto.
      </p>}
      {status==="draft" && !ready && <p className="mt-3 text-xs text-[#9a3412]">
        Salva prima tutti i prezzi, la validità, la resa e il pagamento.
      </p>}
      {existingBlock && <p role="alert" className="mt-3 text-xs font-semibold text-[#8b4c20]">
        Esiste già un invio di questa revisione. Nessun reinvio automatico: controlla lo storico.
      </p>}
      {eligible && !existingBlock && (
        <form action={send} aria-busy={pending} className="mt-3 space-y-3">
          <input type="hidden" name="rfq_id" value={rfqId}/>
          <input type="hidden" name="offer_id" value={offerId}/>
          <input type="hidden" name="version" value={version}/>
          <label className="block text-xs font-semibold text-[#405b49]">
            Indirizzo email cliente (da controllare)
            <input required name="recipient" type="email" autoComplete="off"
              value={recipient} onChange={e=>{setRecipient(e.target.value);setConfirmed(false);}}
              maxLength={254} placeholder="acquisti@cliente.it"
              className="mt-1 min-h-11 w-full rounded-lg border border-[#b9d2c3] bg-white px-3 text-sm text-[#173f35]"/>
          </label>
          <label className="block text-xs font-semibold text-[#405b49]">
            Oggetto
            <input required name="subject" value={subject} onChange={e=>setSubject(e.target.value)}
              maxLength={180} className="mt-1 min-h-11 w-full rounded-lg border border-[#b9d2c3] bg-white px-3 text-sm text-[#173f35]"/>
          </label>
          <label className="block text-xs font-semibold text-[#405b49]">
            Messaggio di apertura (facoltativo)
            <textarea name="message" rows={2} value={message} onChange={e=>setMessage(e.target.value)}
              maxLength={2000} placeholder="In riferimento alla vostra richiesta..."
              className="mt-1 w-full rounded-lg border border-[#b9d2c3] bg-white px-3 py-2 text-sm text-[#173f35]"/>
          </label>
          <button type="button" onClick={()=>setPreviewOpen(v=>!v)}
            className="min-h-11 rounded-lg border border-[#a5c3ae] bg-white px-4 text-sm font-semibold text-[#175640]">
            {previewOpen?"Nascondi anteprima":"Anteprima email"}
          </button>
          {previewOpen && (
            <div className="space-y-3">
              <div className="text-xs text-[#4a6353]">
                <p><strong>A:</strong> {recipient || "Inserisci l'email del cliente"}</p>
                <p><strong>Oggetto:</strong> {preview.subject}</p>
                <p className="mt-1">Anteprima della bozza salvata: le modifiche non salvate nell'editor non sono incluse.</p>
              </div>
              <iframe title="Anteprima email offerta" sandbox="" srcDoc={preview.html}
                className="h-[430px] w-full rounded-lg border border-[#c8dace] bg-white"/>
              <label className="flex items-start gap-2 rounded-lg bg-white p-3 text-xs text-[#294635]">
                <input name="verified_recipient" type="checkbox" value="yes" checked={confirmed}
                  onChange={e=>setConfirmed(e.target.checked)} required
                  className="mt-0.5 h-4 w-4 accent-[#175640]"/>
                <span>Ho controllato il destinatario e l'offerta. Confermo l'invio di questa revisione al cliente.</span>
              </label>
              <button type="submit" disabled={pending || !recipientValid || !confirmed || !subject.trim()}
                className="min-h-11 w-full rounded-lg bg-[#175640] px-5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
                {pending?"Invio in corso…":"Conferma e invia email"}
              </button>
            </div>
          )}
          {state.message && <p role={state.status==="error"||state.status==="unknown"?"alert":"status"}
            className={"text-xs font-semibold "+(state.status==="sent"?"text-[#175640]":"text-[#914729]")}>
            {state.message}
          </p>}
          <p className="text-[11px] text-[#5c7062]">
            Nessun PDF, nessuna email automatica. L'esito incerto non genera un secondo invio.
          </p>
        </form>
      )}
    </section>
  );
}
