"use client";

import { useActionState, useId } from "react";
import { correctReviewItem, type ReviewActionState } from "@/app/(workspace)/review/actions";

const initialState: ReviewActionState = { status: "idle", message: "" };

export function ReviewCorrectForm({ id, reviewed }: { id: string; reviewed: boolean }) {
  const [state, action, pending] = useActionState(correctReviewItem, initialState);
  const messageId = useId();
  const saved = state.status === "success";

  return (
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-center text-xs font-semibold text-slate-600">
        {saved ? "Correzione salvata" : "Correggi"}
      </summary>
      <form action={action} className="space-y-2 border-t border-slate-100 p-3" aria-busy={pending}>
        <input type="hidden" name="id" value={id} />
        <input name="grade" placeholder="Qualità (es. S355J2H)" disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        <input name="standard" placeholder="Norma (es. EN 10219)" disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        <div className="grid grid-cols-2 gap-2">
          <input name="length_mm" inputMode="decimal" placeholder="Lunghezza mm" disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="quantity" inputMode="decimal" placeholder="Quantità" disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input name="quantity_unit" placeholder="Unità (T/PZ)" disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
          <input name="availability_status" placeholder="Disponibilità" disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        </div>
        <textarea name="note" placeholder="Nota della revisione" rows={2} disabled={pending || reviewed} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
        <button type="submit" disabled={pending || saved || reviewed} className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Salvataggio…" : saved ? "Salvata" : reviewed ? "Già revisionata" : "Salva correzione"}
        </button>
        <p id={messageId} role={state.status === "error" ? "alert" : "status"} aria-atomic="true" className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {pending ? "Salvataggio in corso…" : state.message}
        </p>
      </form>
    </details>
  );
}
