"use client";

import { useActionState, useId } from "react";

import {
  recordHumanTimeEvidence,
  type HumanEvidenceState,
} from "@/app/(workspace)/pilot-analytics/actions";

const initialState: HumanEvidenceState = { status: "idle", message: "" };

export function HumanTimeEvidenceForm() {
  const [state, action, pending] = useActionState(recordHumanTimeEvidence, initialState);
  const messageId = useId();

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" aria-busy={pending}>
      <label className="text-xs font-semibold text-slate-600">
        Attività
        <select name="task_type" required disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
          <option value="">Seleziona</option>
          <option value="search">Ricerca commerciale</option>
          <option value="product_lookup">Ricerca prodotto</option>
          <option value="company_lookup">Ricerca cliente / azienda</option>
          <option value="price_lookup">Ricerca prezzo storico</option>
          <option value="evidence_check">Verifica documento originale</option>
          <option value="correction">Correzione dato</option>
          <option value="other">Altro</option>
        </select>
      </label>

      <label className="text-xs font-semibold text-slate-600">
        Confronto percepito
        <select name="comparison" required disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
          <option value="">Seleziona</option>
          <option value="faster">Più veloce</option>
          <option value="same">Circa uguale</option>
          <option value="slower">Più lento</option>
        </select>
      </label>

      <label className="text-xs font-semibold text-slate-600">
        Tempo con Steel Sales AI · minuti
        <input name="steel_minutes" required inputMode="decimal" placeholder="es. 1,5" disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>

      <label className="text-xs font-semibold text-slate-600">
        Stima con email / Excel · minuti
        <input name="previous_minutes" required inputMode="decimal" placeholder="es. 5" disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
      </label>

      <label className="text-xs font-semibold text-slate-600">
        Quanto sei sicuro della stima?
        <select name="confidence" defaultValue="medium" disabled={pending} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
          <option value="low">Bassa</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
      </label>

      <div className="flex items-end">
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Salvataggio…" : "Registra questo caso"}
        </button>
      </div>

      <p id={messageId} role={state.status === "error" ? "alert" : "status"} className={"text-xs sm:col-span-2 " + (state.status === "error" ? "text-red-700" : "text-emerald-700")}>
        {state.message}
      </p>
    </form>
  );
}
