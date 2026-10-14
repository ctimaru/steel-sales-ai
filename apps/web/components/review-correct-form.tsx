"use client";

import { useActionState, useId } from "react";
import { correctReviewItem, type ReviewActionState } from "@/app/(workspace)/review/actions";
import { ActionFeedback } from "@/components/action-feedback";

const initialState: ReviewActionState = { status: "idle", message: "" };

export function ReviewCorrectForm({ id, reviewed }: { id: string; reviewed: boolean }) {
  const [state, action, pending] = useActionState(correctReviewItem, initialState);
  const messageId = useId();
  const saved = state.status === "success";

  return (
    <details className="rounded-lg border border-slate-300 bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        {saved ? "Correzione salvata" : "Correggi"}
      </summary>
      <form action={action} className="space-y-2 border-t border-slate-100 p-3" aria-busy={pending}>
        <input type="hidden" name="id" value={id} />
        <input name="grade" aria-label="Qualità acciaio" placeholder="Qualità (es. S355J2H)" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
        <input name="standard" aria-label="Norma di riferimento" placeholder="Norma (es. EN 10219)" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
        <input name="material_number" aria-label="Numero materiale" placeholder="Numero materiale" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />

        <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Geometria</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input name="outer_diameter_mm" aria-label="Diametro esterno in millimetri" inputMode="decimal" placeholder="Diametro mm" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="thickness_mm" aria-label="Spessore in millimetri" inputMode="decimal" placeholder="Spessore mm" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="width_mm" aria-label="Larghezza in millimetri" inputMode="decimal" placeholder="Larghezza mm" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="height_mm" aria-label="Altezza in millimetri" inputMode="decimal" placeholder="Altezza mm" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="length_mm" aria-label="Lunghezza in millimetri" inputMode="decimal" placeholder="Lunghezza mm" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
        </div>

        <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Quantità e prezzo</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input name="quantity" aria-label="Quantità" inputMode="decimal" placeholder="Quantità" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="quantity_unit" aria-label="Unità di quantità" placeholder="Unità (T/PZ/M)" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="price_value" aria-label="Prezzo" inputMode="decimal" placeholder="Prezzo" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="price_unit" aria-label="Unità del prezzo" placeholder="Unità prezzo (M/T/PZ)" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="currency" aria-label="Valuta" maxLength={3} placeholder="Valuta (EUR)" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
          <input name="discount_percentage" aria-label="Sconto percentuale" inputMode="decimal" placeholder="Sconto %" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
        </div>
        <input name="availability_status" aria-label="Disponibilità" placeholder="Disponibilità" disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
        <textarea name="note" aria-label="Nota della revisione" placeholder="Nota della revisione" rows={2} disabled={pending || reviewed} className="min-h-11 w-full min-w-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:opacity-60" />
        <button type="submit" disabled={pending || saved || reviewed} className="min-h-11 w-full rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Salvataggio…" : saved ? "Salvata" : reviewed ? "Già revisionata" : "Salva correzione"}
        </button>
        <ActionFeedback
          id={messageId}
          status={state.status}
          message={state.message}
          pending={pending}
          pendingMessage="Salvataggio in corso…"
        />
      </form>
    </details>
  );
}
