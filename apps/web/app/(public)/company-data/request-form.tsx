"use client";

import { useActionState } from "react";

import {
  initialCompanyDataRequestState,
  submitCompanyDataRequest,
} from "./actions";

export function CompanyDataRequestForm() {
  const [state, action, pending] = useActionState(
    submitCompanyDataRequest,
    initialCompanyDataRequestState,
  );

  return (
    <form action={action} className="space-y-4 rounded-3xl border border-[#dce2df] bg-white p-5 shadow-sm sm:p-6">
      <div className="sr-only" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#34423d]">
          Tipo di richiesta
          <select name="request_type" required defaultValue="correction" className="mt-2 h-11 w-full rounded-xl border border-[#d0dad6] bg-white px-3">
            <option value="correction">Correzione dati</option>
            <option value="removal">Richiesta di rimozione</option>
            <option value="source_question">Informazioni sulla fonte</option>
          </select>
        </label>
        <label className="text-sm font-medium text-[#34423d]">
          Azienda
          <input name="company_name" required minLength={2} maxLength={255} autoComplete="organization" className="mt-2 h-11 w-full rounded-xl border border-[#d0dad6] px-3" />
        </label>
        <label className="text-sm font-medium text-[#34423d]">
          Paese (ISO, opzionale)
          <input name="country_code" maxLength={2} placeholder="IT" className="mt-2 h-11 w-full rounded-xl border border-[#d0dad6] px-3 uppercase" />
        </label>
        <label className="text-sm font-medium text-[#34423d]">
          Email di contatto (opzionale)
          <input name="contact_email" type="email" maxLength={320} autoComplete="email" className="mt-2 h-11 w-full rounded-xl border border-[#d0dad6] px-3" />
        </label>
      </div>

      <label className="block text-sm font-medium text-[#34423d]">
        URL della fonte o del risultato (opzionale)
        <input name="source_url" type="url" maxLength={2000} placeholder="https://..." className="mt-2 h-11 w-full rounded-xl border border-[#d0dad6] px-3" />
      </label>

      <p className="rounded-xl border border-[#d9e8e2] bg-[#edf5f2] px-4 py-3 text-xs leading-5 text-[#52615b]">
        Non inserire dati personali non necessari. Questo modulo serve a segnalare dati aziendali
        e non sostituisce le procedure formali per l&apos;esercizio dei diritti privacy.
      </p>

      <label className="block text-sm font-medium text-[#34423d]">
        Cosa dobbiamo verificare?
        <textarea name="request_text" required minLength={10} maxLength={4000} rows={5} className="mt-2 w-full rounded-xl border border-[#d0dad6] px-3 py-3" />
      </label>

      {state.message ? (
        <div className={state.status === "success" ? "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"}>
          {state.message}
          {state.requestId ? <span className="mt-1 block text-xs">Riferimento: {state.requestId.slice(0, 8)}</span> : null}
        </div>
      ) : null}

      <button disabled={pending} className="platform-primary h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-60">
        {pending ? "Invio…" : "Invia richiesta"}
      </button>
    </form>
  );
}
