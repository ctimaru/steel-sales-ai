"use client";

import { useState } from "react";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { recordRightsDecision } from "./actions";

type Props = {
  evidence: {kind: string; id: string; decision_id: string | null; state: string};
  scope: string;
  companyId: string;
  hasHold: boolean;
  returnPath: string;
};

export function RightsDecisionForm({evidence,scope,companyId,hasHold,returnPath}: Props) {
  const [decision,setDecision] = useState("needs_review");
  const grant = decision==="allowed" || decision==="limited";
  const disabledGrant = grant&&hasHold;
  return (
    <section className="rounded-2xl border border-[#dce6df] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#234b39]">Nuova decisione</h3>
        <span className="rounded-lg bg-[#f3f7f4] px-2 py-1 text-[10px] font-semibold text-[#4a6a58]">Append-only · {scope.replaceAll("_"," ")}</span>
      </div>
      <p className="mt-1 text-[11px] text-[#71867a]">La decisione registra soltanto una valutazione di fonte. Non attiva automaticamente AI, pubblicazione o accesso a pagamento.</p>
      <form action={recordRightsDecision} className="mt-3 space-y-3">
        <input type="hidden" name="evidence_kind" value={evidence.kind}/>
        <input type="hidden" name="evidence_id" value={evidence.id}/>
        <input type="hidden" name="use_scope" value={scope}/>
        <input type="hidden" name="company_id" value={companyId}/>
        <input type="hidden" name="expected_decision_id" value={evidence.decision_id??""}/>
        <input type="hidden" name="return_path" value={returnPath}/>
        <label className="block text-[11px] font-semibold text-[#516d5e]">Esito della revisione
          <select name="decision" value={decision} onChange={e=>setDecision(e.target.value)}
            className="mt-1 h-9 w-full rounded-lg border border-[#d1ded5] bg-white px-3 text-xs text-[#254a37]">
            <option value="needs_review">Da approfondire</option>
            <option value="blocked">Blocca fonte / utilizzo</option>
            <option value="revoked">Revoca permesso precedente</option>
            <option value="limited">Uso limitato — richiede prova</option>
            <option value="allowed">Uso consentito — richiede prova</option>
          </select>
        </label>
        {grant&&(
          <div className="grid gap-3 rounded-xl border border-[#e2e9e1] bg-[#f8faf7] p-3 sm:grid-cols-2">
            {hasHold&&<p className="sm:col-span-2 text-xs font-semibold text-rose-800">Questa azienda ha hold aperti. Non è possibile concedere nuovi diritti.</p>}
            <label className="block text-[11px] font-semibold text-[#516d5e]">Fondamento dei diritti
              <select name="rights_basis" required defaultValue="" className="mt-1 h-9 w-full rounded-lg border border-[#d1ded5] bg-white px-2 text-xs">
                <option value="" disabled>Seleziona</option>
                <option value="explicit_permission">Permesso esplicito</option>
                <option value="open_license">Licenza aperta verificata</option>
                <option value="first_party_submission">Conferimento diretto</option>
                <option value="counsel_approved">Revisione legale approvata</option>
              </select>
            </label>
            <label className="block text-[11px] font-semibold text-[#516d5e]">Validità fino al
              <input name="valid_until" type="date" required className="mt-1 h-9 w-full rounded-lg border border-[#d1ded5] bg-white px-2 text-xs"/>
            </label>
            <label className="block text-[11px] font-semibold text-[#516d5e] sm:col-span-2">URL HTTPS della prova
              <input name="evidence_url" type="url" required placeholder="https://…"
                className="mt-1 h-9 w-full rounded-lg border border-[#d1ded5] bg-white px-3 text-xs"/>
            </label>
            <label className="block text-[11px] font-semibold text-[#516d5e]">Versione termini / licenza
              <input name="terms_version" required placeholder="Data, versione o identificativo"
                className="mt-1 h-9 w-full rounded-lg border border-[#d1ded5] bg-white px-3 text-xs"/>
            </label>
            <label className="block text-[11px] font-semibold text-[#516d5e]">Obblighi di attribuzione
              <input name="attribution_requirements" placeholder="Eventuale attribuzione"
                className="mt-1 h-9 w-full rounded-lg border border-[#d1ded5] bg-white px-3 text-xs"/>
            </label>
          </div>
        )}
        <label className="block text-[11px] font-semibold text-[#516d5e]">Motivazione e ambito preciso
          <textarea name="review_note" rows={3} minLength={grant?20:12} maxLength={1500} required
            placeholder="Indica cosa permette o vieta la prova, limitazioni e ragioni della scelta."
            className="mt-1 w-full resize-y rounded-lg border border-[#d1ded5] bg-white px-3 py-2 text-xs leading-5"/>
        </label>
        <ConfirmSubmitButton
          disabled={disabledGrant}
          tone="warning"
          className="min-h-9 rounded-lg bg-[#205b49] px-4 text-xs font-semibold text-white hover:bg-[#174537] disabled:cursor-not-allowed disabled:opacity-40"
          title="Registrare questa decisione?"
          description={grant
            ? "Confermi di aver verificato la prova e la compatibilità dei diritti con l'utilizzo selezionato? L'evento è permanente nel ledger, ma non abilita ancora il prodotto."
            : "L'evento sarà registrato senza sovrascrivere la cronologia e senza cambiare la pubblicazione o i permessi AI."}
          confirmLabel="Conferma e registra"
        >Registra decisione</ConfirmSubmitButton>
      </form>
    </section>
  );
}
