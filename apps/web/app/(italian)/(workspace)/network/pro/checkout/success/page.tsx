"use client";

import {useEffect,useState} from "react";
import Link from "next/link";
import {
  confirmNetworkProCheckout,type CheckoutConfirmResult,
} from "@/app/(italian)/(workspace)/network/pro/checkout-confirm";

export default function NetworkProCheckoutSuccess(){
  const [result,setResult]=useState<CheckoutConfirmResult>({status:"pending"});
  const [attempts,setAttempts]=useState(0);
  const [sessionId,setSessionId]=useState<string|null>(null);
  useEffect(()=>{
    const sid=new URLSearchParams(window.location.search).get("session_id");
    setSessionId(sid);
    if(!sid||!/^cs_[A-Za-z0-9_]{8,150}$/.test(sid)){
      setResult({status:"not_found"});
      return;
    }
    let active=true;
    void confirmNetworkProCheckout(sid).then(data=>{
      if(active)setResult(data);
    }).catch(()=>{if(active)setResult({status:"unavailable"});});
    return ()=>{active=false;};
  },[attempts]);

  const refresh=()=>{
    if(!sessionId||attempts>=10)return;
    setResult({status:"pending"});
    setAttempts(count=>count+1);
  };
  // Poll briefly only while the provider's webhook is settling.
  useEffect(()=>{
    if(result.status!=="pending"||!sessionId||attempts>=10)return;
    const timer=setTimeout(refresh,2800);
    return ()=>clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[result.status,sessionId,attempts]);

  return <main className="mx-auto max-w-xl space-y-5 px-4 py-10" data-testid="netpro-f2-success">
    <section className="rounded-2xl border border-[#c8e0d1] bg-white p-6 shadow-sm" role="status" aria-live="polite">
      <h1 className="text-2xl font-bold text-[#173f35]">
        {result.status==="active"?"Network PRO attivato":
         result.status==="not_found"?"Pagamento non verificabile":
         "Verifica pagamento Network PRO"}
      </h1>
      {result.status==="active"?<>
        <p className="mt-3 text-sm text-[#325945]">
          Stripe ha confermato il pagamento e i moduli acquistati sono stati sbloccati automaticamente.
          Non è richiesta alcuna approvazione.
        </p>
        <p className="mt-2 text-xs text-[#476451]">Validità del periodo pagato: {result.paidUntil?
          new Date(result.paidUntil).toLocaleDateString("it-IT"): "vedi il tuo abbonamento"}.</p>
      </>:<p className="mt-3 text-sm text-[#52685a]">
        {result.status==="not_found"
          ?"Questa sessione non appartiene al tuo account oppure non è valida."
          :result.status==="unavailable"
          ?"La verifica è temporaneamente indisponibile. Nessun modulo è stato sbloccato in assenza di pagamento confermato."
          :"Attivazione in corso: stiamo verificando il pagamento sul server. L’accesso sarà aperto solo dopo conferma effettiva."}
      </p>}
      {result.status!=="active"&&result.status!=="not_found"?
        <button type="button" onClick={refresh} disabled={attempts>=10}
          className="mt-5 min-h-11 rounded-xl border border-[#a9c5b3] px-4 text-sm font-semibold text-[#205a3d] disabled:opacity-50">
          {attempts>=10?"Verifica dal catalogo":"Verifica di nuovo"}
        </button>:null}
      <Link href="/network/pro" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#175640] underline">
        Torna al catalogo Network PRO
      </Link>
    </section>
  </main>;
}
